"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Question {
    id: string;
    quizId: string;
    subjectId: string;
    text: string;
    options: { id: string; text: string }[];
    type?: "single" | "multi";
    correctOptionId?: string;
    correctOptionIds?: string[];
    explanation?: string;
}

export default function QuizPage() {
    return (
        <AuthGuard>
            <QuizContent />
        </AuthGuard>
    );
}

function QuizContent() {
    const { user } = useAuth();
    const { showNotification } = useNotifications();
    const params = useParams();
    const router = useRouter();
    const quizId = params.quizId as string;

    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Immediate Feedback states
    const [checkedQuestions, setCheckedQuestions] = useState<Set<string>>(new Set());

    useEffect(() => {
        async function loadQuestions() {
            if (!user) return;
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/questions?quizId=${quizId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.error) {
                    setError(data.error);
                } else {
                    setQuestions(data.questions || []);
                }
            } catch {
                setError("Failed to load questions");
            } finally {
                setLoading(false);
            }
        }
        loadQuestions();
    }, [user, quizId]);

    const currentQuestion = questions[currentIndex];
    const totalQuestions = questions.length;
    const isAnswered = currentQuestion && (
        Array.isArray(answers[currentQuestion.id])
            ? answers[currentQuestion.id].length > 0
            : !!answers[currentQuestion.id]
    );
    const isChecked = currentQuestion && checkedQuestions.has(currentQuestion.id);

    const answeredCount = questions.filter(q => {
        const a = answers[q.id];
        return Array.isArray(a) ? a.length > 0 : !!a;
    }).length;

    const allAnswered = answeredCount === totalQuestions;

    const handleSelect = (optionId: string) => {
        if (!currentQuestion || isChecked) return;
        const isMulti = currentQuestion.type === "multi";

        setAnswers((prev) => {
            const current = prev[currentQuestion.id];

            if (isMulti) {
                const currentArr = Array.isArray(current) ? current : (current ? [current] : []);
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
        setCheckedQuestions(prev => new Set([...prev, currentQuestion.id]));
    };

    const handleSubmit = async () => {
        if (!user || !allAnswered) return;
        setSubmitting(true);
        setError("");

        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/quiz/submit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    quizId,
                    answers: Object.entries(answers).map(([questionId, selectedOptionId]) => ({
                        questionId,
                        selectedOptionId,
                    })),
                }),
            });

            const data = await res.json();
            if (data.error) {
                setError(data.error);
                setSubmitting(false);
            } else {
                showNotification({
                    title: "Quiz Completed",
                    message: `You earned ${data.goldEarned.total} gold!`,
                    type: "success",
                    icon: "🪙"
                });

                if (data.newBadges && data.newBadges.length > 0) {
                    data.newBadges.forEach((badge: { name: string; icon?: string }) => {
                        showNotification({
                            title: "Achievement Unlocked!",
                            message: badge.name,
                            type: "badge",
                            icon: badge.icon || "🏆"
                        });
                    });
                }

                if (data.questsCompleted > 0) {
                    showNotification({
                        title: "Quest Completed",
                        message: `Completed ${data.questsCompleted} quests!`,
                        type: "info",
                        icon: "⚔️"
                    });
                }

                router.push(`/results/${data.attemptId}`);
            }
        } catch {
            setError("Failed to submit quiz");
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

    if (error && questions.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="text-center">
                    <p className="text-sm text-red-500 mb-4">{error}</p>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="text-sm text-foreground/50 hover:text-foreground transition cursor-pointer"
                    >
                        ← Back to Dashboard
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
                    style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                />
            </div>

            <div className="max-w-xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="text-sm text-foreground/50 hover:text-foreground transition cursor-pointer"
                    >
                        ← Exit
                    </button>
                    <span className="text-sm text-foreground/40 font-medium">
                        Question {currentIndex + 1} of {totalQuestions}
                    </span>
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
                                <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 mb-2">Learning Insight</p>
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

                        {(isChecked || !isAnswered) && (
                            <>
                                {currentIndex < totalQuestions - 1 ? (
                                    <button
                                        onClick={() => setCurrentIndex(currentIndex + 1)}
                                        className="px-8 py-2.5 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition transform active:scale-95 cursor-pointer"
                                    >
                                        Next
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!allAnswered || submitting}
                                        className="px-8 py-2.5 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition disabled:opacity-50 transform active:scale-95 cursor-pointer"
                                    >
                                        {submitting ? "Submitting..." : `Finish (${answeredCount}/${totalQuestions})`}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Question dots */}
                <div className="flex items-center justify-center gap-1.5 mt-8">
                    {questions.map((q, i) => {
                        const a = answers[q.id];
                        const checked = checkedQuestions.has(q.id);
                        const hasAns = Array.isArray(a) ? a.length > 0 : !!a;

                        return (
                            <button
                                key={q.id}
                                onClick={() => setCurrentIndex(i)}
                                className={`w-2.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer ${i === currentIndex
                                    ? "bg-foreground w-6"
                                    : checked
                                        ? "bg-foreground/60"
                                        : hasAns
                                            ? "bg-foreground/30"
                                            : "bg-foreground/10"
                                    }`}
                            />
                        );
                    })}
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
