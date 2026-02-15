"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface Message {
    id: string;
    uid: string;
    displayName: string;
    league: string;
    content: string;
    createdAt: string;
    type: "text" | "announcement";
}

const LEAGUE_COLORS: Record<string, string> = {
    "Diamond": "text-sky-400",
    "Platinum": "text-slate-300",
    "Gold": "text-yellow-500",
    "Silver": "text-gray-400",
    "Bronze": "text-orange-600"
};

export default function ChatOverlay({ league }: { league: string }) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [channelId, setChannelId] = useState("general");
    const [cooldown, setCooldown] = useState(0);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchMessages = useCallback(async () => {
        if (!user || !isOpen) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/chat?channelId=${channelId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setMessages(data.messages || []);
        } catch (error) {
            console.error("Failed to fetch chat", error);
        }
    }, [user, isOpen, channelId]);

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [fetchMessages]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !user || cooldown > 0 || loading) return;

        setLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    channelId,
                    content: input.trim()
                })
            });

            if (res.ok) {
                setInput("");
                fetchMessages();
            } else if (res.status === 429) {
                // Extract cooldown from error message if possible, or just set 60s
                setCooldown(60);
            }
        } catch (error) {
            console.error("Failed to send message", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="w-80 h-[450px] bg-background border border-foreground/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-foreground/10 flex items-center justify-between bg-foreground/2">
                            <div>
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" />
                                    {channelId === "general" ? "General Chat" : "Elite Channel"}
                                </h3>
                                <p className="text-[10px] text-foreground/40 font-medium">Quiet Social Layer</p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-foreground/40 hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Channels (Mini) */}
                        <div className="px-4 py-2 flex gap-2 border-b border-foreground/10 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setChannelId("general")}
                                className={`text-[10px] px-2 py-1 rounded-full border transition-colors whitespace-nowrap ${channelId === "general" ? "bg-foreground text-background border-foreground" : "bg-foreground/5 border-transparent text-foreground/50"}`}
                            >
                                General
                            </button>
                            {["Gold", "Platinum", "Diamond"].includes(league) && (
                                <button
                                    onClick={() => setChannelId("league_gold")}
                                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors whitespace-nowrap ${channelId === "league_gold" ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" : "bg-foreground/5 border-transparent text-foreground/50"}`}
                                >
                                    Elite
                                </button>
                            )}
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                            {messages.map((msg) => (
                                <div key={msg.id} className="group">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className={`text-[10px] font-bold uppercase ${LEAGUE_COLORS[msg.league]}`}>
                                            {msg.league}
                                        </span>
                                        <span className="text-[10px] font-medium text-foreground/30">•</span>
                                        <span className="text-[10px] font-bold text-foreground/70">{msg.displayName}</span>
                                        {["Platinum", "Diamond"].includes(msg.league) && (
                                            <Zap className="w-2.5 h-2.5 text-blue-400 fill-blue-400/20" />
                                        )}
                                    </div>
                                    <p className="text-xs text-foreground/80 leading-relaxed bg-foreground/2 p-2 rounded-lg border border-foreground/5 group-hover:border-foreground/10 transition-colors">
                                        {msg.content}
                                    </p>
                                </div>
                            ))}
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                                    <MessageSquare className="w-8 h-8 mb-2" />
                                    <p className="text-xs font-medium">No messages yet</p>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSendMessage} className="p-4 border-t border-foreground/10 bg-foreground/2">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={cooldown > 0 ? `Wait ${cooldown}s...` : "Type a message..."}
                                    disabled={cooldown > 0 || loading}
                                    className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-foreground/30 transition-all pr-10 disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || cooldown > 0 || loading}
                                    className="absolute right-2 top-1.5 p-1 text-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            {league === "Bronze" && (
                                <p className="text-[9px] text-foreground/30 mt-2 text-center">
                                    Bronze users have a 5-minute cooldown.
                                </p>
                            )}
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${isOpen ? "bg-foreground text-background" : "bg-background border border-foreground/10 text-foreground"}`}
            >
                {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
            </motion.button>
        </div>
    );
}
