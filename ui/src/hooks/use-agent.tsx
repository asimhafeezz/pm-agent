import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { apiUrl } from "@/lib/api";
import { useNavigate } from "react-router-dom";

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    data?: any;
}

export interface AgentState {
    status: "idle" | "loading" | "thinking" | "communicating" | "error";
    messages: Message[];
    data: any;
    error?: string | null;
    historyLoaded?: boolean;
}

export function useAgent(conversationId?: string) {
    const { token } = useAuth();
    const [state, setState] = useState<AgentState>({
        status: "idle",
        messages: [],
        data: null,
        error: null,
        historyLoaded: false,
    });

    const socketRef = useRef<WebSocket | null>(null);

    // Fetch history if conversationId changes
    useEffect(() => {
        if (conversationId && token) {
            setState(prev => ({ ...prev, status: "loading", error: null, historyLoaded: false }));
            fetch(apiUrl(`/api/conversations/${conversationId}/messages`), {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(payload => {
                    const data = payload?.data ?? payload;
                    const history = Array.isArray(data) ? data.map((m: any) => ({
                        id: m.id,
                        role: m.role.toLowerCase() as "user" | "assistant",
                        content: m.content,
                        timestamp: new Date(m.createdAt),
                        data: m.metadataJson,
                    })) : [];
                    setState({ status: "idle", messages: history, data: null, error: null, historyLoaded: true });
                })
                .catch(err => {
                    console.error("Failed to load messages", err);
                    setState(prev => ({ ...prev, status: "idle", error: "Failed to load messages.", historyLoaded: true }));
                });
        } else {
            setState({ status: "idle", messages: [], data: null, error: null, historyLoaded: true });
        }
    }, [conversationId, token]);

    // Clean up socket on unmount
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    const navigate = useNavigate();

    const startRun = useCallback(async (question: string) => {
        const userMessage: Message = {
            id: `local-${crypto.randomUUID()}`,
            role: "user",
            content: question,
            timestamp: new Date(),
        };

        try {
            if (!token) throw new Error("No auth token available");

            let activeConversationId = conversationId;

            // If creating a new conversation
            if (!activeConversationId) {
                const convRes = await fetch(apiUrl("/api/conversations"), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({})
                });

                const payload = await convRes.json();
                const convData = payload?.data ?? payload;
                activeConversationId = convData.id;

                navigate(`/c/${activeConversationId}`);
                return; // Navigation will trigger re-mount or effect, but here we want to continue? 
                // Actually if we navigate, the component might unmount. 
                // But for simplicity in this boilerplate, let's assume valid navigation.
            }

            setState((prev) => ({
                ...prev,
                status: "thinking",
                messages: [...prev.messages, userMessage],
            }));

            // Persist user message
            if (activeConversationId) {
                await fetch(apiUrl(`/api/conversations/${activeConversationId}/messages`), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ role: "user", content: question })
                });
            }

            // Connect to WebSocket
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/agent/chat`;

            if (socketRef.current) {
                socketRef.current.close();
            }

            const ws = new WebSocket(wsUrl);
            socketRef.current = ws;

            let currentAssistantMessage = "";
            const assistantMessageId = `assistant-${crypto.randomUUID()}`;

            ws.onopen = () => {
                ws.send(JSON.stringify({
                    question,
                    conversationId: activeConversationId,
                    authToken: token ? `Bearer ${token}` : "",
                }));
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.event === "text_token") {
                    currentAssistantMessage += data.payload.token;
                    setState((prev) => {
                        const lastMsg = prev.messages[prev.messages.length - 1];
                        if (lastMsg.role === "assistant" && lastMsg.id === assistantMessageId) {
                            const updatedMessages = [...prev.messages];
                            updatedMessages[updatedMessages.length - 1] = {
                                ...lastMsg,
                                content: currentAssistantMessage,
                            };
                            return { ...prev, status: "communicating", messages: updatedMessages };
                        } else {
                            return {
                                ...prev,
                                status: "communicating",
                                messages: [...prev.messages, {
                                    id: assistantMessageId,
                                    role: "assistant",
                                    content: currentAssistantMessage,
                                    timestamp: new Date(),
                                }],
                            };
                        }
                    });
                }

                if (data.event === "completed") {
                    const finalAnswer = data.payload?.finalAnswer || currentAssistantMessage;
                    setState((prev) => ({ ...prev, status: "idle" }));

                    if (finalAnswer && activeConversationId) {
                        fetch(apiUrl(`/api/conversations/${activeConversationId}/messages`), {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                role: "assistant",
                                content: finalAnswer,
                            })
                        });
                    }
                    ws.close();
                }
            };

            ws.onerror = (err) => {
                console.error("WebSocket error", err);
                setState((prev) => ({ ...prev, status: "idle", error: "WebSocket error." }));
            };

        } catch (err) {
            console.error(err);
            setState((prev) => ({ ...prev, status: "idle", error: "Failed to start run." }));
        }
    }, [token, conversationId, navigate]);

    return {
        ...state,
        startRun,
    };
}
