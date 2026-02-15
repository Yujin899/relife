"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import Link from "next/link";

interface SubjectMistakes {
    subjectId: string;
    count: number;
}

export default function MistakesPage() {
    return (
        <AuthGuard>
            <MistakesContent />
        </AuthGuard>
    );
}

function MistakesContent() {
    const { user } = useAuth();
    const [subjects, setSubjects] = useState<SubjectMistakes[]>([]);
    const [loading, setLoading] = useState(true);
    const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});

    useEffect(() => {
        async function load() {
            if (!user) return;

            try {
                const token = await user.getIdToken();

                // Fetch mistakes counts
                const mistakesRes = await fetch("/api/mistakes", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const mistakesData = await mistakesRes.json();

                const counts = mistakesData.subjectCounts || {};
                const subjectList = Object.entries(counts).map(([subjectId, count]) => ({
                    subjectId,
                    count: count as number,
                }));
                setSubjects(subjectList);

                // Fetch subject names
                const subjectsRes = await fetch("/api/subjects");
                const subjectsData = await subjectsRes.json();
                const names: Record<string, string> = {};
                for (const s of subjectsData.subjects || []) {
                    names[s.id] = s.name;
                }
                setSubjectNames(names);
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

    import { ChevronLeft, ShieldAlert, BookOpen, AlertCircle } from "lucide-react";
    import { motion } from "framer-motion";

    export default function MistakesPage() {
        return (
            <AuthGuard>
                <MistakesContent />
            </AuthGuard>
        );
    }

    function MistakesContent() {
        const { user } = useAuth();
        const [subjects, setSubjects] = useState<SubjectMistakes[]>([]);
        const [loading, setLoading] = useState(true);
        const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});

        useEffect(() => {
            async function load() {
                if (!user) return;

                try {
                    const token = await user.getIdToken();

                    // Fetch mistakes counts
                    const mistakesRes = await fetch("/api/mistakes", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const mistakesData = await mistakesRes.json();

                    const counts = mistakesData.subjectCounts || {};
                    const subjectList = Object.entries(counts).map(([subjectId, count]) => ({
                        subjectId,
                        count: count as number,
                    }));
                    setSubjects(subjectList);

                    // Fetch subject names
                    const subjectsRes = await fetch("/api/subjects");
                    const subjectsData = await subjectsRes.json();
                    const names: Record<string, string> = {};
                    for (const s of subjectsData.subjects || []) {
                        names[s.id] = s.name;
                    }
                    setSubjectNames(names);
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

        return (
            <div className="min-h-screen bg-background pb-20">
                <header className="border-b border-foreground/10 px-6 py-5 bg-background/50 backdrop-blur-xl sticky top-0 z-50">
                    <div className="max-w-2xl mx-auto flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="p-2 hover:bg-foreground/5 rounded-full transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-black tracking-tight uppercase italic flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-red-500" />
                                Mistakes Review
                            </h1>
                            <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-[0.2em]">Analyze and Overcome</p>
                        </div>
                    </div>
                </header>

                <main className="max-w-2xl mx-auto px-6 py-8">
                    {subjects.length === 0 ? (
                        <div className="text-center py-20 bg-foreground/[0.02] rounded-[2.5rem] border border-foreground/5">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4"
                            >
                                <ShieldAlert className="w-8 h-8 text-green-500 opacity-20" />
                            </motion.div>
                            <h2 className="text-lg font-black uppercase italic tracking-tight mb-1">Clear Horizon</h2>
                            <p className="text-xs text-foreground/40 font-medium">No active mistakes detected. Excellent work.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {subjects.map((s, i) => (
                                <motion.div
                                    key={s.subjectId}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Link
                                        href={`/mistakes/${s.subjectId}`}
                                        className="block p-6 rounded-[2rem] border border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.04] hover:border-red-500/20 transition-all group relative overflow-hidden shadow-sm"
                                    >
                                        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                            <AlertCircle className="w-12 h-12" />
                                        </div>

                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                                                    <BookOpen className="w-5 h-5 text-red-500" />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-sm uppercase italic tracking-tight">
                                                        {subjectNames[s.subjectId] || s.subjectId}
                                                    </h3>
                                                    <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest">Subject Analysis</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-xl font-black text-red-500 italic tracking-tighter">
                                                    {s.count}
                                                </span>
                                                <span className="text-[8px] font-black uppercase text-red-500/40 tracking-tighter">Mistakes</span>
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        );
    }
