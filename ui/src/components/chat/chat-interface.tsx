import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon, ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { useAgent } from "@/hooks/use-agent";
import { useAuth } from "@/components/auth/auth-provider";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ChatInterface() {
    const { conversationId } = useParams();
    const { user } = useAuth();
    const { messages, status, startRun, historyLoaded } = useAgent(conversationId);
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, status]);

    // Auto-resize chat input
    useEffect(() => {
        if (chatInputRef.current) {
            chatInputRef.current.style.height = 'auto';
            chatInputRef.current.style.height = `${Math.min(chatInputRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || status !== "idle") return;
        startRun(input);
        setInput("");
    };

    const showHistoryLoading = !!conversationId && !historyLoaded && status === "loading";

    if (showHistoryLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto px-6 w-full relative z-10">
                <p className="text-slate-500">Loading conversation...</p>
            </div>
        );
    }

    if (!conversationId && messages.length === 0 && status === "idle") {
        return (
            <div className="h-full flex flex-col justify-center max-w-4xl mx-auto px-4 sm:px-6 w-full relative z-10">
                <div className="mb-8 md:mb-10 pl-1 sm:pl-2">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white mb-3 tracking-tight">
                        Hello, {user?.firstName || 'there'}
                    </h1>
                    <p className="text-lg text-slate-400">How can I help you today?</p>
                </div>

                <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-2 sm:p-3 pl-4 sm:pl-5 border border-white/10 mb-10 md:mb-12 group focus-within:ring-2 focus-within:ring-blue-500/20 transition-all max-w-4xl mx-auto w-full">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                        <textarea
                            ref={chatInputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            placeholder="Type a message..."
                            className="w-full bg-transparent border-none text-[13px] sm:text-[14px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 resize-none min-h-[48px] sm:min-h-[52px] leading-relaxed pt-2"
                        />
                        <div className="flex justify-end items-center pt-2">
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="h-8 w-8 rounded-full bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center hover:bg-white/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_24px_rgba(255,255,255,0.08)] hover:scale-105 active:scale-95"
                            >
                                <HugeiconsIcon icon={ArrowUp02Icon} size={18} className="text-white/90 rotate-45" strokeWidth={2.5} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex-1 overflow-y-auto px-4 md:px-20 py-6 md:py-8 space-y-8 chat-scroll relative z-10">
                {messages.map((msg, i) => (
                    <div
                        key={msg.id || i}
                        className={cn(
                            "group/message flex flex-col gap-2 max-w-4xl mx-auto",
                            msg.role === "assistant" ? "items-start" : "items-end"
                        )}
                    >
                        <div className={cn(
                            "px-5 sm:px-6 py-4 rounded-[1.5rem] text-[14px] leading-relaxed shadow-sm max-w-full sm:max-w-[85%] break-words border md:text-[15px]",
                            msg.role === "assistant"
                                ? "bg-transparent border-transparent text-slate-200 pl-0 pt-0"
                                : "bg-[#2A2A2E] text-slate-100 border-white/5"
                        )}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {typeof msg.content === 'string' ? msg.content : ''}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}

                {status === "thinking" && (
                    <div className="flex flex-col gap-2 max-w-4xl mx-auto items-start">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1 ml-1">
                            <HugeiconsIcon icon={SparklesIcon} size={14} className="opacity-50 animate-pulse" strokeWidth={2} />
                            <span>Thinking...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 md:px-20 md:pb-8 relative z-20">
                <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-2 sm:p-3 pl-4 sm:pl-5 border border-white/10 group focus-within:ring-2 focus-within:ring-blue-500/20 transition-all max-w-4xl mx-auto w-full">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                        <textarea
                            ref={chatInputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            placeholder="Type a message..."
                            className="w-full bg-transparent border-none text-[13px] sm:text-[14px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 resize-none min-h-[48px] sm:min-h-[52px] leading-relaxed pt-2"
                        />
                        <div className="flex justify-end items-center pt-2">
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="h-8 w-8 rounded-full bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center hover:bg-white/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_24px_rgba(255,255,255,0.08)] hover:scale-105 active:scale-95"
                            >
                                <HugeiconsIcon icon={ArrowUp02Icon} size={18} className="text-white/90 rotate-45" strokeWidth={2.5} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
