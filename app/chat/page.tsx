"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Hash,
    Send,
    ChevronLeft,
    Shield,
    Zap,
    Trophy,
    Lock,
    Loader2,
    AlertCircle,
    LayoutDashboard,
    Menu,
    Reply,
    Edit2,
    Trash2,
    CornerDownRight,
    X
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth-context";
import { getLeague } from "@/lib/leagues";
import { doc, getDoc } from "firebase/firestore";
import { ref, onValue, off, query, limitToLast, set, onDisconnect, serverTimestamp, orderByChild } from "firebase/database";
import { db, rtdb } from "@/lib/firebase";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import PresenceSidebar from "./PresenceSidebar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

const getDir = (text: string): "rtl" | "ltr" => {
    const arabic = /[\u0600-\u06FF]/;
    return arabic.test(text) ? "rtl" : "ltr";
};

const RATE_LIMIT_MS = 1500;
const LEAGUE_ICONS: Record<string, any> = {
    "Diamond": Trophy,
    "Platinum": Shield,
    "Gold": Zap,
    "Silver": Zap,
    "Bronze": Zap,
};

const LEAGUE_COLORS: Record<string, string> = {
    "Diamond": "#7dd3fc",
    "Platinum": "#a8a8aa",
    "Gold": "#d4a017",
    "Silver": "#9ca3af",
    "Bronze": "#CD7F32",
};

interface Message {
    id: string;
    uid: string;
    displayName: string;
    league: string;
    content: string;
    createdAt: string | Date | number;
    type?: "text" | "system";
    status?: "sending" | "sent" | "error";
    photoURL?: string | null;
    frame?: string | null;
    replyTo?: string | null;
    replyToUser?: string | null;
    replyToContent?: string | null;
    replyToUid?: string | null;
    isEdited?: boolean;
    isDeleted?: boolean;
}

const CHANNELS = [
    { id: "general", name: "general", icon: Hash, minLeague: "Bronze" },
    { id: "league_silver", name: "silver-club", icon: Zap, minLeague: "Silver" },
    { id: "league_gold", name: "gold-club", icon: Zap, minLeague: "Gold" },
    { id: "league_platinum", name: "platinum-club", icon: Shield, minLeague: "Platinum" },
    { id: "league_diamond", name: "diamond-club", icon: Trophy, minLeague: "Diamond" },
];

const LEAGUE_HIERARCHY = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

export default function ChatPage() {
    return (
        <AuthGuard>
            <ChatContent />
        </AuthGuard>
    );
}

interface UserProfile {
    totalGold: number;
    displayName?: string;
}

