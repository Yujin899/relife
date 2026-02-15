"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getLeague } from "@/lib/leagues";
import UserAvatar from "@/components/UserAvatar";
import BottomNav from "@/components/BottomNav";
import { ChevronLeft, Trophy, Crown, TrendingUp, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LeaderboardEntry {
    rank: number;
    uid: string;
    displayName: string;
    totalGold: number;
    isCurrentUser: boolean;
    photoURL?: string;
    frame?: string;
}

const LEADERBOARD_TABS = [
    { id: "all", name: "All-time" },
    { id: "weekly", name: "Weekly" },
    { id: "subject", name: "By Subject" },
];

export default function LeaderboardPage() {
    return (
        <AuthGuard>
            <LeaderboardContent />
        </AuthGuard>
    );
}

function LeaderboardContent() {
    const { user } = useAuth();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [userRank, setUserRank] = useState(0);
    const [userGold, setUserGold] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("all");
    const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState("");

    useEffect(() => {
        async function fetchSubjects() {
            try {
                const res = await fetch("/api/subjects");
                const data = await res.json();
                const subjList = data.subjects || [];
                setSubjects(subjList);
                if (subjList.length > 0) setSelectedSubjectId(subjList[0].id);
            } catch { /* Ignore */ }
        }
        fetchSubjects();
    }, []);

    const loadLeaderboard = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await user.getIdToken();
            let url = `/api/leaderboard?tab=${activeTab}`;
            if (activeTab === "subject" && selectedSubjectId) {
                url += `&subjectId=${selectedSubjectId}`;
            }
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setEntries(data.leaderboard || []);
            setUserRank(data.userRank || 0);
            setUserGold(data.userGold || 0);
        } catch { /* Silent fail */ }
        finally { setLoading(false); }
    }, [user, activeTab, selectedSubjectId]);

    useEffect(() => {
        loadLeaderboard();
    }, [loadLeaderboard]);

    const userLeague = getLeague(userGold);

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="border-b border-foreground/10 px-6 py-5 bg-background/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="p-2 hover:bg-foreground/5 rounded-full transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-black tracking-tight uppercase italic flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-amber-500" />
                                Arena Standings
                            </h1>
                            <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-[0.2em]">Global Rank & Competition</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-6 py-8">
                <div className="flex gap-2 p-1 bg-foreground/5 rounded-2xl mb-8 relative z-10 border border-foreground/5">
                    {LEADERBOARD_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                relative flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all
                                ${activeTab === tab.id
                                    ? "bg-foreground text-background shadow-xl"
                                    : "text-foreground/40 hover:text-foreground/60"
                                }
                            `}
                        >
                            {tab.name}
                        </button>
                    ))}
                </div>

                {activeTab === "subject" && subjects.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <select
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(e.target.value)}
                            className="w-full p-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition appearance-none cursor-pointer"
                        >
                            {subjects.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </motion.div>
                )}

                {loading ? (
                    <div className="py-20 flex justify-center">
                        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Your Rank Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-6 rounded-[2.5rem] bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 shadow-xl shadow-blue-500/5 relative overflow-hidden group"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12">
                                <TrendingUp className="w-32 h-32" />
                            </div>

                            <div className="flex items-center gap-5 relative z-10">
                                <div className="text-3xl font-black italic tracking-tighter text-blue-500 w-12 text-center">
                                    {userRank > 0 ? `#${userRank}` : "—"}
                                </div>
                                <UserAvatar
                                    src={user?.photoURL}
                                    fallback={user?.displayName || "Y"}
                                    league={userLeague.name}
                                    frame={entries.find(e => e.uid === user?.uid)?.frame}
                                    size="lg"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-black text-lg italic uppercase tracking-tight">You</p>
                                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-blue-500 text-white uppercase">Your Position</span>
                                    </div>
                                    <p className="text-[10px] text-foreground/40 font-black uppercase tracking-widest">
                                        {userLeague.name} League &bull; {userGold?.toLocaleString() || 0} G
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Leaderboard Entries */}
                        <div className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {entries.map((entry, i) => {
                                    const league = getLeague(entry.totalGold);
                                    const isTopThree = entry.rank <= 3;

                                    return (
                                        <motion.div
                                            key={entry.uid}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className={`
                                                flex items-center gap-4 px-6 py-4 rounded-2xl transition-all group relative overflow-hidden
                                                ${entry.isCurrentUser
                                                    ? "bg-foreground text-background"
                                                    : isTopThree
                                                        ? "bg-amber-500/5 border border-amber-500/10"
                                                        : "hover:bg-foreground/[0.03]"
                                                }
                                            `}
                                        >
                                            <div className={`
                                                text-lg font-black italic w-10 text-center shrink-0
                                                ${isTopThree && !entry.isCurrentUser ? "text-amber-500" : entry.isCurrentUser ? "text-background/40" : "text-foreground/10"}
                                            `}>
                                                #{entry.rank}
                                            </div>

                                            <UserAvatar src={entry.photoURL} fallback={entry.displayName} league={league.name} frame={entry.frame} size="sm" />

                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-black uppercase italic tracking-tight truncate ${entry.isCurrentUser ? "text-background" : "text-foreground"}`}>
                                                    {entry.displayName}
                                                </p>
                                                <p className={`text-[9px] font-bold uppercase tracking-widest ${entry.isCurrentUser ? "text-background/40" : "text-foreground/30"}`}>
                                                    {league.name} League
                                                </p>
                                            </div>

                                            <div className="flex flex-col items-end shrink-0">
                                                <div className={`flex items-center gap-1.5 font-black italic ${entry.isCurrentUser ? "text-background" : "text-foreground"}`}>
                                                    {isTopThree && !entry.isCurrentUser && <Crown className="w-3 h-3 text-amber-500" />}
                                                    {entry.totalGold?.toLocaleString() || 0}
                                                </div>
                                                <span className={`text-[8px] font-black uppercase ${entry.isCurrentUser ? "text-background/30" : "text-foreground/20"}`}>Credits</span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>

                        {entries.length === 0 && (
                            <div className="text-center py-20 bg-foreground/[0.02] rounded-[2.5rem] border border-foreground/5">
                                <Sparkles className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
                                <h2 className="text-lg font-black uppercase italic tracking-tight mb-1">Deserted Path</h2>
                                <p className="text-xs text-foreground/40 font-medium">No champions have claimed this territory yet.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
            <BottomNav />
        </div>
    );
}
