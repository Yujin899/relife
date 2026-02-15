"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Question {
    id: string;
    subjectId: string;
    text: string;
    options: { id: string; text: string }[];
    type?: "single" | "multi";
    correctOptionId?: string;
    correctOptionIds?: string[];
    explanation?: string;
    studyProgress?: {
        box: number;
    };
}

export default function ReviewPage() {
    return (
        <AuthGuard>
            <ReviewContent />
        </AuthGuard>
    );
}

function ReviewContent() {
    const { user } = useAuth();
    const { showNotification } = useNotifications();
    const router = useRouter();

    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
    const [checkedResults, setCheckedResults] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadDueQuestions() {
            if (!user) return;
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/review", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.error) {
                    setError(data.error);
                } else {
                    setQuestions(data.questions || []);
                }
            } catch {
                setError("Failed to load review items");
            } finally {
                setLoading(false);
            }
        }
        loadDueQuestions();
    }, [user]);

    const currentQuestion = questions[currentIndex];
    const totalQuestions = questions.length;
    const isAnswered = currentQuestion && (
        Array.isArray(answers[currentQuestion.id])
            ? (answers[currentQuestion.id] as string[]).length > 0
            : !!answers[currentQuestion.id]
    );
    const isChecked = currentQuestion && checkedResults[currentQuestion.id] !== undefined;

    const handleSelect = (optionId: string) => {
        if (!currentQuestion || isChecked) return;
        const isMulti = currentQuestion.type === "multi";

        setAnswers((prev) => {
            const current = prev[currentQuestion.id];
            if (isMulti) {
                const currentArr = Array.isArray(current) ? current : (current ? [current as string] : []);
                if (currentArr.includes(optionId)) {
                    return { ...prev, [currentQuestion.id]: currentArr.filter(id => id !== optionId) };
                } else {
                    return { ...prev, [currentQuestion.id]: [...currentArr, optionId] };
                }
            } else {
                return { ...prev, [currentQuestion.id]: optionId };
            }
        });
    };

    const handleCheck = () => {
        if (!currentQuestion || !isAnswered || isChecked) return;

        // Verify correct answer
        let isCorrect = false;
        if (currentQuestion.type === "multi") {
            const selected = answers[currentQuestion.id] as string[];
            const correct = currentQuestion.correctOptionIds || [];
            isCorrect = selected.length === correct.length && selected.every(id => correct.includes(id));
        } else {
            isCorrect = answers[currentQuestion.id] === currentQuestion.correctOptionId;
        }

        setCheckedResults(prev => ({ ...prev, [currentQuestion.id]: isCorrect }));
    };

    const handleSubmit = async () => {
        if (!user || Object.keys(checkedResults).length < totalQuestions) return;
        setSubmitting(true);
        setError("");

        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/review", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    results: questions.map(q => ({
                        questionId: q.id,
                        subjectId: q.subjectId,
                        correct: checkedResults[q.id],
                    })),
                }),
            });

            const data = await res.json();
            if (data.error) {
                setError(data.error);
                setSubmitting(false);
            } else {
                showNotification({
                    title: "Review Complete",
                    message: "Your progress has been updated.",
                    type: "success",
                    icon: "📈"
                });
                router.push("/dashboard");
            }
        } catch {
            setError("Failed to sync review results");
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="text-center max-w-sm">
                    <div className="mb-6 opacity-40">
                        <span className="text-6xl">📖</span>
                    </div>
                    <h2 className="text-xl font-bold mb-2">You&apos;re all caught up!</h2>
                    <p className="text-sm text-foreground/50 mb-8">
                        No review items due today. Check back later or complete some quizzes to build your knowledge.
                    </p>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="w-full py-3 rounded-2xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition cursor-pointer"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Progress bar */}
            <div className="h-1 bg-foreground/5">
                <div
                    className="h-full bg-foreground/20 transition-all duration-300"
                    style={{ width: `${Object.keys(checkedResults).length / totalQuestions * 100}%` }}
                />
            </div>

            <div className="max-w-xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="text-sm text-foreground/50 hover:text-foreground transition cursor-pointer"
                    >
                        ← Exit Review
                    </button>
                    <div className="flex flex-col items-end">
                        <span className="text-sm text-foreground/40 font-medium">
                            {currentIndex + 1} of {totalQuestions}
                        </span>
                        {currentQuestion?.studyProgress && (
                            <span className="text-[10px] text-foreground/30 font-bold uppercase tracking-wider">
                                Leitner Box {currentQuestion.studyProgress.box}
                            </span>
                        )}
                    </div>
                </div>

                {/* Question Area */}
                {currentQuestion && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="mb-2">
                            {currentQuestion.type === "multi" && (
                                <span className="inline-block px-2 py-0.5 rounded bg-foreground/5 text-foreground/50 text-[10px] uppercase font-bold tracking-wider mb-2">
                                    Multiple Choice
                                </span>
                            )}
                        </div>
                        <h2 className="text-lg font-semibold mb-6 leading-relaxed">
                            {currentQuestion.text}
                        </h2>

                        <div className="space-y-3">
                            {currentQuestion.options.map((option) => {
                                const ans = answers[currentQuestion.id];
                                const isSelected = Array.isArray(ans) ? ans.includes(option.id) : ans === option.id;

                                const isCorrectAnswer = currentQuestion.type === "multi"
                                    ? currentQuestion.correctOptionIds?.includes(option.id)
                                    : currentQuestion.correctOptionId === option.id;

                                let stateClass = "border-foreground/10 hover:border-foreground/30 hover:bg-foreground/2";
                                if (isSelected) {
                                    stateClass = "border-foreground bg-foreground/5 ring-1 ring-foreground";
                                }

                                if (isChecked) {
                                    if (isCorrectAnswer) {
                                        stateClass = "border-green-500 bg-green-500/10 ring-1 ring-green-500";
                                    } else if (isSelected) {
                                        stateClass = "border-red-500 bg-red-500/10 ring-1 ring-red-500 opacity-60";
                                    } else {
                                        stateClass = "border-foreground/5 opacity-30 grayscale cursor-not-allowed";
                                    }
                                }

                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => handleSelect(option.id)}
                                        disabled={isChecked}
                                        className={`w-full text-left px-4 py-4 rounded-2xl border text-sm transition-all duration-200 cursor-pointer ${stateClass}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? (isChecked ? (isCorrectAnswer ? "bg-green-500 border-green-500" : "bg-red-500 border-red-500") : "bg-foreground border-foreground") : "border-foreground/10"
                                                }`}>
                                                {isSelected && (
                                                    <span className="text-background text-[10px] font-bold">✓</span>
                                                )}
                                                {isChecked && isCorrectAnswer && !isSelected && (
                                                    <span className="text-green-500 text-[10px] font-bold">✓</span>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-foreground/30 mr-2 font-mono text-[10px] uppercase">
                                                    {option.id}
                                                </span>
                                                {option.text}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Explanation Area */}
                        {isChecked && (
                            <div className="mt-8 p-6 rounded-2xl bg-foreground/2 border border-foreground/5 animate-in zoom-in-95 duration-500">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${checkedResults[currentQuestion.id] ? "text-green-500" : "text-red-500"}`}>
                                        {checkedResults[currentQuestion.id] ? "Correct! Next progress: Box " + (Math.min(currentQuestion.studyProgress?.box || 1 + 1, 4)) : "Incorrect. Reset to Box 1"}
                                    </span>
                                </div>
                                <p className="text-sm leading-relaxed italic text-foreground/70">
                                    &quot;{currentQuestion.explanation || "No explanation provided for this question."}&quot;
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation & Actions */}
                <div className="flex items-center justify-between mt-10">
                    <button
                        onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                        disabled={currentIndex === 0}
                        className="px-6 py-2.5 rounded-xl text-sm font-medium text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition disabled:opacity-30 cursor-pointer"
                    >
                        Previous
                    </button>

                    <div className="flex gap-3">
                        {isAnswered && !isChecked && (
                            <button
                                onClick={handleCheck}
                                className="px-8 py-2.5 rounded-xl border border-foreground font-medium text-sm hover:bg-foreground hover:text-background transition transform active:scale-95 cursor-pointer"
                            >
                                Check
                            </button>
                        )}

                        {isChecked && (
                            <>
                                {currentIndex < totalQuestions - 1 ? (
                                    <button
                                        onClick={() => setCurrentIndex(currentIndex + 1)}
                                        className="px-8 py-2.5 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition transform active:scale-95 cursor-pointer"
                                    >
                                        Next Item
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                        className="px-8 py-2.5 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition disabled:opacity-50 transform active:scale-95 cursor-pointer"
                                    >
                                        {submitting ? "Saving..." : "Finish Review"}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mt-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-red-500 text-center font-medium">
                            {error}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
