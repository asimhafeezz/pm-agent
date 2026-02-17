import { cn } from "@/lib/utils";
import { Loader2, TrendingUp as TrendingUpIcon, PanelLeft, Plus } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Settings01Icon, Logout01Icon, MoreVerticalIcon, Delete02Icon, PencilEdit02Icon, PinIcon } from "@hugeicons/core-free-icons";
import { useAuth } from "@/components/auth/auth-provider";
import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import { Typewriter } from "@/components/ui/typewriter";

interface SidebarProps {
    className?: string;
    onClose?: () => void;
    autoCloseOnNav?: boolean;
}

interface Conversation {
    id: string;
    title: string;
    updatedAt: string;
    isSaved: boolean;
}

export function Sidebar({ className, onClose, autoCloseOnNav = false }: SidebarProps) {
    const { token, logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [userMenuPosition, setUserMenuPosition] = useState<{ top: number; left: number } | null>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Rename modal state
    const [renameModalChat, setRenameModalChat] = useState<Conversation | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const renameInputRef = useRef<HTMLInputElement>(null);
    const [deleteModalChat, setDeleteModalChat] = useState<Conversation | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Animation Logic: Track new conversations
    const [newChatId, setNewChatId] = useState<string | null>(null);
    const prevChatIds = useRef<Set<string>>(new Set());
    const isFirstLoad = useRef(true);
    const userInitials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.trim().toUpperCase() || (user?.email?.[0] || "U").toUpperCase();
    const normalizedPathname = location.pathname.replace(/\/+$/, "") || "/";

    useEffect(() => {
        if (loading) return; // Wait for load

        const currentIds = new Set(conversations.map(c => c.id));

        // Skip logic on first valid load
        if (isFirstLoad.current) {
            if (conversations.length > 0) {
                prevChatIds.current = currentIds;
                isFirstLoad.current = false;
            }
            return;
        }

        // Find strictly NEW id (present now, not before)
        const addedChat = conversations.find(c => !prevChatIds.current.has(c.id));
        if (addedChat) {
            setNewChatId(addedChat.id);
        }

        prevChatIds.current = currentIds;
    }, [conversations, loading]);

    const fetchConversations = () => {
        if (!token) return;
        setNewChatId(null); // Reset animation state to prevent old chats from re-animating

        // Silent refresh: Only show spinner if we have no data
        if (conversations.length === 0) {
            setLoading(true);
        }

        fetch(apiUrl("/api/conversations"), {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(payload => {
                const data = payload?.data ?? payload;
                if (Array.isArray(data)) {
                    setConversations(data
                        .filter((c: any) => c.title && c.title !== "New Conversation" && c.title !== "Untitled Conversation")
                        .map((c: any) => ({
                            id: c.id,
                            title: c.title,
                            updatedAt: c.updatedAt,
                            isSaved: c.isSaved || false
                        })));
                }
            })
            .catch(err => console.error("Failed to load history", err))
            .finally(() => setLoading(false));
    };

    const toggleSaved = async (e: React.MouseEvent, chat: Conversation) => {
        e.preventDefault();
        e.stopPropagation();

        const newSavedState = !chat.isSaved;

        // Optimistic update
        setConversations(prev => prev.map(c =>
            c.id === chat.id ? { ...c, isSaved: newSavedState } : c
        ));

        // API Call
        try {
            const res = await fetch(apiUrl(`/api/conversations/${chat.id}`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ isSaved: newSavedState })
            });
            if (!res.ok) throw new Error("Failed to update");
        } catch (err) {
            // Revert on failure
            console.error(err);
            setConversations(prev => prev.map(c =>
                c.id === chat.id ? { ...c, isSaved: !newSavedState } : c
            ));
        } finally {
            setOpenMenuId(null);
            setMenuPosition(null);
        }
    };

    const openRenameModal = (e: React.MouseEvent, chat: Conversation) => {
        e.preventDefault();
        e.stopPropagation();
        setRenameModalChat(chat);
        setRenameValue(chat.title);
        setOpenMenuId(null);
        setMenuPosition(null);
        // Focus input after render
        setTimeout(() => renameInputRef.current?.focus(), 50);
    };

    const openDeleteModal = (e: React.MouseEvent, chat: Conversation) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteModalChat(chat);
        setOpenMenuId(null);
        setMenuPosition(null);
    };

    const handleRenameSubmit = async () => {
        if (!renameModalChat || !renameValue.trim() || renameValue === renameModalChat.title) {
            setRenameModalChat(null);
            return;
        }

        const newTitle = renameValue.trim();
        const oldTitle = renameModalChat.title;
        const chatId = renameModalChat.id;

        // Optimistic update
        setConversations(prev => prev.map(c =>
            c.id === chatId ? { ...c, title: newTitle } : c
        ));
        setRenameModalChat(null);

        try {
            const res = await fetch(apiUrl(`/api/conversations/${chatId}`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ title: newTitle })
            });
            if (!res.ok) throw new Error("Failed to rename");
        } catch (err) {
            console.error(err);
            // Revert on failure
            setConversations(prev => prev.map(c =>
                c.id === chatId ? { ...c, title: oldTitle } : c
            ));
        }
    };

    const deleteConversation = async (chat: Conversation) => {
        if (!token) {
            console.error("Missing auth token for delete.");
            return;
        }

        const previousConversations = conversations;
        // Optimistically remove from list to avoid stale UI.
        setConversations(prev => prev.filter(c => c.id !== chat.id));

        try {
            const res = await fetch(apiUrl(`/api/conversations/${chat.id}`), {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
            });
            if (!res.ok) throw new Error("Failed to delete");
            if (location.pathname === `/c/${chat.id}`) {
                navigate("/", { replace: true });
            }
            fetchConversations();
        } catch (err) {
            console.error(err);
            setConversations(previousConversations);
        } finally {
            setOpenMenuId(null);
            setMenuPosition(null);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModalChat) return;
        const chat = deleteModalChat;
        setDeleteModalChat(null);
        await deleteConversation(chat);
    };

    useEffect(() => {
        fetchConversations();

        const handleConversationCreated = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (detail && detail.id) {
                // Optimistic update: Add new chat directly to state
                const newChat: Conversation = {
                    id: detail.id,
                    title: detail.title || "New Conversation",
                    updatedAt: detail.updatedAt || new Date().toISOString(),
                    isSaved: false
                };

                setConversations(prev => {
                    // Prevent duplicates just in case
                    if (prev.some(c => c.id === newChat.id)) return prev;
                    return [newChat, ...prev];
                });
                // Note: We DO NOT call fetchConversations() here to avoid refreshing the list from API
            } else {
                // Fallback for events without data
                fetchConversations();
            }
        };

        window.addEventListener("conversation-created", handleConversationCreated);
        return () => window.removeEventListener("conversation-created", handleConversationCreated);
    }, [token]);

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            const path = event.composedPath?.() ?? [];
            const isInsideMenu = path.some((node) => {
                return node instanceof HTMLElement && node.dataset?.convMenu === "true";
            });
            if (!isInsideMenu) {
                setOpenMenuId(null);
                setMenuPosition(null);
                setUserMenuOpen(false);
                setUserMenuPosition(null);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const navItems = [
        {
            icon: Plus,
            label: "New chat",
            isActive: normalizedPathname === "/",
            action: () => { navigate("/"); if (autoCloseOnNav) onClose?.(); }
        },
        {
            icon: TrendingUpIcon,
            label: "Dashboard",
            isActive: normalizedPathname === "/dashboard" || normalizedPathname.startsWith("/dashboard/"),
            action: () => { navigate("/dashboard"); if (autoCloseOnNav) onClose?.(); }
        },

    ];

    const filteredConversations = conversations.filter(c =>
        !c.isSaved && (!searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const visibleCount = filteredConversations.length;

    return (
        <div className={cn("h-full flex flex-col py-4 px-4 gap-5 relative", className)}>
            {/* Close Button (Mobile) */}
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-6 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors md:hidden"
                >
                    <PanelLeft className="h-5 w-5" strokeWidth={2} />
                </button>
            )}

            {/* Brand */}
            <div className="flex items-center justify-between px-2 mb-2">
                <div className="flex items-center gap-3">
                    <h1
                        className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-200/80 via-white/20 to-slate-200/80 drop-shadow-[0_1px_10px_rgba(255,255,255,0.18)] cursor-pointer"
                        onClick={() => navigate("/")}
                    >
                        Finly.
                    </h1>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors hidden md:flex"
                    >
                        <PanelLeft className="h-5 w-5" strokeWidth={2} />
                    </button>
                )}
            </div>

            {/* Main Nav */}
            <nav className="flex flex-col gap-1">
                {navItems.map((item, i) => (
                    <button
                        key={i}
                        onClick={item.action}
                        aria-current={item.isActive ? "page" : undefined}
                        className={cn(
                            "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                            item.isActive
                                ? "bg-[#27272a] text-white shadow-sm"
                                : "text-slate-400 hover:text-white hover:bg-[#27272a]/50"
                        )}
                    >
                        <item.icon className="h-5 w-5" strokeWidth={2} />
                        {item.label}
                    </button>
                ))}

                {/* Inline Search Input */}
                <div className="relative px-1">
                    <HugeiconsIcon
                        icon={Search01Icon}
                        size={16}
                        strokeWidth={2}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                    />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setSearchQuery("");
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                        placeholder="Search..."
                        className="w-full pl-9 pr-8 py-2.5 bg-transparent border-0 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:bg-white/[0.05] transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors text-lg"
                        >
                            ×
                        </button>
                    )}
                </div>
            </nav>

            {/* Pinned Section - Always Visible (Outside Scroll) */}
            {!loading && conversations.filter(c => c.isSaved && (!searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()))).length > 0 && (
                <div className="flex-shrink-0 mb-2">
                    <h3 className="px-2 text-[10px] font-bold text-slate-500 mb-1 tracking-widest uppercase flex items-center gap-1.5">
                        <HugeiconsIcon icon={PinIcon} size={10} strokeWidth={2} className="text-slate-500" />
                        Pinned {searchQuery && <span className="text-slate-600">• filtered</span>}
                    </h3>
                    <div className="flex flex-col gap-0.5 max-h-[180px] overflow-y-auto sidebar-scroll">
                        {conversations.filter(c => c.isSaved && (!searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase()))).map((chat) => {
                            const isActive = normalizedPathname === `/c/${chat.id}` || normalizedPathname.startsWith(`/c/${chat.id}/`);
                            const isMenuOpen = openMenuId === chat.id;
                            const isHighlighted = isActive && !isMenuOpen;
                            const isNew = chat.id === newChatId;

                            return (
                                <Link to={`/c/${chat.id}`} key={chat.id} onClick={() => { if (autoCloseOnNav) onClose?.(); }}>
                                    <div
                                        data-chat-row="true"
                                        className={cn(
                                            "flex items-center justify-between px-3 py-2 text-[13px] rounded-xl group text-left w-full transition-all duration-200 relative overflow-visible cursor-pointer",
                                            isNew && "animate-in fade-in slide-in-from-left duration-500",
                                            isHighlighted
                                                ? "bg-[#27272a] text-white shadow-sm font-medium"
                                                : "text-slate-400 hover:text-white hover:bg-[#27272a]/50"
                                        )}>
                                        <span className="truncate flex items-center gap-3 pr-6">
                                            <span className="truncate">
                                                {isNew ? <Typewriter content={chat.title} speed={25} /> : chat.title}
                                            </span>
                                        </span>

                                        <div
                                            data-conv-menu="true"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center"
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (openMenuId === chat.id) {
                                                        setOpenMenuId(null);
                                                        setMenuPosition(null);
                                                        return;
                                                    }

                                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                    setMenuPosition({
                                                        top: rect.bottom + 6,
                                                        left: rect.right + 10
                                                    });
                                                    setOpenMenuId(chat.id);
                                                }}
                                                className={cn(
                                                    "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                                                    isMenuOpen ? "bg-white/10 text-slate-200" : "text-slate-500 hover:text-slate-300 hover:bg-white/10"
                                                )}
                                            >
                                                <HugeiconsIcon icon={MoreVerticalIcon} size={16} strokeWidth={2} />
                                            </button>

                                            {isMenuOpen && menuPosition && createPortal(
                                                <div
                                                    data-conv-menu="true"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    className="rounded-3xl bg-white/10 border border-white/10 shadow-2xl overflow-hidden px-2 py-2 ring-1 ring-white/5 backdrop-blur-md w-[140px]"
                                                    style={{
                                                        position: "fixed",
                                                        top: menuPosition.top,
                                                        left: menuPosition.left,
                                                        transform: "translateY(-30%)",
                                                        zIndex: 1000
                                                    }}
                                                >
                                                    <button
                                                        onClick={(e) => openRenameModal(e, chat)}
                                                        className="w-full px-3 py-2 text-left text-[12px] text-slate-100 hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors"
                                                    >
                                                        <HugeiconsIcon icon={PencilEdit02Icon} size={16} className="text-slate-400" strokeWidth={2} />
                                                        Rename
                                                    </button>
                                                    <button
                                                        onClick={(e) => toggleSaved(e, chat)}
                                                        className="w-full px-3 py-2 text-left text-[12px] text-slate-100 hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors"
                                                    >
                                                        <HugeiconsIcon icon={PinIcon} size={16} className={cn(chat.isSaved ? "fill-blue-500 text-blue-500" : "text-slate-400")} strokeWidth={2} />
                                                        {chat.isSaved ? "Unpin" : "Pin"}
                                                    </button>
                                                    <button
                                                        onClick={(e) => openDeleteModal(e, chat)}
                                                        className="w-full px-3 py-2 text-left text-[12px] text-slate-100 hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors"
                                                    >
                                                        <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                                                        Delete
                                                    </button>
                                                </div>,
                                                document.body
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main Conversation Section */}
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-shrink-0 px-2 mb-1">
                    <h3 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                        Conversations {searchQuery && <span className="text-slate-600">• filtered</span>}
                    </h3>
                </div>

                {/* Main Conversation List */}
                <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll space-y-0.5">
                    {filteredConversations.slice(0, visibleCount).map((chat) => {
                        const isActive = normalizedPathname === `/c/${chat.id}` || normalizedPathname.startsWith(`/c/${chat.id}/`);
                        const isMenuOpen = openMenuId === chat.id;
                        const isHighlighted = isActive && !isMenuOpen;
                        const isNew = chat.id === newChatId;

                        return (
                            <Link to={`/c/${chat.id}`} key={chat.id} onClick={() => { if (autoCloseOnNav) onClose?.(); }}>
                                <div
                                    data-chat-row="true"
                                    className={cn(
                                        "flex items-center justify-between px-3 py-2 text-[13px] rounded-xl group text-left w-full transition-all duration-200 relative overflow-visible cursor-pointer",
                                        isNew && "animate-in fade-in slide-in-from-left duration-500",
                                        isHighlighted
                                            ? "bg-[#27272a] text-white shadow-sm font-medium"
                                            : "text-slate-400 hover:text-white hover:bg-[#27272a]/50"
                                    )}>
                                    <span className="truncate flex items-center gap-3 pr-6">
                                        <span className="truncate">
                                            {isNew ? <Typewriter content={chat.title} speed={25} /> : chat.title}
                                        </span>
                                    </span>

                                    <div
                                        data-conv-menu="true"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center"
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (openMenuId === chat.id) {
                                                    setOpenMenuId(null);
                                                    setMenuPosition(null);
                                                    return;
                                                }

                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                setMenuPosition({
                                                    top: rect.bottom + 6,
                                                    left: rect.right + 10
                                                });
                                                setOpenMenuId(chat.id);
                                            }}
                                            className={cn(
                                                "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                                                isMenuOpen ? "bg-white/10 text-slate-200" : "text-slate-500 hover:text-slate-300 hover:bg-white/10"
                                            )}
                                        >
                                            <HugeiconsIcon icon={MoreVerticalIcon} size={16} strokeWidth={2} />
                                        </button>

                                        {isMenuOpen && menuPosition && createPortal(
                                            <div
                                                data-conv-menu="true"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                className="rounded-3xl bg-white/10 border border-white/10 shadow-2xl overflow-hidden px-2 py-2 ring-1 ring-white/5 backdrop-blur-md w-[140px]"
                                                style={{
                                                    position: "fixed",
                                                    top: menuPosition.top,
                                                    left: menuPosition.left,
                                                    transform: "translateY(-30%)",
                                                    zIndex: 1000
                                                }}
                                            >
                                                <button
                                                    onClick={(e) => openRenameModal(e, chat)}
                                                    className="w-full px-3 py-2 text-left text-[12px] text-slate-100 hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors"
                                                >
                                                    <HugeiconsIcon icon={PencilEdit02Icon} size={16} className="text-slate-400" strokeWidth={2} />
                                                    Rename
                                                </button>
                                                <button
                                                    onClick={(e) => toggleSaved(e, chat)}
                                                    className="w-full px-3 py-2 text-left text-[12px] text-slate-100 hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors"
                                                >
                                                    <HugeiconsIcon icon={PinIcon} size={16} className={cn(chat.isSaved ? "fill-blue-500 text-blue-500" : "text-slate-400")} strokeWidth={2} />
                                                    {chat.isSaved ? "Unpin" : "Pin"}
                                                </button>
                                                <button
                                                    onClick={(e) => openDeleteModal(e, chat)}
                                                    className="w-full px-3 py-2 text-left text-[12px] text-slate-100 hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors"
                                                >
                                                    <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
                                                    Delete
                                                </button>
                                            </div>,
                                            document.body
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}

                    {/* Load more indicator - only show when not searching and more items exist */}
                    {!searchQuery && visibleCount < filteredConversations.length && (
                        <div className="flex justify-center py-2">
                            <p className="text-[10px] text-slate-500">Scroll for more...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* User Avatar + Menu */}
            <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <button
                        data-conv-menu="true"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (userMenuOpen) {
                                setUserMenuOpen(false);
                                setUserMenuPosition(null);
                                return;
                            }
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setUserMenuPosition({
                                top: rect.top + 6,
                                left: rect.right
                            });
                            setUserMenuOpen(true);
                        }}
                        className="h-9 w-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/15 transition-all overflow-hidden"
                        aria-label="User menu"
                    >
                        {user?.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt="Profile"
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <span className="text-[11px] font-semibold text-slate-200">{userInitials}</span>
                        )}
                    </button>
                    <span className="text-xs text-slate-400 font-medium">
                        {user?.firstName || user?.email || "User"}
                    </span>
                </div>

                {userMenuOpen && userMenuPosition && createPortal(
                    <div
                        data-conv-menu="true"
                        onMouseDown={(e) => e.stopPropagation()}
                        className="rounded-3xl bg-white/10 border border-white/10 shadow-2xl overflow-hidden px-2 py-2 ring-1 ring-white/5 backdrop-blur-md w-[200px]"
                        style={{
                            position: "fixed",
                            top: userMenuPosition.top,
                            left: userMenuPosition.left,
                            transform: "translateY(-100%)",
                            zIndex: 1000
                        }}
                    >


                        <div className="h-px bg-white/5 mx-2 my-1" />
                        <button
                            onClick={() => {
                                setUserMenuOpen(false);
                                setUserMenuPosition(null);
                                navigate("/settings");
                                if (autoCloseOnNav) onClose?.();
                            }}
                            className="w-full px-3 py-2 text-left text-[12px] text-slate-100 hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors"
                        >
                            <HugeiconsIcon icon={Settings01Icon} size={16} className="text-slate-400" strokeWidth={2} />
                            Settings
                        </button>
                        <button
                            onClick={() => {
                                if (isLoggingOut) return;
                                setIsLoggingOut(true);
                                setUserMenuOpen(false);
                                setUserMenuPosition(null);
                                logout();
                                if (autoCloseOnNav) onClose?.();
                            }}
                            disabled={isLoggingOut}
                            className="w-full px-3 py-2 text-left text-[12px] text-rose-300 hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoggingOut ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <HugeiconsIcon icon={Logout01Icon} size={16} strokeWidth={2} />
                            )}
                            {isLoggingOut ? "Logging out..." : "Log out"}
                        </button>
                    </div>,
                    document.body
                )}
            </div>
            {/* Rename Modal */}
            {
                renameModalChat && createPortal(
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]"
                        onClick={() => setRenameModalChat(null)}
                    >
                        <div
                            className="bg-[#1a1a1d] border border-white/10 rounded-2xl p-5 w-[320px] shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-sm font-semibold text-white mb-4">Rename Conversation</h3>
                            <input
                                ref={renameInputRef}
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRenameSubmit();
                                    if (e.key === "Escape") setRenameModalChat(null);
                                }}
                                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/15 transition-all"
                                placeholder="Enter new name..."
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    onClick={() => setRenameModalChat(null)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRenameSubmit}
                                    className="px-4 py-2 text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.12] rounded-lg transition-colors border border-white/10"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
            {/* Delete Modal */}
            {
                deleteModalChat && createPortal(
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]"
                        onClick={() => setDeleteModalChat(null)}
                    >
                        <div
                            className="bg-[#1a1a1d] border border-white/10 rounded-2xl p-5 w-[320px] shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-sm font-semibold text-white mb-2">Delete Conversation?</h3>
                            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                                Are you sure you want to delete <span className="text-white font-medium">"{deleteModalChat.title}"</span>? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    onClick={() => setDeleteModalChat(null)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    className="px-4 py-2 text-xs font-medium text-white bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors border border-red-500/10"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div >
    );
}
