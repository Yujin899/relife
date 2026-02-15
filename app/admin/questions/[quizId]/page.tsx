"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Option {
    id: string;
    text: string;
}

interface Question {
    id: string;
    quizId: string;
    subjectId: string;
    text: string;
    options: Option[];
    type?: "single" | "multi";
    correctOptionId?: string;
    correctOptionIds?: string[];
    explanation?: string;
}

export default function ManageQuestionsPage() {
    return (
        <AuthGuard>
            <QuestionsContent />
        </AuthGuard>
    );
}

function QuestionsContent() {
    const { user } = useAuth();
    const { showNotification } = useNotifications();
    const params = useParams();
    const quizId = params.quizId as string;

    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [showBulk, setShowBulk] = useState(false);

    // New question form state
    const [newText, setNewText] = useState("");
    const [newExplanation, setNewExplanation] = useState("");
    const [newType, setNewType] = useState<"single" | "multi">("single");
    const [newOptions, setNewOptions] = useState<Option[]>([
        { id: "a", text: "" },
        { id: "b", text: "" },
        { id: "c", text: "" },
        { id: "d", text: "" },
    ]);
    const [newCorrect, setNewCorrect] = useState<string>("a");
    const [newCorrects, setNewCorrects] = useState<string[]>(["a"]);
    const [creating, setCreating] = useState(false);
    const [subjectId, setSubjectId] = useState("");

    // Bulk upload state
    const [bulkJson, setBulkJson] = useState("");
    const [bulkLoading, setBulkLoading] = useState(false);

    async function fetchQuestions() {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/questions?quizId=${quizId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else {
                setQuestions(data.questions || []);
                if (data.questions?.length > 0) {
                    setSubjectId(data.questions[0].subjectId);
                } else {
                    const parts = quizId.split("-");
                    if (parts.length >= 2) setSubjectId(parts.slice(0, 2).join("-"));
                }
            }
        } catch {
            setError("Failed to load questions");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchQuestions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, quizId]);

    const toggleCorrect = (id: string) => {
        if (newType === "single") {
            setNewCorrect(id);
        } else {
            setNewCorrects(prev =>
                prev.includes(id)
                    ? prev.filter(x => x !== id)
                    : [...prev, id]
            );
        }
    };

    const handleCopyFormula = () => {
        const formula = `[
  {
    "text": "What is 2+2?",
    "type": "single",
    "correctOptionId": "a",
    "explanation": "Simple arithmetic.",
    "options": [
      { "id": "a", "text": "4" },
      { "id": "b", "text": "5" }
    ]
  },
  {
    "text": "Select even numbers.",
    "type": "multi",
    "correctOptionIds": ["a", "c"],
    "explanation": "2 and 4 are even.",
    "options": [
      { "id": "a", "text": "2" },
      { "id": "b", "text": "3" },
      { "id": "c", "text": "4" }
    ]
  }
]`;
        navigator.clipboard.writeText(formula);
        showNotification({ message: "Formula copied!", type: "info" });
    };

    async function handleCreate() {
        if (!user || !newText.trim()) return;
        const filledOptions = newOptions.filter((o) => o.text.trim());
        if (filledOptions.length < 2) {
            setError("At least 2 options required");
            return;
        }

        if (newType === "multi" && newCorrects.length === 0) {
            setError("At least one correct answer required");
            return;
        }

        setCreating(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/questions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    quizId,
                    subjectId: subjectId || quizId.split("-").slice(0, 2).join("-"),
                    text: newText.trim(),
                    type: newType,
                    explanation: newExplanation.trim(),
                    options: filledOptions.map((o) => ({ id: o.id, text: o.text.trim() })),
                    correctOptionId: newType === "single" ? newCorrect : null,
                    correctOptionIds: newType === "multi" ? newCorrects : null,
                }),
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else {
                setNewText("");
                setNewExplanation("");
                setShowCreate(false);
                fetchQuestions();
                showNotification({ message: "Question added!", type: "success" });
            }
        } catch {
            setError("Failed to create question");
        } finally {
            setCreating(false);
        }
    }

    async function handleBulkUpload() {
        if (!user || !bulkJson.trim()) return;
        let parsed;
        try {
            parsed = JSON.parse(bulkJson);
            if (!Array.isArray(parsed)) throw new Error("Must be an array");
        } catch (e) {
            setError("Invalid JSON format: " + (e instanceof Error ? e.message : String(e)));
            return;
        }

        setBulkLoading(true);
        setError("");
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/questions/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    quizId,
                    subjectId: subjectId || quizId.split("-").slice(0, 2).join("-"),
                    questions: parsed
                }),
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else {
                setBulkJson("");
                setShowBulk(false);
                fetchQuestions();
                showNotification({ title: "Bulk Upload Success", message: `Uploaded ${data.count} questions.`, type: "success" });
            }
        } catch {
            setError("Bulk upload failed");
        } finally {
            setBulkLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!user) return;
        if (!confirm("Delete this question?")) return;
        try {
            const token = await user.getIdToken();
            await fetch(`/api/admin/questions?id=${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchQuestions();
            showNotification({ message: "Question deleted!", type: "info" });
        } catch {
            setError("Failed to delete question");
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b border-foreground/10 px-4 py-3 sticky top-0 bg-background/80 backdrop-blur-xl z-50">
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <Link href="/admin" className="text-sm text-foreground/50 hover:text-foreground transition shrink-0">
                            ← Admin
                        </Link>
                        <h1 className="text-lg font-bold tracking-tight truncate">Questions — {quizId}</h1>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setShowBulk(!showBulk); setShowCreate(false); }}
                            className="px-3 py-1.5 rounded-lg border border-foreground/10 text-sm font-medium hover:bg-foreground/5 transition cursor-pointer shrink-0"
                        >
                            Bulk JSON
                        </button>
                        <button
                            onClick={() => { setShowCreate(!showCreate); setShowBulk(false); }}
                            className="px-3 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition cursor-pointer shrink-0"
                        >
                            + Add Single
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6">
                {error && (
                    <div className="text-sm text-red-500 bg-red-500/10 px-4 py-3 rounded-xl mb-6 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                        <span>{error}</span>
                        <button onClick={() => setError("")} className="text-xs opacity-50 hover:opacity-100">✕</button>
                    </div>
                )}

                {/* Bulk Upload Form */}
                {showBulk && (
                    <div className="p-4 rounded-xl border border-foreground/10 mb-6 space-y-4 bg-foreground/2 animate-in zoom-in-95">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold">Bulk Question Upload</h2>
                            <button
                                onClick={handleCopyFormula}
                                className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 hover:text-foreground transition flex items-center gap-1 cursor-pointer"
                            >
                                📋 Copy JSON Formula
                            </button>
                        </div>
                        <p className="text-xs text-foreground/40 leading-relaxed">
                            Paste an array of questions following the Relife JSON Schema. Perfect for AI-generated quizes.
                        </p>
                        <textarea
                            value={bulkJson}
                            onChange={(e) => setBulkJson(e.target.value)}
                            placeholder="[ { ... }, { ... } ]"
                            rows={8}
                            className="w-full px-3 py-2 rounded-lg border border-foreground/10 bg-background text-sm focus:outline-none focus:border-foreground/30 font-mono"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleBulkUpload}
                                disabled={!bulkJson.trim() || bulkLoading}
                                className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                            >
                                {bulkLoading ? "Uploading..." : "Start Import"}
                            </button>
                            <button
                                onClick={() => setShowBulk(false)}
                                className="px-4 py-2 rounded-lg border border-foreground/10 text-sm hover:bg-foreground/5 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Create Question Form */}
                {showCreate && (
                    <div className="p-4 rounded-xl border border-foreground/10 mb-6 space-y-4 bg-foreground/2 animate-in zoom-in-95">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold">New Question</h2>
                            <div className="flex bg-foreground/5 p-1 rounded-lg">
                                {["single", "multi"].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setNewType(t as any)}
                                        className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${newType === t ? "bg-background shadow-sm" : "opacity-40"
                                            }`}
                                    >
                                        {t === "single" ? "Single" : "Multiple"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <textarea
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            placeholder="The question text..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-foreground/10 bg-transparent text-sm focus:outline-none focus:border-foreground/30 resize-none font-medium"
                        />

                        <div className="space-y-2">
                            <p className="text-[10px] uppercase font-bold text-foreground/30 tracking-widest">
                                Options ({newType === "single" ? "pick one" : "pick all that apply"})
                            </p>
                            {newOptions.map((opt, i) => {
                                const isCorrect = newType === "single" ? newCorrect === opt.id : newCorrects.includes(opt.id);
                                return (
                                    <div key={opt.id} className="flex items-center gap-2">
                                        <button
                                            onClick={() => toggleCorrect(opt.id)}
                                            className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 transition cursor-pointer ${isCorrect
                                                ? "border-green-500 bg-green-500/10 text-green-500"
                                                : "border-foreground/20 hover:border-foreground/40"
                                                }`}
                                        >
                                            {isCorrect && <span className="text-[10px] font-bold">✓</span>}
                                        </button>
                                        <span className="text-xs font-mono text-foreground/30 w-4 uppercase text-center">{opt.id}</span>
                                        <input
                                            type="text"
                                            value={opt.text}
                                            onChange={(e) => {
                                                const updated = [...newOptions];
                                                updated[i] = { ...opt, text: e.target.value };
                                                setNewOptions(updated);
                                            }}
                                            placeholder={`Option ${opt.id.toUpperCase()}`}
                                            className="flex-1 px-3 py-2 rounded-lg border border-foreground/10 bg-background text-sm focus:outline-none focus:border-foreground/30"
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] uppercase font-bold text-foreground/30 tracking-widest">Explanation (Shown after answering)</p>
                            <textarea
                                value={newExplanation}
                                onChange={(e) => setNewExplanation(e.target.value)}
                                placeholder="Why is this answer correct? Provide context..."
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg border border-foreground/10 bg-transparent text-sm focus:outline-none focus:border-foreground/30 resize-none"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleCreate}
                                disabled={!newText.trim() || creating}
                                className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50 cursor-pointer disabled:cursor-default"
                            >
                                {creating ? "Adding..." : "Add Question"}
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

                {/* Questions list */}
                <div className="space-y-3">
                    {questions.map((q, i) => (
                        <div key={q.id} className="p-4 rounded-xl border border-foreground/10 bg-foreground/1">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/20">Q{i + 1}</span>
                                        {q.type === "multi" && (
                                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase">Multi</span>
                                        )}
                                    </div>
                                    <p className="text-sm font-medium mb-3 leading-relaxed">
                                        {q.text}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        {q.options.map((opt) => {
                                            const isCorrect = q.type === "multi"
                                                ? q.correctOptionIds?.includes(opt.id)
                                                : opt.id === q.correctOptionId;
                                            return (
                                                <div
                                                    key={opt.id}
                                                    className={`px-3 py-2 rounded-lg text-xs transition border ${isCorrect
                                                        ? "bg-green-500/10 text-green-600 border-green-500/20"
                                                        : "bg-foreground/5 text-foreground/60 border-transparent"
                                                        }`}
                                                >
                                                    <span className="font-mono mr-1.5 uppercase opacity-30">{opt.id}.</span>
                                                    {opt.text}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {q.explanation && (
                                        <div className="p-3 rounded-lg bg-foreground/5 border border-dashed border-foreground/10">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 mb-1">Explanation</p>
                                            <p className="text-xs text-foreground/70 leading-relaxed italic">
                                                &quot;{q.explanation}&quot;
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(q.id)}
                                    className="p-2 -mr-2 text-foreground/20 hover:text-red-500 transition cursor-pointer"
                                >
                                    <span className="text-xs">✕</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {questions.length === 0 && !showCreate && !showBulk && (
                    <div className="text-center py-16">
                        <div className="w-12 h-12 bg-foreground/5 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
                            📚
                        </div>
                        <p className="text-foreground/50 text-sm">No questions yet. Add one or try bulk import.</p>
                    </div>
                )}

                <div className="mt-8 text-center border-t border-foreground/5 pt-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/20">
                        {questions.length} question{questions.length !== 1 ? "s" : ""} in this quiz
                    </p>
                </div>
            </main>
        </div>
    );
}
