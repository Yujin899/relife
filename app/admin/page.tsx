"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import AuthGuard from "@/components/AuthGuard";
import {
    BookOpen,
    Zap,
    Sparkles,
    ChevronRight,
    Trash2,
    Plus,
    Target,
    Coins,
    CheckCircle2,
    Calendar
} from "lucide-react";

interface Subject {
    id: string;
    name: string;
    description: string;
    quizCount: number;
    questionCount: number;
}

interface QuestTemplate {
    id: string;
    description: string;
    type: "daily" | "weekly";
    trackingType: string;
    target: number;
    goldReward: number;
}

interface RelifeEvent {
    id: string;
    title: string;
    description: string;
    status: "upcoming" | "active" | "past";
    target: number;
    startDate: { toMillis: () => number } | string | Date;
    endDate: { toMillis: () => number } | string | Date;
    icon: string;
}

interface RoadmapTemplate {
    id: string;
    week: number;
    description: string;
    type: "daily" | "weekly";
    trackingType: string;
    target: number;
    goldReward: number;
    trackingMeta?: Record<string, any>;
}

export default function AdminPage() {
    return (
        <AuthGuard>
            <AdminContent />
        </AuthGuard>
    );
}

function AdminContent() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<"subjects" | "quests" | "events" | "roadmap">("subjects");

    // Roadmap State
    const [roadmap, setRoadmap] = useState<RoadmapTemplate[]>([]);
    const [loadingRoadmap, setLoadingRoadmap] = useState(true);

    // Subjects State
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);

    // Quests State
    const [quests, setQuests] = useState<QuestTemplate[]>([]);
    const [loadingQuests, setLoadingQuests] = useState(true);

    // Events State
    const [events, setEvents] = useState<RelifeEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);

    const [error, setError] = useState("");

    // Shared modals/forms
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);

    // Form states (Subjects)
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");

    async function fetchSubjects() {
        if (!user) return;
        setLoadingSubjects(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/subjects", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else setSubjects(data.subjects || []);
        } catch {
            setError("Failed to load subjects");
        } finally {
            setLoadingSubjects(false);
        }
    }

    async function fetchQuests() {
        if (!user) return;
        setLoadingQuests(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/quests", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else setQuests(data.quests || []);
        } catch {
            setError("Failed to load quests");
        } finally {
            setLoadingQuests(false);
        }
    }

    async function fetchEvents() {
        if (!user) return;
        setLoadingEvents(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/events", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else setEvents(data.events || []);
        } catch {
            setError("Failed to load events");
        } finally {
            setLoadingEvents(false);
        }
    }

    async function fetchRoadmap() {
        if (!user) return;
        setLoadingRoadmap(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/roadmap", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else setRoadmap(data.roadmap || []);
        } catch {
            setError("Failed to load roadmap");
        } finally {
            setLoadingRoadmap(false);
        }
    }

    useEffect(() => {
        fetchSubjects();
        fetchQuests();
        fetchEvents();
        fetchRoadmap();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    async function handleCreateSubject() {
        if (!user || !newName.trim()) return;
        setCreating(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/subjects", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else {
                setNewName("");
                setNewDesc("");
                setShowCreate(false);
                fetchSubjects();
            }
        } catch {
            setError("Failed to create subject");
        } finally {
            setCreating(false);
        }
    }

    async function handleDeleteSubject(id: string, name: string) {
        if (!user) return;
        if (!confirm(`Delete "${name}" and all its quizzes/questions?`)) return;
        try {
            const token = await user.getIdToken();
            await fetch(`/api/admin/subjects?id=${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchSubjects();
        } catch {
            setError("Failed to delete subject");
        }
    }

    const isLoading = loadingSubjects || loadingQuests || loadingEvents || loadingRoadmap;

    if (isLoading && subjects.length === 0 && quests.length === 0 && events.length === 0 && roadmap.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-foreground/10 px-4 py-3 sticky top-0 bg-background/80 backdrop-blur-md z-30">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="p-2 -ml-2 text-foreground/50 hover:text-foreground transition rounded-full hover:bg-foreground/5">
                            <ChevronRight className="w-5 h-5 rotate-180" />
                        </Link>
                        <h1 className="text-lg font-bold tracking-tight">Admin Portal</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6">
                {/* Tabs */}
                <div className="flex p-1 bg-foreground/5 rounded-2xl mb-8">
                    {[
                        { id: "subjects", name: "Subjects", icon: BookOpen },
                        { id: "quests", name: "Templates", icon: Zap },
                        { id: "events", name: "Events", icon: Sparkles },
                        { id: "roadmap", name: "Roadmap", icon: Calendar }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id as any);
                                setShowCreate(false);
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === tab.id
                                ? "bg-background text-foreground shadow-sm"
                                : "text-foreground/40 hover:text-foreground/60"
                                }`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-blue-500" : ""}`} />
                            {tab.name}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6 flex items-center justify-between">
                        <p className="text-sm text-red-500 font-medium">{error}</p>
                        <button onClick={() => setError("")} className="text-red-500 hover:text-red-600">✕</button>
                    </div>
                )}

                {/* Subjects Tab */}
                {activeTab === "subjects" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold opacity-50 uppercase tracking-widest">Manage Subjects</h2>
                            <button
                                onClick={() => setShowCreate(!showCreate)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition active:scale-95 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                New Subject
                            </button>
                        </div>

                        {showCreate && (
                            <div className="p-5 rounded-2xl border border-foreground/10 bg-foreground/2 space-y-4 animate-in zoom-in-95 duration-200">
                                <h3 className="font-bold text-sm">Create New Subject</h3>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="Subject name (e.g. Mathematics)"
                                        className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                                    />
                                    <input
                                        type="text"
                                        value={newDesc}
                                        onChange={(e) => setNewDesc(e.target.value)}
                                        placeholder="Brief description"
                                        className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCreateSubject}
                                        disabled={!newName.trim() || creating}
                                        className="flex-1 py-3 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                                    >
                                        {creating ? "Creating..." : "Create Subject"}
                                    </button>
                                    <button
                                        onClick={() => setShowCreate(false)}
                                        className="px-6 py-3 rounded-xl border border-foreground/10 text-sm font-bold hover:bg-foreground/5 transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-3">
                            {subjects.map((subject) => (
                                <div
                                    key={subject.id}
                                    className="p-4 rounded-xl border border-foreground/10 bg-background hover:border-foreground/20 transition group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-sm truncate">{subject.name}</h3>
                                            <p className="text-xs text-foreground/40 mt-1 truncate">
                                                {subject.quizCount || 0} quizzes &bull; {subject.questionCount || 0} questions
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link
                                                href={`/admin/quizzes/${subject.id}`}
                                                className="p-2 rounded-lg border border-foreground/10 hover:bg-foreground/5 transition"
                                                title="Manage Quizzes"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </Link>
                                            <button
                                                onClick={() => handleDeleteSubject(subject.id, subject.name)}
                                                className="p-2 rounded-lg border border-red-500/10 text-red-500 hover:bg-red-500/5 transition cursor-pointer"
                                                title="Delete Subject"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {subjects.length === 0 && !showCreate && (
                            <div className="text-center py-16 border-2 border-dashed border-foreground/5 rounded-3xl">
                                <BookOpen className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
                                <p className="text-foreground/40 text-sm font-medium">No subjects yet.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Quests Tab Placeholder */}
                {activeTab === "quests" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <QuestsAdmin quests={quests} subjects={subjects} onRefresh={fetchQuests} />
                    </div>
                )}

                {/* Events Tab Placeholder */}
                {activeTab === "events" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <EventsAdmin events={events} onRefresh={fetchEvents} />
                    </div>
                )}

                {/* Roadmap Tab */}
                {activeTab === "roadmap" && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <RoadmapAdmin roadmap={roadmap} subjects={subjects} onRefresh={fetchRoadmap} />
                    </div>
                )}
            </main>
        </div>
    );
}

// ─── Sub-Components (to be expanded) ────────────────────────────────

function QuestsAdmin({ quests, subjects, onRefresh }: { quests: QuestTemplate[], subjects: Subject[], onRefresh: () => void }) {
    const { user } = useAuth();
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");

    // Form states
    const [description, setDescription] = useState("");
    const [type, setType] = useState<"daily" | "weekly">("daily");
    const [trackingType, setTrackingType] = useState("complete_quiz");
    const [target, setTarget] = useState(1);
    const [goldReward, setGoldReward] = useState(50);
    const [subjectId, setSubjectId] = useState("");

    const presets = [
        { name: "Math Hunter", desc: "Complete 1 Math quiz", type: "daily", track: "complete_quiz_in_subject", target: 1, gold: 30, subjectName: "Math" },
        { name: "Science Pro", desc: "Get 100% in Science", type: "daily", track: "perfect_score_in_subject", target: 1, gold: 50, subjectName: "Science" },
        { name: "Gold Miner", desc: "Earn 200 Gold", type: "weekly", track: "earn_gold", target: 200, gold: 100 },
        { name: "Quiz Master", desc: "Complete 10 Quizzes", type: "weekly", track: "complete_quiz", target: 10, gold: 250 },
    ];

    const applyPreset = (preset: any) => {
        setDescription(preset.desc);
        setType(preset.type as any);
        setTrackingType(preset.track);
        setTarget(preset.target);
        setGoldReward(preset.gold);
        if (preset.subjectName) {
            const sub = subjects.find(s => s.name.toLowerCase().includes(preset.subjectName.toLowerCase()));
            if (sub) setSubjectId(sub.id);
        }
    };

    const handleCreate = async () => {
        if (!user || !description) return;
        setCreating(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/quests", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    description,
                    type,
                    trackingType,
                    target,
                    goldReward,
                    trackingMeta: subjectId ? { subjectId } : {}
                }),
            });
            if (res.ok) {
                setShowCreate(false);
                setDescription("");
                onRefresh();
            } else {
                const data = await res.json();
                setError(data.error || "Failed to create quest");
            }
        } catch {
            setError("Request failed");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!user || !confirm("Delete this quest template?")) return;
        try {
            const token = await user.getIdToken();
            await fetch(`/api/admin/quests?id=${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            onRefresh();
        } catch {
            setError("Delete failed");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold opacity-50 uppercase tracking-widest">Quest Templates</h2>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition active:scale-95 cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    New Template
                </button>
            </div>

            {showCreate && (
                <div className="p-5 rounded-2xl border border-foreground/10 bg-foreground/2 space-y-4 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-blue-500">Create Quest Template</h3>
                        <div className="flex gap-2">
                            {presets.map(p => (
                                <button
                                    key={p.name}
                                    onClick={() => applyPreset(p)}
                                    className="px-2 py-1 rounded bg-foreground/5 text-[10px] font-bold hover:bg-foreground/10 transition"
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Quest description (e.g. Complete 3 quizzes)"
                            className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none focus:border-blue-500/50"
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as any)}
                                className="px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>

                            <select
                                value={trackingType}
                                onChange={(e) => setTrackingType(e.target.value)}
                                className="px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none"
                            >
                                <option value="complete_quiz">Complete Quizzes</option>
                                <option value="complete_quiz_in_subject">Complete in Subject</option>
                                <option value="perfect_score">Perfect Scores</option>
                                <option value="perfect_score_in_subject">Perfect in Subject</option>
                                <option value="correct_answers">Correct Answers</option>
                                <option value="earn_gold">Earn Gold</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-foreground/40 ml-1">Target Amount</label>
                                <input
                                    type="number"
                                    value={target}
                                    onChange={(e) => setTarget(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-foreground/40 ml-1">Gold Reward</label>
                                <input
                                    type="number"
                                    value={goldReward}
                                    onChange={(e) => setGoldReward(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none"
                                />
                            </div>
                        </div>

                        {(trackingType.includes("subject")) && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-foreground/40 ml-1">Requires Subject</label>
                                <select
                                    value={subjectId}
                                    onChange={(e) => setSubjectId(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none"
                                >
                                    <option value="">Select a Subject...</option>
                                    {subjects.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <div className="flex gap-2">
                        <button
                            onClick={handleCreate}
                            disabled={!description || creating}
                            className="flex-1 py-3 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                        >
                            {creating ? "Saving..." : "Save Template"}
                        </button>
                        <button
                            onClick={() => setShowCreate(false)}
                            className="px-6 py-3 rounded-xl border border-foreground/10 text-sm font-bold hover:bg-foreground/5 transition cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="grid gap-3">
                {quests.map((quest) => (
                    <div
                        key={quest.id}
                        className="p-4 rounded-xl border border-foreground/10 bg-background hover:border-foreground/20 transition group"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${quest.type === "daily" ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"}`}>
                                        {quest.type}
                                    </span>
                                    <h3 className="font-bold text-sm truncate">{quest.description}</h3>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-foreground/40 font-medium">
                                    <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {quest.target}</span>
                                    <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-gold" /> {quest.goldReward}G</span>
                                    <span className="capitalize">{quest.trackingType.replace(/_/g, " ")}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(quest.id)}
                                className="p-2 rounded-lg border border-red-500/10 text-red-500 hover:bg-red-500/5 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {quests.length === 0 && !showCreate && (
                    <div className="text-center py-16 border-2 border-dashed border-foreground/5 rounded-3xl">
                        <Zap className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
                        <p className="text-foreground/40 text-sm font-medium">No custom quest templates yet.</p>
                    </div>
                )}
            </div>

            <div className="mt-8 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <p className="text-[10px] font-black uppercase tracking-tighter text-blue-500 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" /> System Integration
                </p>
                <p className="text-[11px] text-foreground/60 leading-relaxed font-medium">
                    Quest templates created here will be automatically prioritized when users receive new daily or weekly tasks. The system will continue to generate fallback quests from its static inventory if no matching custom templates are found.
                </p>
            </div>
        </div>
    );
}

