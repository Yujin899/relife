"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";


interface AttemptResult {
    id: string;
    score: number;
    totalQuestions: number;
    goldEarned: number;
    goldBreakdown: {
        base: number;
        perfectBonus: number;
        dailyBonus: number;
        streakBonus: number;
    };
}

export default function ResultsPage() {
    return (
        <AuthGuard>
            <ResultsContent />
        </AuthGuard>
    );
}

function ResultsContent() {
    const { user } = useAuth();
    const params = useParams();
    const router = useRouter();
    const attemptId = params.attemptId as string;

    const [result, setResult] = useState<AttemptResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadResult() {
            if (!user) return;
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/results/${attemptId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.error) {
                    setError(data.error);
                } else {
                    setResult(data.attempt);
                }
            } catch {
                setError("Failed to load results");
            } finally {
                setLoading(false);
            }
        }
        loadResult();
    }, [user, attemptId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !result) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="text-center">
                    <p className="text-sm text-red-500 mb-4">{error || "Result not found"}</p>
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

    const percentage = Math.round((result.score / result.totalQuestions) * 100);
    const isPerfect = result.score === result.totalQuestions;

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
            <div className="w-full max-w-sm text-center">
                {/* Score */}
                <div className="mb-8">
                    <div className="text-6xl font-bold mb-2">
                        {result.score}/{result.totalQuestions}
                    </div>
                    <p className="text-foreground/50 text-sm">
                        {isPerfect
                            ? "Perfect score!"
                            : percentage >= 70
                                ? "Good work!"
                                : "Keep studying!"}
                    </p>
                    <p className="text-foreground/30 text-xs mt-1">{percentage}% accuracy</p>
                </div>

                {/* Gold Breakdown */}
                <div className="p-4 rounded-xl border border-foreground/10 bg-foreground/2 mb-6 text-left">
                    <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3">
                        Gold Earned
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-foreground/60">Base ({result.score} × 10)</span>
                            <span className="font-medium">+{result.goldBreakdown.base}</span>
                        </div>
                        {result.goldBreakdown.perfectBonus > 0 && (
                            <div className="flex justify-between">
                                <span className="text-foreground/60">Perfect bonus</span>
                                <span className="font-medium text-gold">+{result.goldBreakdown.perfectBonus}</span>
                            </div>
                        )}
                        {result.goldBreakdown.dailyBonus > 0 && (
                            <div className="flex justify-between">
                                <span className="text-foreground/60">Daily bonus</span>
                                <span className="font-medium text-gold">+{result.goldBreakdown.dailyBonus}</span>
                            </div>
                        )}
                        {result.goldBreakdown.streakBonus > 0 && (
                            <div className="flex justify-between">
                                <span className="text-foreground/60">Streak bonus</span>
                                <span className="font-medium text-gold">+{result.goldBreakdown.streakBonus}</span>
                            </div>
                        )}
                        <div className="border-t border-foreground/10 pt-2 flex justify-between font-semibold">
                            <span>Total</span>
                            <span className="text-gold">+{result.goldEarned}</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition cursor-pointer"
                    >
                        Back to Dashboard
                    </button>
                    <button
                        onClick={() => router.push("/mistakes")}
                        className="w-full py-2.5 rounded-lg border border-foreground/10 text-foreground text-sm font-medium hover:bg-foreground/5 transition cursor-pointer"
                    >
                        Review Mistakes
                    </button>
                </div>
            </div>
        </div>
    );
}
