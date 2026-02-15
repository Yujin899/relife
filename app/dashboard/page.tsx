"use client";

import { useAuth } from "@/lib/auth-context";
import AuthGuard from "@/components/AuthGuard";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getLeague, getNextLeague } from "@/lib/leagues";
import Link from "next/link";
import { motion } from "framer-motion";
import AnimatedNumber from "@/components/AnimatedNumber";
import {
    ShoppingBag,
    Archive,
    Trophy,
    Settings,
    LogOut,
    Zap,
    BookOpen,
    ChevronRight,
    Snowflake,
    Clock,
    Sparkles,
    Megaphone,
    ArrowRight,
    MessageSquare,
    User,
    Shield,
    Calendar
} from "lucide-react";
import Script from "next/script";
import UserAvatar from "@/components/UserAvatar";
import BottomNav from "@/components/BottomNav";

interface Subject {
    id: string;
    name: string;
    description: string;
    questionCount: number;
}

interface UserProfile {
    totalGold: number;
    role?: string;
    currentStreak: number;
    longestStreak: number;
    totalQuizzes: number;
    totalCorrect: number;
    totalQuestions: number;
    inventory: string[];
    streakFreezes: number;
    activeTheme: string;
    profileUpdates?: number;
    frame?: string;
    settings?: {
        prefersMotion: boolean;
        enableSound: boolean;
        isPrivate: boolean;
    };
    createdAt?: any;
}

interface Quest {
    id: string;
    templateId: string;
    type: "daily" | "weekly";
    description: string;
    progress: number;
    target: number;
    completed: boolean;
    goldReward: number;
    expiresAt: number;
}

interface RelifeEvent {
    id: string;
    title: string;
    description: string;
    icon: string;
    status: "upcoming" | "active" | "past";
    target: number;
    userProgress: number;
    isJoined: boolean;
    startTimestamp: number;
    endTimestamp: number;
}

export default function DashboardPage() {
    return (
        <AuthGuard>
            <DashboardContent />
        </AuthGuard>
    );
}