function EventsAdmin({ events, onRefresh }: { events: RelifeEvent[], onRefresh: () => void }) {
    const { user } = useAuth();
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");

    // Form states
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [icon, setIcon] = useState("🏆");
    const [target, setTarget] = useState(10);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const presets = [
        { name: "Golden Weekend", title: "Golden Weekend", desc: "Earn double rewards for 48 hours!", icon: "🪙", target: 500 },
        { name: "Math Marathon", title: "Math Marathon", desc: "Complete 10 Math quizzes to win!", icon: "📐", target: 10 },
        { name: "Study Streak", title: "Study Marathon", desc: "Maintain focus and study 20 subjects", icon: "🔥", target: 20 },
    ];

    const applyPreset = (preset: any) => {
        setTitle(preset.title);
        setDescription(preset.desc);
        setIcon(preset.icon);
        setTarget(preset.target);
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 7);
        setStartDate(start.toISOString().split("T")[0]);
        setEndDate(end.toISOString().split("T")[0]);
    };

    const handleCreate = async () => {
        if (!user || !title) return;
        setCreating(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/events", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    title,
                    description,
                    icon,
                    target,
                    startDate,
                    endDate,
                }),
            });
            if (res.ok) {
                setShowCreate(false);
                setTitle("");
                onRefresh();
            } else {
                const data = await res.json();
                setError(data.error || "Failed up save event");
            }
        } catch {
            setError("Request failed");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!user || !confirm("Delete this event?")) return;
        try {
            const token = await user.getIdToken();
            await fetch(`/api/admin/events?id=${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            onRefresh();
        } catch {
            setError("Delete failed");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold opacity-50 uppercase tracking-widest">Live Events</h2>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition active:scale-95 cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    Host Event
                </button>
            </div>

            {showCreate && (
                <div className="p-5 rounded-2xl border border-foreground/10 bg-foreground/2 space-y-4 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-purple-500">Host New Event</h3>
                        <div className="flex gap-2">
                            {presets.map(p => (
                                <button
                                    key={p.name}
                                    onClick={() => applyPreset(p)}
                                    className="px-2 py-1 rounded bg-foreground/5 text-[10px] font-bold hover:bg-foreground/10 transition"
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                placeholder="Icon"
                                className="w-16 px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm text-center"
                            />
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Event Title"
                                className="flex-1 px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none focus:border-purple-500/50"
                            />
                        </div>

                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Event description"
                            className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none focus:border-purple-500/50 resize-none h-20"
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-foreground/40 ml-1">Daily Start</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-foreground/40 ml-1">Event End</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-foreground/40 ml-1">Target Progress (Quizzes/Gold)</label>
                            <input
                                type="number"
                                value={target}
                                onChange={(e) => setTarget(Number(e.target.value))}
                                className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none"
                            />
                        </div>
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <div className="flex gap-2">
                        <button
                            onClick={handleCreate}
                            disabled={!title || creating}
                            className="flex-1 py-3 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                        >
                            {creating ? "Launching..." : "Launch Event"}
                        </button>
                        <button
                            onClick={() => setShowCreate(false)}
                            className="px-6 py-3 rounded-xl border border-foreground/10 text-sm font-bold hover:bg-foreground/5 transition cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="grid gap-3">
                {events.map((event) => (
                    <div
                        key={event.id}
                        className="p-4 rounded-xl border border-foreground/10 bg-background hover:border-foreground/20 transition group"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center text-2xl shrink-0">
                                    {event.icon}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h3 className="font-bold text-sm truncate">{event.title}</h3>
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${event.status === "active" ? "bg-green-500/10 text-green-500" :
                                            event.status === "upcoming" ? "bg-blue-500/10 text-blue-500" :
                                                "bg-foreground/5 text-foreground/40"
                                            }`}>
                                            {event.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-foreground/40 font-medium truncate">
                                        Goal: {event.target} &bull; {new Date(event.startDate?.toMillis?.() || event.startDate).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(event.id)}
                                className="p-2 rounded-lg border border-red-500/10 text-red-500 hover:bg-red-500/5 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {events.length === 0 && !showCreate && (
                    <div className="text-center py-16 border-2 border-dashed border-foreground/5 rounded-3xl">
                        <Calendar className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
                        <p className="text-foreground/40 text-sm font-medium">No events hosted yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function RoadmapAdmin({ roadmap, subjects, onRefresh }: { roadmap: RoadmapTemplate[], subjects: Subject[], onRefresh: () => void }) {
    const { user } = useAuth();
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");

    // Form states
    const [description, setDescription] = useState("");
    const [type, setType] = useState<"daily" | "weekly">("daily");
    const [trackingType, setTrackingType] = useState("complete_quiz");
    const [target, setTarget] = useState(1);
    const [goldReward, setGoldReward] = useState(50);
    const [subjectId, setSubjectId] = useState("");

    const weeks = Array.from({ length: 12 }, (_, i) => i + 1);

    const handleCreate = async () => {
        if (!user || !description) return;
        setCreating(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/admin/roadmap", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    week: selectedWeek,
                    description,
                    type,
                    trackingType,
                    target,
                    goldReward,
                    trackingMeta: subjectId ? { subjectId } : {}
                }),
            });
            if (res.ok) {
                setShowCreate(false);
                setDescription("");
                onRefresh();
            } else {
                const data = await res.json();
                setError(data.error || "Failed to save roadmap quest");
            }
        } catch {
            setError("Request failed");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!user || !confirm("Delete this roadmap quest?")) return;
        try {
            const token = await user.getIdToken();
            await fetch(`/api/admin/roadmap?id=${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            onRefresh();
        } catch {
            setError("Delete failed");
        }
    };

    const weekQuests = roadmap.filter(r => r.week === selectedWeek);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold opacity-50 uppercase tracking-widest">User Journey Roadmap (12 Weeks)</h2>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition active:scale-95 cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    Add to Week {selectedWeek}
                </button>
            </div>

            {/* Week Selector */}
            <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar">
                {weeks.map(w => {
                    const count = roadmap.filter(r => r.week === w).length;
                    return (
                        <button
                            key={w}
                            onClick={() => setSelectedWeek(w)}
                            className={`flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all border relative ${selectedWeek === w
                                ? "bg-blue-500 border-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : "bg-background border-foreground/10 text-foreground/40 hover:border-foreground/20"
                                }`}
                        >
                            <span className="text-[10px] uppercase font-black">W{w}</span>
                            {count > 0 && (
                                <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${selectedWeek === w ? "bg-white text-blue-500" : "bg-blue-500 text-white"
                                    }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {showCreate && (
                <div className="p-5 rounded-2xl border border-foreground/10 bg-foreground/2 space-y-4 animate-in zoom-in-95 duration-200">
                    <h3 className="font-bold text-sm text-blue-500">Add Roadmap Quest (Week {selectedWeek})</h3>
                    <div className="space-y-3">
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Quest description"
                            className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as any)}
                                className="px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                            <select
                                value={trackingType}
                                onChange={(e) => setTrackingType(e.target.value)}
                                className="px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm"
                            >
                                <option value="complete_quiz">Complete Quizzes</option>
                                <option value="complete_quiz_in_subject">Complete in Subject</option>
                                <option value="earn_gold">Earn Gold</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-foreground/40 ml-1">Target</label>
                                <input
                                    type="number"
                                    value={target}
                                    onChange={(e) => setTarget(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-foreground/40 ml-1">Gold Reward</label>
                                <input
                                    type="number"
                                    value={goldReward}
                                    onChange={(e) => setGoldReward(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm"
                                />
                            </div>
                        </div>
                        {trackingType.includes("subject") && (
                            <select
                                value={subjectId}
                                onChange={(e) => setSubjectId(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-background text-sm"
                            >
                                <option value="">Select Subject...</option>
                                {subjects.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    <div className="flex gap-2">
                        <button
                            onClick={handleCreate}
                            disabled={!description || creating}
                            className="flex-1 py-3 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
                        >
                            {creating ? "Saving..." : "Save to Roadmap"}
                        </button>
                        <button
                            onClick={() => setShowCreate(false)}
                            className="px-6 py-3 rounded-xl border border-foreground/10 text-sm font-bold hover:bg-foreground/5 transition cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="grid gap-3">
                {weekQuests.map((quest) => (
                    <div key={quest.id} className="p-4 rounded-xl border border-foreground/10 bg-background hover:border-foreground/20 transition group">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${quest.type === "daily" ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"}`}>
                                        {quest.type}
                                    </span>
                                    <h3 className="font-bold text-sm truncate">{quest.description}</h3>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-foreground/40 font-medium">
                                    <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {quest.target}</span>
                                    <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-gold" /> {quest.goldReward}G</span>
                                    <span className="capitalize">{quest.trackingType.replace(/_/g, " ")}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(quest.id)}
                                className="p-2 rounded-lg border border-red-500/10 text-red-500 hover:bg-red-500/5 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {weekQuests.length === 0 && !showCreate && (
                    <div className="text-center py-12 border-2 border-dashed border-foreground/5 rounded-3xl">
                        <Calendar className="w-10 h-10 text-foreground/10 mx-auto mb-3" />
                        <p className="text-foreground/40 text-xs font-medium">No quests scheduled for Week {selectedWeek}.</p>
                    </div>
                )}
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <p className="text-[10px] font-black uppercase tracking-tighter text-amber-500 mb-2 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> Growth Campaign
                </p>
                <p className="text-[11px] text-foreground/60 leading-relaxed font-medium">
                    The Roadmap ensures users have a structured experience over their first 3 months. Roadmap quests for the user&apos;s current week will always take precedence over system-generated tasks.
                </p>
            </div>
        </div>
    );
}
