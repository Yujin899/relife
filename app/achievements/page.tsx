"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    earned: boolean;
    earnedAt: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
    quiz: "Quiz Milestones",
    score: "Perfect Scores",
    streak: "Streaks",
    gold: "Gold & Leagues",
    exploration: "Exploration",
    quest: "Quest Mastery",
};

const CATEGORY_ORDER = ["quiz", "score", "streak", "gold", "exploration", "quest"];

import { ChevronLeft, Award, Sparkles } from "lucide-react";
import LucideIcon from "@/components/LucideIcon";
import { motion } from "framer-motion";

export default function AchievementsPage() {
    return (
        <AuthGuard>
            <AchievementsContent />
        </AuthGuard>
    );
}

function AchievementsContent() {
    const { user } = useAuth();
    const [badges, setBadges] = useState<Badge[]>([]);
    const [totalEarned, setTotalEarned] = useState(0);
    const [totalBadges, setTotalBadges] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            if (!user) return;
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/achievements", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                setBadges(data.badges || []);
                setTotalEarned(data.totalEarned || 0);
                setTotalBadges(data.totalBadges || 0);
            } catch {
                // Silent fail
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    // Group badges by category
    const grouped = CATEGORY_ORDER.map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        badges: badges.filter((b) => b.category === cat),
    })).filter((g) => g.badges.length > 0);

    const earnedPercent = totalBadges > 0 ? Math.round((totalEarned / totalBadges) * 100) : 0;

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="border-b border-foreground/10 px-6 py-5 bg-background/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="p-2 hover:bg-foreground/5 rounded-full transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight uppercase italic flex items-center gap-2">
                                <Award className="w-6 h-6 text-amber-500" />
                                Hall of Fame
                            </h1>
                            <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-[0.2em]">Your Achievements & Milestones</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-10">
                {/* Progress overview */}
                <section className="mb-12 relative overflow-hidden p-8 rounded-[2.5rem] bg-foreground/2 border border-foreground/5">
                    <div className="absolute top-0 right-0 p-10 opacity-[0.03] scale-[2] pointer-events-none">
                        <Sparkles className="w-32 h-32" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-end justify-between mb-4">
                            <div>
                                <span className="text-4xl font-black italic tracking-tighter">{totalEarned}</span>
                                <span className="text-sm font-bold text-foreground/30 uppercase tracking-widest ml-2">/ {totalBadges} Badges</span>
                            </div>
                            <span className="text-sm font-black text-amber-500 italic uppercase">{earnedPercent}% Mastery</span>
                        </div>
                        <div className="h-3 bg-foreground/5 rounded-full overflow-hidden p-0.5 border border-foreground/5">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${earnedPercent}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                            />
                        </div>
                    </div>
                </section>

                {/* Badge categories */}
                <div className="space-y-16">
                    {grouped.map((group) => (
                        <section key={group.category}>
                            <h2 className="text-xs font-black text-foreground/30 mb-6 uppercase tracking-[0.3em] flex items-center gap-3">
                                <div className="h-[1px] flex-1 bg-foreground/5" />
                                {group.label}
                                <div className="h-[1px] flex-1 bg-foreground/5" />
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                {group.badges.map((badge) => (
                                    <motion.div
                                        key={badge.id}
                                        whileHover={{ y: -5 }}
                                        className={`
                                            relative p-6 rounded-[2rem] border transition-all duration-500 group overflow-hidden
                                            ${badge.earned
                                                ? "border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] to-transparent shadow-xl shadow-amber-900/5"
                                                : "border-foreground/5 bg-foreground/[0.02] opacity-40 grayscale"
                                            }
                                        `}
                                    >
                                        {/* Background Glow */}
                                        {badge.earned && (
                                            <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/10 blur-[40px] rounded-full group-hover:bg-amber-500/20 transition-all" />
                                        )}

                                        <div className="relative z-10 flex flex-col items-center">
                                            <div className={`
                                                w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110
                                                ${badge.earned
                                                    ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/20"
                                                    : "bg-foreground/5 text-foreground/20"
                                                }
                                            `}>
                                                <LucideIcon name={badge.icon} className="w-8 h-8" strokeWidth={2.5} />
                                            </div>

                                            <h3 className="text-sm font-black tracking-tight mb-1 text-center line-clamp-1">{badge.name}</h3>
                                            <p className="text-[10px] text-foreground/40 font-bold leading-tight text-center h-8 flex items-center">
                                                {badge.description}
                                            </p>

                                            {badge.earned && (
                                                <div className="mt-4 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/10">
                                                    <span className="text-[9px] font-black uppercase text-amber-600 tracking-tighter">Unlocked</span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                {totalEarned === 0 && (
                    <div className="text-center py-12">
                        <p className="text-4xl mb-3">🏅</p>
                        <p className="text-foreground/50 text-sm">
                            Complete quizzes and activities to earn badges!
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
