"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Mistake {
    id: string;
    questionText: string;
    options: { id: string; text: string }[];
    userAnswer: string;
    correctAnswer: string;
    explanation?: string;
    occurredAt: { _seconds: number };
}

export default function SubjectMistakesPage() {
    return (
        <AuthGuard>
            <SubjectMistakesContent />
        </AuthGuard>
    );
}

function SubjectMistakesContent() {
    const { user } = useAuth();
    const params = useParams();
    const subjectId = params.subjectId as string;

    const [mistakes, setMistakes] = useState<Mistake[]>([]);
    const [loading, setLoading] = useState(true);
    const [subjectName, setSubjectName] = useState(subjectId);

    useEffect(() => {
        async function load() {
            if (!user) return;

            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/mistakes?subjectId=${subjectId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                setMistakes(data.mistakes || []);

                // Get subject name
                const subjectsRes = await fetch("/api/subjects");
                const subjectsData = await subjectsRes.json();
                const subject = (subjectsData.subjects || []).find(
                    (s: { id: string; name: string }) => s.id === subjectId
                );
                if (subject) setSubjectName(subject.name);
            } catch {
                // Silent fail
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
        <div className="min-h-screen bg-background">
            <header className="border-b border-foreground/10 px-4 py-3">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <Link
                        href="/mistakes"
                        className="text-sm text-foreground/50 hover:text-foreground transition"
                    >
                        ← Mistakes
                    </Link>
                    <h1 className="text-lg font-bold tracking-tight">{subjectName}</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
                {mistakes.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-foreground/50 text-sm">No mistakes in this subject.</p>
                    </div>
                ) : (
                    mistakes.map((m, i) => (
                        <div
                            key={m.id || i}
                            className="p-4 rounded-xl border border-foreground/10"
                        >
                            <p className="text-sm font-medium mb-3">{m.questionText}</p>
                            <div className="space-y-1.5">
                                {m.options.map((opt) => {
                                    const userAnswers = (m.userAnswer || "").split(",");
                                    const correctAnswers = (m.correctAnswer || "").split(",");

                                    const isUserPicked = userAnswers.includes(opt.id);
                                    const isCorrect = correctAnswers.includes(opt.id);

                                    let borderColor = "border-foreground/10";
                                    let bgColor = "";
                                    let textColor = "text-foreground/40";
                                    let label = null;

                                    if (isCorrect) {
                                        borderColor = "border-green-500/20";
                                        bgColor = "bg-green-500/5";
                                        textColor = "text-green-600";
                                        label = isUserPicked ? "Correct" : "Missed";
                                    } else if (isUserPicked) {
                                        borderColor = "border-red-500/20";
                                        bgColor = "bg-red-500/5";
                                        textColor = "text-red-500";
                                        label = "Incorrect";
                                    }

                                    return (
                                        <div
                                            key={opt.id}
                                            className={`px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 border transition-colors ${borderColor} ${bgColor} ${textColor}`}
                                        >
                                            <span className="font-mono uppercase w-4 shrink-0">{opt.id}</span>
                                            <span className="flex-1">{opt.text}</span>
                                            {label && (
                                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${label === "Correct" ? "bg-green-500/10" :
                                                    label === "Missed" ? "bg-amber-500/10 text-amber-600" :
                                                        "bg-red-500/10"
                                                    }`}>
                                                    {label}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {m.explanation && (
                                <div className="mt-4 p-4 rounded-xl border border-dashed border-foreground/10 bg-foreground/1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 mb-1.5">Learning Moment</p>
                                    <p className="text-sm text-foreground/70 leading-relaxed italic">
                                        &quot;{m.explanation}&quot;
                                    </p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </main>
        </div>
    );
}
