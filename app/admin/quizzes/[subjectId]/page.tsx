"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Quiz {
    quizId?: string;
    id?: string;
    subjectId: string;
    title: string;
    description: string;
    questionCount: number;
}

export default function ManageQuizzesPage() {
    return (
        <AuthGuard>
            <QuizzesContent />
        </AuthGuard>
    );
}

function QuizzesContent() {
    const { user } = useAuth();
    const params = useParams();
    const subjectId = params.subjectId as string;

    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [creating, setCreating] = useState(false);

    async function fetchQuizzes() {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/quizzes?subjectId=${subjectId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else setQuizzes(data.quizzes || []);
        } catch {
            setError("Failed to load quizzes");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchQuizzes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, subjectId]);

    async function handleCreate() {
        if (!user || !newTitle.trim()) return;
        setCreating(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/quizzes", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ subjectId, title: newTitle.trim(), description: newDesc.trim() }),
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else {
                setNewTitle("");
                setNewDesc("");
                setShowCreate(false);
                fetchQuizzes();
            }
        } catch {
            setError("Failed to create quiz");
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(quizId: string, title: string) {
        if (!user) return;
        if (!confirm(`Delete "${title}" and all its questions?`)) return;
        try {
            const token = await user.getIdToken();
            await fetch(`/api/admin/quizzes?quizId=${quizId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchQuizzes();
        } catch {
            setError("Failed to delete quiz");
        }
    }

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
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/admin" className="text-sm text-foreground/50 hover:text-foreground transition">
                            ← Admin
                        </Link>
                        <h1 className="text-lg font-bold tracking-tight">Quizzes — {subjectId}</h1>
                    </div>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="px-3 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition cursor-pointer"
                    >
                        + New Quiz
                    </button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6">
                {error && (
                    <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg mb-4">{error}</p>
                )}

                {showCreate && (
                    <div className="p-4 rounded-xl border border-foreground/10 mb-6 space-y-3">
                        <h2 className="text-sm font-semibold">Create Quiz</h2>
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Quiz title (e.g. Algebra Basics)"
                            className="w-full px-3 py-2 rounded-lg border border-foreground/10 bg-transparent text-sm focus:outline-none focus:border-foreground/30"
                        />
                        <input
                            type="text"
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                            placeholder="Description (optional)"
                            className="w-full px-3 py-2 rounded-lg border border-foreground/10 bg-transparent text-sm focus:outline-none focus:border-foreground/30"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleCreate}
                                disabled={!newTitle.trim() || creating}
                                className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50 cursor-pointer disabled:cursor-default"
                            >
                                {creating ? "Creating..." : "Create"}
                            </button>
                            <button
                                onClick={() => setShowCreate(false)}
                                className="px-4 py-2 rounded-lg border border-foreground/10 text-sm hover:bg-foreground/5 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {quizzes.map((quiz, idx) => {
                        const qId = quiz.quizId || quiz.id || `idx-${idx}`;
                        return (
                            <div key={qId} className="p-4 rounded-xl border border-foreground/10 hover:border-foreground/20 transition">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-sm">{quiz.title}</h3>
                                        <p className="text-xs text-foreground/50 mt-0.5">
                                            {quiz.questionCount || 0} questions
                                            {quiz.description && ` · ${quiz.description}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/admin/questions/${qId}`}
                                            className="px-3 py-1.5 rounded-lg border border-foreground/10 text-xs hover:bg-foreground/5 transition"
                                        >
                                            Edit Questions →
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(qId, quiz.title)}
                                            className="px-3 py-1.5 rounded-lg border border-red-500/20 text-xs text-red-500 hover:bg-red-500/5 transition cursor-pointer"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {quizzes.length === 0 && !showCreate && (
                    <div className="text-center py-12">
                        <p className="text-foreground/50 text-sm">No quizzes yet. Create one to get started.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