function DashboardContent() {
    const { user, signOut } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [mistakeCount, setMistakeCount] = useState(0);
    const [dueCount, setDueCount] = useState(0);
    const [events, setEvents] = useState<RelifeEvent[]>([]);
    const [quests, setQuests] = useState<Quest[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [updatingSettings, setUpdatingSettings] = useState(false);
    const [announcement, setAnnouncement] = useState<{ content: string; authorName: string; authorLeague: string } | null>(null);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);

    const updateSettings = async (newSettings: { prefersMotion?: boolean; enableSound?: boolean; isPrivate?: boolean }) => {
        if (!user || !profile) return;
        setUpdatingSettings(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/user/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newSettings),
            });

            if (res.ok) {
                // Optimistic UI update
                setProfile(prev => prev ? {
                    ...prev,
                    settings: { ...prev.settings!, ...newSettings }
                } : null);
            } else {
                console.error("Failed to update settings API");
            }
        } catch (error) {
            console.error("Failed to update settings", error);
        } finally {
            setUpdatingSettings(false);
        }
    };

    useEffect(() => {
        async function load() {
            if (!user) return;

            // Fetch user profile
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setProfile({
                    totalGold: data.totalGold ?? 0,
                    currentStreak: data.currentStreak ?? 0,
                    longestStreak: data.longestStreak ?? 0,
                    totalQuizzes: data.totalQuizzes ?? 0,
                    totalCorrect: data.totalCorrect ?? 0,
                    totalQuestions: data.totalQuestions ?? 0,
                    inventory: data.inventory ?? [],
                    streakFreezes: data.streakFreezes ?? 0,
                    activeTheme: data.activeTheme ?? "zinc",
                    profileUpdates: data.profileUpdates ?? 0,
                    frame: data.frame ?? null,
                    role: data.role ?? "student",
                    settings: data.settings ?? { prefersMotion: true, enableSound: true, isPrivate: false },
                    createdAt: data.createdAt,
                });
            } else {
                // No doc yet — use zeroed defaults
                setProfile({
                    totalGold: 0,
                    currentStreak: 0,
                    longestStreak: 0,
                    totalQuizzes: 0,
                    totalCorrect: 0,
                    totalQuestions: 0,
                    inventory: [],
                    streakFreezes: 0,
                    activeTheme: "default",
                    profileUpdates: 0,
                    frame: undefined,
                    settings: { prefersMotion: true, enableSound: true, isPrivate: false },
                });
            }

            // Fetch subjects
            const res = await fetch("/api/subjects");
            const data = await res.json();
            setSubjects(data.subjects || []);

            // Fetch mistake count
            try {
                const token = await user.getIdToken();
                const mistakesRes = await fetch("/api/mistakes", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const mistakesData = await mistakesRes.json();
                setMistakeCount(mistakesData.mistakes?.length || 0);
            } catch {
                // Mistakes might fail if no index yet, that's ok
            }

            // Fetch quests
            try {
                const token = await user.getIdToken();
                const questsRes = await fetch("/api/quests", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const questsData = await questsRes.json();
                setQuests(questsData.quests || []);
            } catch {
                // Quests might fail
            }

            // Fetch due review count
            try {
                const token = await user.getIdToken();
                const reviewRes = await fetch("/api/review", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const reviewData = await reviewRes.json();
                setDueCount(reviewData.questions?.length || 0);
            } catch {
                // Review might fail
            }

            // Fetch events
            try {
                const token = await user.getIdToken();
                const eventsRes = await fetch("/api/events", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const eventsData = await eventsRes.json();
                setEvents(eventsData.events || []);
            } catch {
                // Events might fail
            }

            // Fetch Announcement
            try {
                const annRes = await fetch("/api/announcements");
                const annData = await annRes.json();
                setAnnouncement(annData.announcement);
            } catch { /* Silent fail */ }

            setLoading(false);
        }
        load();
    }, [user]);

    if (loading || !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    const league = getLeague(profile.totalGold);
    const nextLeague = getNextLeague(profile.totalGold);
    const prefersMotion = profile.settings?.prefersMotion !== false;

    return (
        <div className="min-h-screen bg-background">
            {/* Top Bar */}
            <header className="border-b border-foreground/10 px-4 py-3 sticky top-0 bg-background/80 backdrop-blur-md z-30">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <h1 className="text-lg font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">Relife</h1>
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-3 mr-2">
                            <Link
                                href="/achievements"
                                className="text-sm text-foreground/50 hover:text-foreground transition flex items-center gap-1.5"
                            >
                                <Trophy className="w-4 h-4 text-amber-500" />
                                Badges
                            </Link>
                            <Link
                                href="/shop"
                                className="text-sm text-foreground/50 hover:text-foreground transition flex items-center gap-1.5"
                            >
                                <ShoppingBag className="w-4 h-4 text-yellow-500" />
                                Shop
                            </Link>
                            <Link
                                href="/profile"
                                className="text-sm text-foreground/50 hover:text-foreground transition flex items-center gap-1.5"
                            >
                                <User className="w-4 h-4 text-purple-500" />
                                Profile
                            </Link>
                            <Link
                                href="/chat"
                                className="text-sm text-foreground/50 hover:text-foreground transition flex items-center gap-1.5"
                            >
                                <MessageSquare className="w-4 h-4 text-blue-500" />
                                Chat
                            </Link>
                            <Link
                                href="/leaderboard"
                                className="text-sm text-foreground/50 hover:text-foreground transition flex items-center gap-1.5"
                            >
                                <Trophy className="w-4 h-4 text-blue-400" />
                                Leaderboard
                            </Link>
                            {(profile.role === "admin" || profile.role === "owner") && (
                                <Link
                                    href="/admin"
                                    className="text-sm text-blue-500 font-bold hover:text-blue-600 transition flex items-center gap-1.5"
                                >
                                    <Shield className="w-4 h-4" />
                                    Admin
                                </Link>
                            )}
                            <button
                                onClick={signOut}
                                className="text-sm text-foreground/50 hover:text-foreground transition cursor-pointer flex items-center gap-1.5"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign out
                            </button>
                        </div>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 text-foreground/50 hover:text-foreground transition rounded-full hover:bg-foreground/5 active:scale-95 cursor-pointer"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-background border border-foreground/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-6"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">Preferences</h2>
                            <button onClick={() => setShowSettings(false)} className="text-foreground/40 hover:text-foreground">✕</button>
                        </div>

                        <div className="space-y-4">
                            {/* Motion Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-foreground/2 border border-foreground/5">
                                <div>
                                    <p className="text-sm font-bold">Experience Motion</p>
                                    <p className="text-[10px] text-foreground/50 font-medium">Animations and micro-interactions</p>
                                </div>
                                <button
                                    disabled={updatingSettings}
                                    onClick={() => updateSettings({ prefersMotion: !profile.settings?.prefersMotion })}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${profile.settings?.prefersMotion !== false ? "bg-blue-500" : "bg-foreground/20"}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${profile.settings?.prefersMotion !== false ? "left-6" : "left-1"}`} />
                                </button>
                            </div>

                            {/* Sound Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-foreground/2 border border-foreground/5">
                                <div>
                                    <p className="text-sm font-bold">UI Sound Effects</p>
                                    <p className="text-[10px] text-foreground/50 font-medium">Feedback sounds for rewards</p>
                                </div>
                                <button
                                    disabled={updatingSettings}
                                    onClick={() => updateSettings({ enableSound: !profile.settings?.enableSound })}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${profile.settings?.enableSound ? "bg-blue-500" : "bg-foreground/20"}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${profile.settings?.enableSound ? "left-6" : "left-1"}`} />
                                </button>
                            </div>

                            {/* Privacy Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-foreground/2 border border-foreground/5">
                                <div>
                                    <p className="text-sm font-bold">Private Profile</p>
                                    <p className="text-[10px] text-foreground/50 font-medium">Hide your name from public boards</p>
                                </div>
                                <button
                                    disabled={updatingSettings}
                                    onClick={() => updateSettings({ isPrivate: !profile.settings?.isPrivate })}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${profile.settings?.isPrivate ? "bg-blue-500" : "bg-foreground/20"}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${profile.settings?.isPrivate ? "left-6" : "left-1"}`} />
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowSettings(false)}
                            className="w-full py-3 bg-foreground text-background font-bold rounded-xl active:scale-95 transition-transform"
                        >
                            Done
                        </button>
                    </motion.div>
                </div>
            )}

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {/* Profile Quick Card / Header */}
                <Link
                    href="/profile"
                    className="block p-5 rounded-3xl bg-gradient-to-br from-foreground/5 via-foreground/[0.02] to-transparent border border-foreground/5 relative overflow-hidden group hover:border-blue-500/20 transition-all duration-500 shadow-sm"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <User className="w-32 h-32 rotate-12 translate-x-12 -translate-y-8" />
                    </div>

                    <div className="flex items-center gap-5 relative z-10">
                        <UserAvatar
                            src={user?.photoURL}
                            fallback={user?.displayName || "?"}
                            league={league.name}
                            frame={profile.frame}
                            size="lg"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-xl font-black tracking-tighter truncate">{user?.displayName || "Adventurer"}</h2>
                                <ArrowRight className="w-4 h-4 text-foreground/20 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                            </div>
                            <div className="flex items-center flex-wrap gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-foreground/5 border border-foreground/5 text-foreground/60">
                                    {league.name} League
                                </span>
                                <span className="text-[10px] text-foreground/40 font-bold tracking-tight bg-foreground/5 px-2 py-0.5 rounded-full">
                                    {profile.totalQuizzes} Quizzes &bull; {Math.round((profile.totalCorrect / (profile.totalQuestions || 1)) * 100)}% Accuracy
                                </span>
                            </div>
                        </div>
                    </div>
                </Link>

                {/* Quick Links - Moved higher for mobile visibility */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <Link
                        href="/achievements"
                        className="flex items-center gap-3 p-4 rounded-xl border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/2 transition group shadow-sm bg-background"
                    >
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                            <Trophy className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black tracking-tight">Badges</h2>
                            <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-tighter">
                                Achievements
                            </p>
                        </div>
                    </Link>
                    <Link
                        href="/mistakes"
                        className="flex items-center gap-3 p-4 rounded-xl border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/2 transition group shadow-sm bg-background"
                    >
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                            <BookOpen className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-black tracking-tight">Mistakes</h2>
                            <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-tighter">
                                {mistakeCount > 0 ? `${mistakeCount} REVIEW` : "CLEAN"}
                            </p>
                        </div>
                    </Link>
                </div>

                {/* Announcement Banner */}
                {announcement && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-4 relative overflow-hidden group mb-2"
                    >
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Megaphone className="w-12 h-12 -rotate-12 translate-x-4 translate-y-2" />
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                            <Megaphone className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0 font-medium">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[10px] uppercase font-black ${LEAGUE_COLORS[announcement.authorLeague] || "text-blue-400"}`}>
                                    {announcement.authorLeague}
                                </span>
                                <span className="text-[10px] text-foreground/40 font-bold tracking-tight">System Pin by {announcement.authorName}</span>
                            </div>
                            <p className="text-sm text-foreground tracking-tight leading-snug">{announcement.content}</p>
                        </div>
                    </motion.div>
                )}
                {/* Event Banner */}
                {(() => {
                    const activeEvent = events.find(e => e.status === "active");
                    const upcomingEvent = events.find(e => e.status === "upcoming");
                    const selectedEvent = activeEvent || upcomingEvent;

                    if (!selectedEvent) return null;

                    return (
                        <section className="animate-in fade-in slide-in-from-top-2 duration-500">
                            <Link
                                href="/events"
                                className={`block relative overflow-hidden p-4 rounded-xl border transition-all group ${selectedEvent.status === "active"
                                    ? "border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10"
                                    : "border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10"
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <Sparkles className="w-6 h-6 text-blue-500" />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${selectedEvent.status === "active"
                                                    ? "text-blue-500 bg-blue-500/10"
                                                    : "text-purple-500 bg-purple-500/10"
                                                    }`}>
                                                    {selectedEvent.status === "active" ? "Event Active" : "Starting Soon"}
                                                </span>
                                                <h3 className={`text-sm font-bold truncate ${selectedEvent.status === "active" ? "text-blue-600" : "text-purple-600"}`}>
                                                    {selectedEvent.title}
                                                </h3>
                                            </div>
                                            <p className="text-xs text-foreground/60 mt-0.5 truncate">{selectedEvent.description}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <CountdownLabel
                                            targetDate={selectedEvent.status === "active" ? selectedEvent.endTimestamp : selectedEvent.startTimestamp}
                                            label={selectedEvent.status === "active" ? "Ends in" : "Starts in"}
                                            color={selectedEvent.status === "active" ? "text-blue-500" : "text-purple-500"}
                                        />
                                    </div>
                                </div>
                            </Link>
                        </section>
                    );
                })()}

                <Script src="https://widget.cloudinary.com/v2.0/global/all.js" strategy="lazyOnload" />

                {/* My Journey Roadmap */}
                {(() => {
                    const start = profile.createdAt?.toDate?.() || new Date(profile.createdAt) || new Date();
                    const now = new Date();
                    const weeksJoined = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
                    const currentWeek = Math.min(12, weeksJoined);

                    return (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">My Journey</h2>
                                <span className="text-[10px] font-black bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full ring-1 ring-blue-500/20">WEEK {currentWeek}/12</span>
                            </div>
                            <div className="p-5 rounded-3xl bg-foreground/2 border border-foreground/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                    <Sparkles className="w-24 h-24" />
                                </div>
                                <div className="flex justify-between items-center gap-1 relative z-10">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
                                        const isPast = w < currentWeek;
                                        const isCurrent = w === currentWeek;
                                        return (
                                            <div key={w} className="flex flex-col items-center gap-2 flex-1">
                                                <div className={`w-full h-1.5 rounded-full transition-all duration-500 ${isPast ? "bg-blue-500" : isCurrent ? "bg-blue-500 animate-pulse ring-4 ring-blue-500/20" : "bg-foreground/10"}`} />
                                                <span className={`text-[8px] font-black ${isCurrent ? "text-blue-500" : "text-foreground/20"}`}>{w}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                            <Calendar className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <p className="text-[11px] font-medium text-foreground/60 leading-tight">
                                            {currentWeek <= 4 ? "Early Phase: Building core habits." :
                                                currentWeek <= 8 ? "Mid-Journey: Deepening expertise." :
                                                    "Final Sprint: Mastering the domain."}
                                        </p>
                                    </div>
                                    <Link href="/roadmap" className="text-[10px] font-bold text-blue-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        View Map <ArrowRight className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>
                        </section>
                    );
                })()}

                {/* Subjects */}
                <section>
                    <h2 className="text-sm font-semibold text-foreground/70 mb-3 uppercase tracking-wider">
                        Subjects
                    </h2>
                    <div className="grid gap-3">
                        {subjects.map((subject) => (
                            <motion.div
                                key={subject.id}
                                whileHover={prefersMotion ? { y: -2, scale: 1.01 } : {}}
                                whileTap={prefersMotion ? { scale: 0.98 } : {}}
                            >
                                <Link
                                    href={`/subject/${subject.id}`}
                                    className="block p-4 rounded-xl border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/2 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium text-sm">{subject.name}</h3>
                                            <p className="text-xs text-foreground/50 mt-0.5">{subject.description}</p>
                                        </div>
                                        <span className="text-xs text-foreground/30 group-hover:text-foreground/60 transition flex items-center gap-1">
                                            {subject.questionCount} questions <ChevronRight className="w-3 h-3 translate-y-[1px]" />
                                        </span>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Quests */}
                {
                    quests.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
                                    Current Quests
                                </h2>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-foreground/40" />
                                    <CountdownLabel
                                        targetDate={quests[0].expiresAt}
                                        label=""
                                        color="text-foreground/40"
                                        compact
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                {quests.map((quest) => (
                                    <motion.div
                                        key={quest.id}
                                        whileHover={prefersMotion ? { x: 4 } : {}}
                                        className={`p-3 rounded-xl border transition-all ${quest.completed
                                            ? "border-green-500/20 bg-green-500/5 text-green-700/80"
                                            : "border-foreground/10"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${quest.templateId.includes("roadmap")
                                                    ? "bg-blue-500/20 text-blue-500 ring-1 ring-blue-500/30"
                                                    : quest.type === "daily"
                                                        ? "bg-orange-500/10 text-orange-500"
                                                        : "bg-purple-500/10 text-purple-500"
                                                    }`}>
                                                    {quest.templateId.includes("roadmap") ? "Roadmap" : quest.type}
                                                </span>
                                                <h3 className="font-bold text-sm tracking-tight">{quest.description}</h3>
                                            </div>
                                            <span className="text-xs font-black text-gold">+{quest.goldReward}G</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-foreground/5 rounded-full overflow-hidden border border-foreground/5">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }}
                                                    className={`h-full rounded-full transition-colors ${quest.completed ? "bg-green-500" : "bg-foreground/20"
                                                        }`}
                                                />
                                            </div>
                                            <span className="text-[10px] text-foreground/40 font-black">
                                                {quest.completed ? "COMPLETED" : `${quest.progress}/${quest.target}`}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )
                }

                {/* Smart Review Card */}
                <section>
                    <motion.div
                        whileHover={prefersMotion ? { y: -4, scale: 1.01 } : {}}
                        whileTap={prefersMotion ? { scale: 0.98 } : {}}
                    >
                        <Link
                            href="/review"
                            className={`block p-6 rounded-2xl border transition-all duration-300 group shadow-xl ${dueCount > 0
                                ? "border-foreground bg-foreground text-background shadow-foreground/10"
                                : "border-foreground/10 bg-foreground/2 opacity-60 hover:opacity-100"}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <motion.div
                                        animate={(dueCount > 0 && prefersMotion) ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                                        transition={{ duration: 3, repeat: Infinity }}
                                        className="w-12 h-12 rounded-2xl bg-foreground/10 flex items-center justify-center"
                                    >
                                        <Zap className={`w-6 h-6 ${dueCount > 0 ? "text-yellow-400 fill-yellow-400" : "text-foreground/40"}`} />
                                    </motion.div>
                                    <div>
                                        <h2 className="text-lg font-bold">Smart Review</h2>
                                        <p className={`text-xs mt-1 ${dueCount > 0 ? "text-background/70" : "text-foreground/50"}`}>
                                            {dueCount > 0
                                                ? `You have ${dueCount} items ready for review`
                                                : "No items due right now. Keep it up!"}
                                        </p>
                                    </div>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${dueCount > 0 ? "border-background/20 group-hover:bg-background/10" : "border-foreground/10"}`}>
                                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                </section>


                {/* Stats */}
                {
                    profile.totalQuizzes > 0 && (
                        <div className="p-4 rounded-xl border border-foreground/10 bg-foreground/2">
                            <h2 className="text-sm font-semibold text-foreground/70 mb-3 uppercase tracking-wider">
                                Stats
                            </h2>
                            <div className="grid grid-cols-3 gap-4 text-center text-sm">
                                <div>
                                    <p className="font-bold">{profile.totalCorrect}</p>
                                    <p className="text-xs text-foreground/40">Correct</p>
                                </div>
                                <div>
                                    <p className="font-bold">{profile.totalQuestions}</p>
                                    <p className="text-xs text-foreground/40">Attempted</p>
                                </div>
                                <div>
                                    <p className="font-bold">
                                        {profile.totalQuestions > 0
                                            ? Math.round((profile.totalCorrect / profile.totalQuestions) * 100)
                                            : 0}
                                        %
                                    </p>
                                    <p className="text-xs text-foreground/40">Accuracy</p>
                                </div>
                            </div>
                        </div>
                    )
                }
                {/* Chat Overlay Removed - Moved to dedicated /chat page */}

                {/* Broadcast Modal */}
                {
                    showBroadcastModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="bg-background border border-foreground/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-6"
                            >
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <Megaphone className="w-5 h-5 text-blue-500" />
                                        Authority Broadcast
                                    </h2>
                                    <button onClick={() => setShowBroadcastModal(false)} className="text-foreground/40 hover:text-foreground">✕</button>
                                </div>

                                <p className="text-xs text-foreground/50 font-medium">Select a template to pin a system banner (2/week quota).</p>

                                <div className="space-y-3">
                                    {[
                                        { id: "study_focus", name: "Study Focus", icon: Zap },
                                        { id: "event_boost", name: "Event Boost", icon: Sparkles },
                                        { id: "league_cheer", name: "League Cheer", icon: Trophy },
                                        { id: "rank_motivate", name: "Motivation", icon: ChevronRight }
                                    ].map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={async () => {
                                                try {
                                                    const token = await user?.getIdToken();
                                                    const res = await fetch("/api/announcements", {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type": "application/json",
                                                            Authorization: `Bearer ${token}`
                                                        },
                                                        body: JSON.stringify({ templateId: template.id })
                                                    });
                                                    if (res.ok) {
                                                        setShowBroadcastModal(false);
                                                        // Soft refresh for announcement
                                                        const annRes = await fetch("/api/announcements");
                                                        const annData = await annRes.json();
                                                        setAnnouncement(annData.announcement);
                                                    } else {
                                                        const data = await res.json();
                                                        alert(data.error || "Failed to post");
                                                    }
                                                } catch (err) {
                                                    console.error(err);
                                                }
                                            }}
                                            className="w-full p-4 rounded-xl bg-foreground/2 border border-foreground/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <template.icon className="w-4 h-4 text-foreground/40 group-hover:text-blue-500 transition-colors" />
                                                <span className="text-sm font-bold">{template.name}</span>
                                            </div>
                                            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setShowBroadcastModal(false)}
                                    className="w-full py-3 bg-foreground/5 text-foreground text-sm font-bold rounded-xl hover:bg-foreground/10 transition-colors"
                                >
                                    Cancel
                                </button>
                            </motion.div>
                        </div>
                    )
                }
            </main >

            <BottomNav />
        </div >
    );
}

const LEAGUE_COLORS: Record<string, string> = {
    "Diamond": "text-sky-400",
    "Platinum": "text-slate-300",
    "Gold": "text-yellow-500",
    "Silver": "text-gray-400",
    "Bronze": "text-orange-600"
};

function CountdownLabel({ targetDate, label, color, compact }: { targetDate: number; label: string; color: string; compact?: boolean }) {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        function update() {
            const now = Date.now();
            const diff = targetDate - now;
            if (diff <= 0) {
                setTimeLeft("00:00:00");
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            if (days > 0 && !compact) {
                setTimeLeft(`${days}d ${hours}h`);
            } else if (days > 0 && compact) {
                setTimeLeft(`${days}d ${hours}h`);
            } else {
                setTimeLeft(`${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
            }
        }

        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [targetDate, compact]);

    return (
        <div className={compact ? "flex items-center gap-1" : ""}>
            {label && <p className={`text-[10px] font-mono uppercase opacity-60 ${color}`}>{label}</p>}
            <p className={`text-sm font-bold font-mono ${color} ${compact ? "text-[10px]" : ""}`}>{timeLeft}</p>
        </div>
    );
}
