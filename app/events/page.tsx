"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";

interface Event {
    id: string;
    title: string;
    description: string;
    icon: string;
    status: "active" | "past" | "upcoming";
    target: number;
    userProgress: number;
    completed: boolean;
    claimed: boolean;
    isJoined: boolean;
    serverTime: number;
    startTimestamp: number;
    endTimestamp: number;
    rewards: {
        gold: number;
        badgeId?: string;
    };
}

interface Participant {
    userId: string;
    displayName: string;
    progress: number;
    leagueBadge: string;
}

export default function EventsPage() {
    return (
        <AuthGuard>
            <EventsContent />
        </AuthGuard>
    );
}

function EventsContent() {
    const { user } = useAuth();
    const { showNotification } = useNotifications();
    const router = useRouter();

    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [claimingId, setClaimingId] = useState<string | null>(null);

    useEffect(() => {
        async function loadEvents() {
            if (!user) return;
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/events", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                setEvents(data.events || []);
            } catch {
                console.error("Failed to load events");
            } finally {
                setLoading(false);
            }
        }
        loadEvents();
    }, [user]);

    const handleJoin = async (eventId: string) => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/events/subscribe", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ eventId }),
            });

            const data = await res.json();
            if (data.error) {
                showNotification({ title: "Error", message: data.error, type: "error" });
            } else {
                showNotification({ title: "Welcome!", message: "You've joined the event!", type: "success", icon: "🎟️" });
                setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isJoined: true } : e));
            }
        } catch {
            showNotification({ title: "Error", message: "Failed to join event", type: "error" });
        }
    };

    const handleClaim = async (eventId: string) => {
        if (!user || claimingId) return;
        setClaimingId(eventId);

        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/events/claim", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ eventId }),
            });

            const data = await res.json();
            if (data.error) {
                showNotification({
                    title: "Error",
                    message: data.error,
                    type: "error"
                });
            } else {
                showNotification({
                    title: "Reward Claimed!",
                    message: `You received ${data.rewardGold} gold!`,
                    type: "success",
                    icon: "🪙"
                });

                // Update local state
                setEvents(prev => prev.map(e =>
                    e.id === eventId ? { ...e, claimed: true } : e
                ));
            }
        } catch {
            showNotification({
                title: "Error",
                message: "Failed to claim reward",
                type: "error"
            });
        } finally {
            setClaimingId(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    const activeEvents = events.filter(e => e.status === "active");
    const upcomingEvents = events.filter(e => e.status === "upcoming");
    const pastEvents = events.filter(e => e.status === "past");

    return (
        <div className="min-h-screen bg-background pb-20 sm:pb-0">
            <header className="border-b border-foreground/10 px-4 py-4 sticky top-0 bg-background/80 backdrop-blur-md z-10">
                <div className="max-w-2xl mx-auto flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-foreground/50 hover:text-foreground hidden sm:block">
                        ←
                    </button>
                    <h1 className="text-lg font-bold">Events Hub</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 space-y-12">
                {/* Active Events */}
                <section>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        Active Now
                    </h2>

                    {activeEvents.length > 0 ? (
                        <div className="grid gap-8">
                            {activeEvents.map(event => (
                                <div key={event.id} className="space-y-6">
                                    <div className="p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 space-y-6 relative overflow-hidden group">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <span className="text-4xl">{event.icon}</span>
                                                <div>
                                                    <h3 className="text-lg font-bold">{event.title}</h3>
                                                    <p className="text-sm text-foreground/60">{event.description}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <CountdownLabel targetDate={event.endTimestamp} label="Ends in" color="text-blue-500" />
                                            </div>
                                        </div>

                                        {event.isJoined ? (
                                            <>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-foreground/40 font-medium tracking-tight">Your Progress</span>
                                                        <span className="font-bold font-mono text-blue-600">{event.userProgress} / {event.target}</span>
                                                    </div>
                                                    <div className="h-2 bg-blue-500/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                                            style={{ width: `${Math.min(100, (event.userProgress / event.target) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="pt-2">
                                                    {event.claimed ? (
                                                        <div className="w-full py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-center text-sm font-bold flex items-center justify-center gap-2">
                                                            ✓ Reward Claimed
                                                        </div>
                                                    ) : event.completed ? (
                                                        <button
                                                            onClick={() => handleClaim(event.id)}
                                                            disabled={!!claimingId}
                                                            className="w-full py-3 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition transform active:scale-95 disabled:opacity-50 cursor-pointer shadow-xl shadow-foreground/10"
                                                        >
                                                            {claimingId === event.id ? "Claiming..." : `Claim ${event.rewards.gold} Gold`}
                                                        </button>
                                                    ) : (
                                                        <div className="w-full py-3 rounded-xl border border-blue-500/10 bg-blue-500/5 text-blue-500/50 text-center text-sm font-bold animate-pulse">
                                                            Active: Finish your quizzes!
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleJoin(event.id)}
                                                className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition transform active:scale-95"
                                            >
                                                Join Event & Track Progress
                                            </button>
                                        )}
                                    </div>

                                    {/* Participants Board */}
                                    {event.isJoined && <ParticipantsBoard eventId={event.id} />}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center rounded-2xl border border-dashed border-foreground/10 opacity-30">
                            <p className="text-sm italic">Nothing active right now.</p>
                        </div>
                    )}
                </section>

                {/* Upcoming Events */}
                {upcomingEvents.length > 0 && (
                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-purple-500 mb-6">Starting Soon</h2>
                        <div className="grid gap-4">
                            {upcomingEvents.map(event => (
                                <div key={event.id} className="p-6 rounded-2xl border border-purple-500/10 bg-purple-500/5 space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <span className="text-3xl grayscale">{event.icon}</span>
                                            <div>
                                                <h3 className="text-base font-bold text-purple-800">{event.title}</h3>
                                                <p className="text-xs text-foreground/50">{event.description}</p>
                                            </div>
                                        </div>
                                        <CountdownLabel targetDate={event.startTimestamp} label="Starts in" color="text-purple-600" />
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-purple-500/10">
                                        <div className="flex gap-3">
                                            <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded font-bold uppercase">🪙 {event.rewards.gold}g</span>
                                            {event.rewards.badgeId && <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded font-bold uppercase">🏆 Exclusive Badge</span>}
                                        </div>
                                        {!event.isJoined && (
                                            <button
                                                onClick={() => handleJoin(event.id)}
                                                className="text-xs font-bold text-purple-600 hover:underline"
                                            >
                                                Pre-register →
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* History */}
                {pastEvents.length > 0 && (
                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground/30 mb-6">Past Events</h2>
                        <div className="grid gap-3">
                            {pastEvents.map(event => (
                                <div key={event.id} className="p-4 rounded-xl border border-foreground/5 bg-foreground/1 flex items-center justify-between opacity-50 grayscale hover:grayscale-0 transition duration-300">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{event.icon}</span>
                                        <div>
                                            <h3 className="text-sm font-bold">{event.title}</h3>
                                            <p className="text-[10px] text-foreground/40 italic">Closed</p>
                                        </div>
                                    </div>
                                    {event.completed && (
                                        <span className="text-[10px] font-bold text-green-600 bg-green-500/5 px-2 py-1 rounded">✓ Event Completed</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
            <BottomNav />
        </div>
    );
}

function ParticipantsBoard({ eventId }: { eventId: string }) {
    const { user } = useAuth();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchParticipants() {
            if (!user) return;
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/events/participants?eventId=${eventId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                setParticipants(data.participants || []);
            } catch (error) {
                console.error("Failed to load participants", error);
            } finally {
                setLoading(false);
            }
        }
        fetchParticipants();
    }, [eventId, user]);

    if (loading) return null;
    if (participants.length === 0) return null;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 mb-3 px-2">Top Participants</h4>
            <div className="bg-foreground/2 border border-foreground/5 rounded-2xl divide-y divide-foreground/5 overflow-hidden">
                {participants.map((p, i) => (
                    <div key={p.userId} className={`flex items-center justify-between p-3 transition ${p.userId === user?.uid ? "bg-blue-500/5" : "hover:bg-foreground/1"}`}>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-foreground/20 w-4">{i + 1}</span>
                            <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold">
                                {p.displayName[0]}
                            </div>
                            <div className="min-w-0">
                                <p className={`text-xs font-bold truncate ${p.userId === user?.uid ? "text-blue-600" : ""}`}>
                                    {p.displayName} {p.userId === user?.uid && "(You)"}
                                </p>
                                <span className="text-[8px] uppercase tracking-widest text-foreground/30 font-medium">{p.leagueBadge} League</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold font-mono text-foreground/60">{p.progress} pts</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CountdownLabel({ targetDate, label, color }: { targetDate: number; label: string; color: string }) {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        function update() {
            const now = Date.now();
            const diff = targetDate - now;
            if (diff <= 0) {
                setTimeLeft("ENDED");
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            if (days > 0) {
                setTimeLeft(`${days}d ${hours}h`);
            } else {
                setTimeLeft(`${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
            }
        }

        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [targetDate]);

    return (
        <div>
            <p className={`text-[10px] font-mono uppercase opacity-60 tracking-tighter ${color}`}>{label}</p>
            <p className={`text-sm font-bold font-mono tracking-tight ${color}`}>{timeLeft}</p>
        </div>
    );
}
