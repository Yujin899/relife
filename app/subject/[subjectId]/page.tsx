"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Lock, ChevronLeft } from "lucide-react";
import BottomNav from "@/components/BottomNav";

interface Quiz {
    id: string;
    title: string;
    description: string;
    questionCount: number;
    completed: boolean;
}

export default function SubjectPage() {
    return (
        <AuthGuard>
            <SubjectContent />
        </AuthGuard>
    );
}

function SubjectContent() {
    const { user } = useAuth();
    const params = useParams();
    const router = useRouter();
    const subjectId = params.subjectId as string;

    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [subjectName, setSubjectName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            if (!user) return;

            try {
                const token = await user.getIdToken();

                // Fetch quizzes for this subject
                const res = await fetch(`/api/subjects/${subjectId}/quizzes`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.error) {
                    setError(data.error);
                } else {
                    setQuizzes(data.quizzes || []);
                }

                // Fetch subject name
                const subjectsRes = await fetch("/api/subjects");
                const subjectsData = await subjectsRes.json();
                const subject = (subjectsData.subjects || []).find(
                    (s: { id: string; name: string }) => s.id === subjectId
                );
                if (subject) setSubjectName(subject.name);
            } catch {
                setError("Failed to load quizzes");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user, subjectId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

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
                        <h1 className="text-xl font-black tracking-tight">{subjectName || subjectId}</h1>
                        <p className="text-xs text-foreground/40 font-bold uppercase tracking-widest mt-0.5">Quiz Map</p>
                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto px-6 py-12 relative">
                {error ? (
                    <div className="text-center py-12">
                        <p className="text-sm text-red-500 font-bold">{error}</p>
                    </div>
                ) : quizzes.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-foreground/30 text-sm font-medium">No quizzes available yet.</p>
                    </div>
                ) : (
                    <div className="relative flex flex-col items-center">
                        {/* Winding Vertical Path SVG */}
                        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0" style={{ minHeight: quizzes.length * 150 }}>
                            <path
                                d={`M 200 50 ${quizzes.map((_, i) => {
                                    const x = 200 + (i % 2 === 0 ? 60 : -60);
                                    const y = 50 + i * 150;
                                    return `L ${x} ${y}`;
                                }).join(" ")}`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeDasharray="8 8"
                                className="text-foreground/10"
                            />
                        </svg>

                        <div className="w-full space-y-20 relative z-10">
                            {quizzes.map((quiz, index) => {
                                const isLocked = index > 0 && !quizzes[index - 1].completed;
                                const isAccessible = !isLocked;

                                return (
                                    <motion.div
                                        key={quiz.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        className="flex flex-col items-center"
                                        style={{
                                            transform: `translateX(${index % 2 === 0 ? "40px" : "-40px"})`
                                        }}
                                    >
                                        <Link
                                            href={isAccessible ? `/quiz/${quiz.id}` : "#"}
                                            className={`
                                                relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl
                                                ${quiz.completed
                                                    ? "bg-green-500 border-4 border-green-600/50 shadow-green-500/20"
                                                    : isAccessible
                                                        ? "bg-foreground text-background border-4 border-foreground/20 hover:scale-110 active:scale-95"
                                                        : "bg-foreground/10 border-4 border-foreground/5 text-foreground/20 cursor-not-allowed"
                                                }
                                            `}
                                        >
                                            {quiz.completed ? (
                                                <Check className="w-10 h-10 text-white stroke-[4]" />
                                            ) : isLocked ? (
                                                <Lock className="w-8 h-8" />
                                            ) : (
                                                <span className="text-2xl font-black">{index + 1}</span>
                                            )}

                                            {isAccessible && !quiz.completed && (
                                                <div className="absolute -inset-2 rounded-full border-2 border-foreground animate-ping opacity-20 pointer-events-none" />
                                            )}
                                        </Link>

                                        <div className="mt-4 text-center max-w-[160px]">
                                            <h3 className={`text-base font-black tracking-tight leading-tight ${isLocked ? "text-foreground/20" : "text-foreground"}`}>
                                                {quiz.title}
                                            </h3>
                                            <p className="text-[11px] text-foreground/40 font-bold mt-1 uppercase tracking-wider">
                                                {quiz.questionCount} Questions
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
            <BottomNav />
        </div>
    );
}
