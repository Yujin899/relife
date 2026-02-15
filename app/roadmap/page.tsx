"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles, Calendar, BookOpen, Star, Trophy } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function RoadmapPage() {
    return (
        <AuthGuard>
            <RoadmapContent />
        </AuthGuard>
    );
}

function RoadmapContent() {
    const { user } = useAuth();
    const router = useRouter();
    const [currentWeek, setCurrentWeek] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            if (!user) return;
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const start = data.createdAt?.toDate?.() || new Date(data.createdAt) || new Date();
                    const now = new Date();
                    const weeksJoined = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
                    setCurrentWeek(Math.min(12, weeksJoined));
                }
            } catch (error) {
                console.error("Failed to load user progress:", error);
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

    const phases = [
        { start: 1, end: 4, title: "Foundation", color: "blue", desc: "Building core habits." },
        { start: 5, end: 8, title: "Acceleration", color: "purple", desc: "Deepening expertise." },
        { start: 9, end: 12, title: "Mastery", color: "amber", desc: "Reaching legend status." },
    ];

    return (
        <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
            <header className="border-b border-foreground/10 px-4 py-4 bg-background/80 backdrop-blur-md sticky top-0 z-20">
                <div className="max-w-2xl mx-auto flex items-center gap-4">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="p-2 hover:bg-foreground/5 rounded-full transition"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black tracking-tight uppercase">Quest Roadmap</h1>
                        <p className="text-xs text-foreground/40 font-bold uppercase tracking-widest mt-0.5">Your 12-Week Journey</p>
                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto px-6 py-12 relative">
                <div className="relative flex flex-col items-center">
                    {/* Roadmap Path SVG */}
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0" style={{ minHeight: 12 * 120 }}>
                        <path
                            d={`M 200 50 ${Array.from({ length: 12 }).map((_, i) => {
                                const x = 200 + (i % 2 === 0 ? 60 : -60);
                                const y = 50 + i * 120;
                                return `L ${x} ${y}`;
                            }).join(" ")}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeDasharray="8 8"
                            className="text-foreground/10"
                        />
                    </svg>

                    <div className="w-full space-y-12 relative z-10">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((week) => {
                            const isPast = week < currentWeek;
                            const isCurrent = week === currentWeek;
                            const phase = phases.find(p => week >= p.start && week <= p.end);

                            return (
                                <motion.div
                                    key={week}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    className="flex flex-col items-center"
                                    style={{
                                        transform: `translateX(${week % 2 !== 0 ? "40px" : "-40px"})`
                                    }}
                                >
                                    <div className="relative">
                                        <div
                                            className={`
                                                relative w-20 h-20 rounded-3xl flex flex-col items-center justify-center transition-all duration-500 shadow-xl
                                                ${isPast
                                                    ? "bg-blue-500 text-white shadow-blue-500/20"
                                                    : isCurrent
                                                        ? "bg-foreground text-background ring-4 ring-blue-500/30 scale-110"
                                                        : "bg-foreground/5 text-foreground/20"
                                                }
                                            `}
                                        >
                                            <span className="text-[10px] font-black uppercase opacity-60">Week</span>
                                            <span className="text-3xl font-black">{week}</span>

                                            {isCurrent && (
                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-background animate-bounce" />
                                            )}
                                        </div>

                                        {isCurrent && (
                                            <div className="absolute -inset-4 rounded-3xl border-2 border-blue-500/30 animate-pulse pointer-events-none" />
                                        )}
                                    </div>

                                    {/* Phase Label for the start of each phase */}
                                    {week === phase?.start && (
                                        <div className="mt-4 px-3 py-1 bg-foreground/5 rounded-full border border-foreground/10">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-foreground/40 italic">
                                                {phase.title} Phase
                                            </span>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-20 p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 text-center space-y-3">
                    <Trophy className="w-8 h-8 text-blue-500 mx-auto" />
                    <h2 className="text-lg font-black uppercase italic tracking-tight text-blue-500">The Path to Legend</h2>
                    <p className="text-xs text-foreground/60 font-medium leading-relaxed">
                        Completing the 12-week roadmap unlocks the **Legendary** status and exclusive veteran rewards.
                    </p>
                </div>
            </main>

            <BottomNav />
        </div>
    );
}