function ChatContent() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [channelId, setChannelId] = useState("general");
    const [showChannels, setShowChannels] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [lastSent, setLastSent] = useState(0);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const userLeague = getLeague(profile?.totalGold || 0);
    const currentChannel = CHANNELS.find(c => c.id === channelId) || CHANNELS[0];

    useEffect(() => {
        if (!user) return;
        const fetchProfile = async () => {
            const snap = await getDoc(doc(db, "users", user.uid));
            if (snap.exists()) setProfile(snap.data() as UserProfile);
        };
        fetchProfile();
    }, [user]);

    // Presence System
    useEffect(() => {
        if (!user || !profile) return;

        const connectedRef = ref(rtdb, ".info/connected");
        const userStatusRef = ref(rtdb, `status/${user.uid}`);

        const unsubscribe = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                const payload = {
                    uid: user.uid,
                    displayName: profile.displayName || "Student",
                    league: userLeague.name,
                    photoURL: profile.photoURL || user.photoURL || "",
                    state: "online",
                    lastChanged: serverTimestamp(),
                    currentChannel: channelId
                };

                onDisconnect(userStatusRef).set({
                    ...payload,
                    state: "offline",
                    lastChanged: serverTimestamp()
                }).then(() => {
                    set(userStatusRef, payload);
                });
            }
        });

        return () => {
            off(connectedRef, "value", unsubscribe);
        };
    }, [user, profile, userLeague.name, channelId]);

    const canPost = useCallback(() => {
        if (channelId === "general") return true;
        if (!profile) return false;

        const hierarchy = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
        const uIdx = hierarchy.indexOf(userLeague.name);
        const cIdx = hierarchy.indexOf(currentChannel.minLeague);

        if (uIdx >= 3) return true; // Platinum+
        return uIdx >= cIdx;
    }, [userLeague.name, currentChannel.minLeague, channelId, profile]);

    useEffect(() => {
        if (!user) return;

        const chatRef = query(
            ref(rtdb, `chat_messages/${channelId}`),
            orderByChild("createdAt"),
            limitToLast(50)
        );

        const unsubscribe = onValue(chatRef, (snapshot) => {
            if (snapshot.exists()) {
                const msgs: Message[] = [];
                snapshot.forEach((child) => {
                    msgs.push({
                        id: child.key!,
                        ...child.val()
                    } as Message);
                });

                // Ascending sort (Oldest at index 0, Newest at end)
                msgs.sort((a, b) => {
                    const tA = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : Number(a.createdAt || 0);
                    const tB = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : Number(b.createdAt || 0);
                    return tA - tB;
                });

                setMessages(prev => {
                    const remoteIds = new Set(msgs.map(m => m.id));
                    const trulyPending = prev.filter(p =>
                        !remoteIds.has(p.id) &&
                        (p.status === 'sending' || p.status === 'error')
                    );
                    return [...msgs, ...trulyPending];
                });
            } else {
                setMessages(prev => prev.filter(p => p.status === 'sending' || p.status === 'error'));
            }
        });

        return () => {
            setMessages([]);
            off(chatRef, "value", unsubscribe);
        };
    }, [user, channelId]);

    // User Profile Cache
    const [userProfiles, setUserProfiles] = useState<Record<string, { displayName: string; photoURL?: string; frame?: string; league?: string }>>({});
    const fetchedUids = useRef<Set<string>>(new Set());

    useEffect(() => {
        const uidsToFetch = new Set<string>();
        messages.forEach(msg => {
            if (!fetchedUids.current.has(msg.uid) && !userProfiles[msg.uid]) {
                uidsToFetch.add(msg.uid);
            }
        });

        if (uidsToFetch.size === 0) return;

        uidsToFetch.forEach(uid => fetchedUids.current.add(uid));

        const fetchProfiles = async () => {
            const newProfiles: typeof userProfiles = {};
            await Promise.all(Array.from(uidsToFetch).map(async (uid) => {
                try {
                    const snap = await getDoc(doc(db, "users", uid));
                    if (snap.exists()) {
                        const data = snap.data();
                        newProfiles[uid] = {
                            displayName: data.displayName || "Student",
                            photoURL: data.photoURL,
                            frame: data.frame,
                            league: getLeague(data.totalGold || 0).name
                        };
                    }
                } catch (e) {
                    console.error("Failed to fetch profile for", uid, e);
                }
            }));
            setUserProfiles(prev => ({ ...prev, ...newProfiles }));
        };
        fetchProfiles();
    }, [messages]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'instant' });
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent | undefined, retryContent?: string, retryMeta?: Partial<Message>) => {
        if (e) e.preventDefault();

        // Capture everything immediately
        const currentInput = input;
        const currentReplyingTo = replyingTo;
        const currentEditingMessage = editingMessage;
        const content = retryContent || currentInput.trim();
        const now = Date.now();

        console.log("[Chat] handleSendMessage START", {
            hasId: !!currentReplyingTo?.id,
            replyToId: currentReplyingTo?.id,
            content: content.substring(0, 10),
            isRetry: !!retryContent
        });

        if (!content || !user || !profile || !canPost()) return;

        // Rate limit check only for new messages (not retries or edits)
        if (!currentEditingMessage && !retryContent) {
            if (now - lastSent < RATE_LIMIT_MS) return;
            setLastSent(now);
        }

        if (currentEditingMessage) {
            const originalId = currentEditingMessage.id;
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/chat?channelId=${channelId}&messageId=${originalId}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ content })
                });
                if (!res.ok) throw new Error("Edit failed");
                setEditingMessage(null);
                setInput("");
            } catch (error) {
                console.error("Edit failed", error);
            }
            return;
        }

        if (!retryContent) {
            setInput("");
            inputRef.current?.focus();
        }

        const tempId = `${user.uid}-${now}`;
        const rTo = retryMeta?.replyTo || currentReplyingTo?.id || null;
        const rToUser = retryMeta?.replyToUser || currentReplyingTo?.displayName || null;
        const rToContent = (retryMeta?.replyToContent || currentReplyingTo?.content || "")?.toString().substring(0, 50) || null;
        const rToUid = retryMeta?.replyToUid || currentReplyingTo?.uid || null;

        console.log("[Chat] Payload Prepared:", { tempId, rTo, rToUser, rToUid });

        const optimisticMsg: Message = {
            id: tempId,
            uid: user.uid,
            displayName: profile.displayName || "You",
            league: userLeague.name,
            photoURL: user.photoURL,
            content: content,
            createdAt: now,
            type: "text",
            status: "sending",
            replyTo: rTo,
            replyToUser: rToUser,
            replyToContent: rToContent,
            replyToUid: rToUid,
        };

        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const token = await user.getIdToken();
            const payload = {
                channelId,
                content: content,
                messageId: tempId,
                replyTo: rTo,
                replyToUser: rToUser,
                replyToContent: rToContent,
                replyToUid: rToUid,
            };

            console.log("[Chat] Fetching API:", payload);

            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed");
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "sent" } : m));
        } catch (error) {
            console.error("Send failed", error);
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "error" } : m));
        }

        if (currentReplyingTo) setReplyingTo(null);
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/chat?channelId=${channelId}&messageId=${messageId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Delete failed");
            // Removal will happen via RTDB listener
        } catch (error) {
            console.error("Delete failed", error);
        }
    };

    const handleEditMessage = (msg: Message) => {
        setEditingMessage(msg);
        setInput(msg.content);
        inputRef.current?.focus();
    };

    const cancelEditOrReply = () => {
        setEditingMessage(null);
        setReplyingTo(null);
        setInput("");
    };

    return (
        <div className="flex h-screen bg-[#0a0a0a] text-[#e5e5e5] overflow-hidden">
            {/* Discord Sidebar - Collapsible on mobile */}
            <div className={`
                ${showChannels ? "fixed inset-0 z-50 flex" : "hidden sm:flex"}
                w-64 bg-[#121212] border-r border-white/5 flex-col shrink-0 transition-all duration-300
            `}>
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="font-black tracking-tighter text-xl text-blue-500">RELIFE CLUBS</h2>
                    <button className="sm:hidden text-white/40 p-2" onClick={() => setShowChannels(false)}>✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-2 mb-2">Text Channels</div>
                    {CHANNELS.map((ch) => {
                        const isMember = LEAGUE_HIERARCHY.indexOf(userLeague.name) >= LEAGUE_HIERARCHY.indexOf(ch.minLeague) || ["Platinum", "Diamond"].includes(userLeague.name);
                        return (
                            <button
                                key={ch.id}
                                onClick={() => {
                                    setChannelId(ch.id);
                                    if (window.innerWidth < 640) setShowChannels(false);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all group ${channelId === ch.id
                                    ? "bg-white/10 text-white"
                                    : "text-white/40 hover:bg-white/5 hover:text-white/70"}`}
                            >
                                <ch.icon className={`w-4 h-4 ${channelId === ch.id ? "text-blue-400" : "text-white/20 group-hover:text-white/40"}`} />
                                <span className="text-sm font-medium">{ch.name}</span>
                                {!isMember && ch.id !== "general" && (
                                    <Lock className="w-3 h-3 ml-auto text-white/10" />
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 bg-black/20 mt-auto border-t border-white/5">
                    <div className="mb-4 px-2 py-3 bg-white/5 rounded-lg border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Your Status</span>
                            <span className="text-[10px] px-1 bg-blue-500/20 text-blue-400 rounded font-black">{userLeague.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Zap className="w-3 h-3 text-yellow-500" />
                            <span className="text-xs font-bold text-white/60">{profile?.totalGold || 0} Gold</span>
                        </div>
                    </div>

                    <Link href="/dashboard" className="hidden sm:flex items-center gap-2 text-white/40 hover:text-white transition group">
                        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-wider">Back to Dashboard</span>
                    </Link>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col relative min-w-0">
                {/* Header */}
                <header className="h-14 border-b border-white/5 flex items-center px-4 sm:px-6 justify-between bg-[#0a0a0a]/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-2 min-w-0">
                        <button
                            onClick={() => setShowChannels(true)}
                            className="sm:hidden p-2 -ml-2 text-white/40 hover:text-white"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <Hash className="hidden sm:block w-5 h-5 text-white/30" />
                        <h3 className="font-bold text-lg truncate">{currentChannel.name}</h3>
                        <div className="hidden sm:block h-4 w-px bg-white/10 mx-2" />
                        <span className="hidden sm:block text-xs text-white/40 font-medium">Official club for {currentChannel.minLeague}+</span>
                    </div>

                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white transition-all border border-white/5 hover:border-white/10"
                    >
                        <LayoutDashboard className="w-3 h-3" />
                        <span className="hidden sm:inline">Dashboard</span>
                    </Link>
                </header>

                {/* Messages Feed */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto pt-4 sm:pt-6 space-y-0 custom-scrollbar flex flex-col"
                >
                    {/* Welcome Header at the top (Oldest part of history) */}
                    <div className="mb-10 pt-10 px-4 sm:px-8">
                        <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center mb-4">
                            <currentChannel.icon className="w-8 h-8 text-blue-500" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight mb-1">Welcome to #{currentChannel.name}!</h1>
                        <p className="text-white/40">This is the start of the #{currentChannel.name} channel history.</p>
                        <hr className="mt-8 border-white/5" />
                    </div>

                    <AnimatePresence initial={false}>
                        {messages.map((msg, idx) => {
                            const showAvatar = idx === 0 || messages[idx - 1].uid !== msg.uid || (messages[idx - 1].uid === msg.uid && (new Date(msg.createdAt).getTime() - new Date(messages[idx - 1].createdAt).getTime() > 60000));
                            const dir = getDir(msg.content);
                            const cachedUser = userProfiles[msg.uid];
                            const displayPhoto = cachedUser?.photoURL ?? msg.photoURL;
                            const displayLeague = cachedUser?.league ?? msg.league;
                            const displayName = cachedUser?.displayName ?? msg.displayName;
                            const displayFrame = cachedUser?.frame;
                            const LeagueIcon = LEAGUE_ICONS[displayLeague] || Zap;

                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    drag="x"
                                    dragConstraints={{ left: -100, right: 0 }}
                                    dragSnapToOrigin={true}
                                    dragElastic={0.1}
                                    onDragEnd={(_, info) => {
                                        if (info.offset.x < -40) {
                                            setReplyingTo(msg);
                                            inputRef.current?.focus();
                                        }
                                    }}
                                    className={`flex flex-col group ${!showAvatar ? "" : "mt-4"} py-1 px-4 sm:px-8 transition-colors relative touch-pan-y ${msg.replyToUid === user?.uid ? 'bg-[#f0b232]/[0.08]' : 'hover:bg-white/[0.02]'}`}
                                >
                                    {/* Reply Line (Discord style) */}
                                    {msg.replyTo && (
                                        <div
                                            className="absolute left-[34px] sm:left-[50px] top-[14px] w-4 h-5 border-l-2 border-t-2 border-white/10 rounded-tl-lg z-0"
                                            style={{ top: '14px', height: '18px' }}
                                        />
                                    )}

                                    {/* Reply Preview */}
                                    {msg.replyTo && (
                                        <div className="flex items-center gap-2 ml-[54px] sm:ml-[70px] mb-1 opacity-60 relative z-10">
                                            <CornerDownRight className="w-3 h-3 text-white/20" />
                                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 truncate bg-white/5 px-2 py-0.5 rounded">
                                                <span className="font-bold text-white/50">@{msg.replyToUser || "Member"}</span>
                                                <span className="truncate max-w-[200px] italic">{msg.replyToContent}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-4">
                                        {showAvatar ? (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button className="shrink-0 mt-0.5 outline-none">
                                                        <UserAvatar
                                                            src={displayPhoto}
                                                            fallback={displayName}
                                                            league={displayLeague}
                                                            frame={displayFrame}
                                                            size="md"
                                                            className="shadow-lg hover:opacity-80 transition-opacity"
                                                        />
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80 bg-[#121212] border-white/10 p-0 overflow-hidden text-white" side="right" align="start">
                                                    <div className="h-20 bg-blue-600/20 relative" />
                                                    <div className="px-6 pb-6 -mt-10 relative">
                                                        <div className="relative z-10 w-20 h-20 rounded-full border-4 border-[#121212] bg-[#181818] shadow-lg flex items-center justify-center">
                                                            <UserAvatar
                                                                src={displayPhoto}
                                                                fallback={displayName}
                                                                league={displayLeague}
                                                                frame={displayFrame}
                                                                size="lg"
                                                                className="w-full h-full text-2xl"
                                                            />
                                                        </div>
                                                        <div className="mt-3">
                                                            <h3 className="text-xl font-bold mb-0.5">{displayName}</h3>
                                                            <div className="flex items-center gap-1.5 mb-4">
                                                                <LeagueIcon className="w-3.5 h-3.5" style={{ color: LEAGUE_COLORS[displayLeague] }} />
                                                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: LEAGUE_COLORS[displayLeague] }}>
                                                                    {displayLeague} League
                                                                </span>
                                                            </div>
                                                            <div className="h-px bg-white/5 mb-4" />
                                                            <div className="space-y-3 font-mono text-xs text-white/30 truncate select-all bg-white/5 p-2 rounded">
                                                                {msg.uid}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        ) : (
                                            <div className="w-10 shrink-0 text-[10px] text-white/20 font-mono text-center opacity-0 group-hover:opacity-100 mt-1 select-none">
                                                {(() => {
                                                    try {
                                                        const d = new Date(msg.createdAt);
                                                        return isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                    } catch {
                                                        return "--:--";
                                                    }
                                                })()}
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            {showAvatar && (
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span
                                                        className="font-bold text-base text-white hover:underline cursor-pointer"
                                                        style={{ color: LEAGUE_COLORS[displayLeague] }}
                                                    >
                                                        {displayName}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-white/5 text-white/40">
                                                        {(() => {
                                                            try {
                                                                const d = new Date(msg.createdAt);
                                                                return isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                            } catch {
                                                                return "--:--";
                                                            }
                                                        })()}
                                                    </span>
                                                    {msg.status === "sending" && <Loader2 className="w-3 h-3 text-white/20 animate-spin ml-2" />}
                                                    {msg.status === "error" && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setMessages(prev => prev.filter(m => m.id !== msg.id));
                                                                handleSendMessage(e, msg.content, {
                                                                    replyTo: msg.replyTo,
                                                                    replyToUser: msg.replyToUser,
                                                                    replyToContent: msg.replyToContent
                                                                });
                                                            }}
                                                            className="ml-2 text-red-500 hover:text-red-400 flex items-center gap-1 text-[10px] uppercase font-bold"
                                                        >
                                                            <AlertCircle className="w-3 h-3" /> Retry
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <div
                                                className={`text-[15px] leading-relaxed text-white/90 whitespace-pre-wrap break-words ${dir === "rtl" ? "text-right font-arabic" : ""}`}
                                                dir={dir}
                                            >
                                                {msg.content}
                                                {msg.isEdited && <span className="text-[10px] text-white/20 ml-2">(edited)</span>}
                                            </div>
                                        </div>

                                        {/* Action Menu (Discord Style) */}
                                        <div className="absolute right-0 top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all flex items-center bg-[#181818] border border-white/10 rounded-lg shadow-xl overflow-hidden z-20">
                                            <button
                                                onClick={() => {
                                                    setReplyingTo(msg);
                                                    inputRef.current?.focus();
                                                }}
                                                className="p-2 hover:bg-white/5 text-white/40 hover:text-blue-400 transition-colors"
                                                title="Reply"
                                            >
                                                <Reply className="w-4 h-4" />
                                            </button>

                                            {msg.uid === user?.uid && (
                                                <>
                                                    <button
                                                        onClick={() => handleEditMessage(msg)}
                                                        className="p-2 hover:bg-white/5 text-white/40 hover:text-green-400 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteMessage(msg.id)}
                                                        className="p-2 hover:bg-white/5 text-white/40 hover:text-red-400 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[#0a0a0a] border-t border-white/5">
                    {canPost() ? (
                        <form
                            onSubmit={handleSendMessage}
                            className="relative group focus-within:ring-2 ring-blue-500/50 rounded-xl transition-all bg-[#181818] overflow-hidden"
                        >
                            {/* Replying/Editing Bar */}
                            {(replyingTo || editingMessage) && (
                                <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-white/5">
                                    <div className="flex items-center gap-2 text-xs">
                                        {replyingTo ? (
                                            <>
                                                <Reply className="w-3 h-3 text-blue-500" />
                                                <span className="text-white/40">Replying to <span className="font-bold text-white/60">@{replyingTo.displayName}</span></span>
                                            </>
                                        ) : (
                                            <>
                                                <Edit2 className="w-3 h-3 text-green-500" />
                                                <span className="text-white/40">Editing Message</span>
                                            </>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={cancelEditOrReply}
                                        className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <X className="w-3 h-3 text-white/40" />
                                    </button>
                                </div>
                            )}

                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={replyingTo ? `Reply to ${replyingTo.displayName}...` : editingMessage ? "Edit your message..." : `Message #${currentChannel.name}`}
                                className={`w-full bg-transparent border-none p-3.5 pr-12 text-sm text-white placeholder:text-white/30 focus:outline-none ${getDir(input) === "rtl" ? "text-right font-arabic" : ""}`}
                                dir={getDir(input)}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="absolute right-2 bottom-2 p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            >
                                {editingMessage ? <Zap className="w-5 h-5 text-green-500" /> : <Send className="w-5 h-5" />}
                            </button>
                        </form>
                    ) : (
                        <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl flex items-center justify-center gap-2 text-white/40">
                            <Lock className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-widest">Read Only Mode</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar - Presence - Desktop Only */}
            <div className="hidden lg:block shrink-0">
                <PresenceSidebar />
            </div>



            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                    background-color: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(255,255,255,0.05);
                    border-radius: 20px;
                }
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
                .font-arabic {
                    font-family: 'Cairo', sans-serif;
                }
            `}</style>
        </div>
    );
}
