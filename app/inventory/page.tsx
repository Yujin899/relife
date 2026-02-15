"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useNotifications } from "@/lib/notifications";

interface InventoryItem {
    id: string;
    name: string;
    description: string;
    type: "consumable" | "cosmetic";
    icon: string;
}

const ALL_ITEMS: Record<string, InventoryItem> = {
    streak_freeze: {
        id: "streak_freeze",
        name: "Streak Freeze",
        description: "Prevents your streak from resetting if you miss a day.",
        type: "consumable",
        icon: "❄️",
    },
    theme_midnight: {
        id: "theme_midnight",
        name: "Theme: Midnight",
        description: "A deep, dark blue theme for late night study sessions.",
        type: "cosmetic",
        icon: "🌙",
    },
    theme_royal: {
        id: "theme_royal",
        name: "Theme: Royal",
        description: "Add a touch of gold elegance to your interface.",
        type: "cosmetic",
        icon: "👑",
    },
};

export default function InventoryPage() {
    return (
        <AuthGuard>
            <InventoryContent />
        </AuthGuard>
    );
}

function InventoryContent() {
    const { user } = useAuth();
    const { showNotification } = useNotifications();
    const [profile, setProfile] = useState<{ inventory: string[]; streakFreezes: number; activeTheme: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setProfile({
                    inventory: data.inventory || [],
                    streakFreezes: data.streakFreezes || 0,
                    activeTheme: data.activeTheme || "default",
                });
            }
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    async function handleApplyTheme(themeId: string) {
        if (!user || updating) return;

        setUpdating(themeId);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/user/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ activeTheme: themeId }),
            });

            if (!res.ok) {
                const data = await res.json();
                showNotification({
                    title: "Action Failed",
                    message: data.error || "Could not apply theme",
                    type: "error"
                });
            } else {
                // The AuthProvider listener will catch the Firestore change and apply the CSS
                showNotification({
                    title: "Theme Applied",
                    message: `Changed theme to ${ALL_ITEMS[themeId]?.name || themeId}`,
                    type: "success"
                });
            }
        } catch {
            showNotification({
                title: "Error",
                message: "Failed to connect to server",
                type: "error"
            });
        } finally {
            setUpdating(null);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    const ownedThemes = (profile?.inventory || []).filter(id => id.startsWith("theme_"));
    const streakFreezes = profile?.streakFreezes || 0;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b border-foreground/10 bg-background/50 backdrop-blur-md sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-sm text-foreground/50 hover:text-foreground transition">
                            ← Dashboard
                        </Link>
                        <h1 className="text-xl font-bold tracking-tight">Your Inventory</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-12">
                {/* Streak Freezes Section */}
                <section>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>❄️</span> Consumables
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className={`p-6 rounded-2xl border transition-all duration-300 ${streakFreezes > 0 ? "border-cyan-500/30 bg-cyan-500/5" : "border-foreground/10 bg-foreground/5 opacity-50"}`}>
                            <div className="text-4xl mb-4">❄️</div>
                            <h3 className="text-lg font-bold mb-1">Streak Freeze</h3>
                            <p className="text-sm text-foreground/60 mb-4">
                                Protects your streak. Automatically used when you miss a day.
                            </p>
                            <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${streakFreezes > 0 ? "bg-cyan-500/20 text-cyan-500" : "bg-foreground/10 text-foreground/40"}`}>
                                    {streakFreezes > 0 ? `Owned: ${streakFreezes}` : "None"}
                                </span>
                                {streakFreezes === 0 && (
                                    <Link href="/shop" className="text-xs font-bold text-foreground/40 hover:text-foreground transition underline underline-offset-4">
                                        Visit Shop
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Themes Section */}
                <section>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>🎨</span> Themes
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Default Theme */}
                        <div
                            onClick={() => handleApplyTheme("default")}
                            className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 ${profile?.activeTheme === "default" ? "border-foreground bg-foreground/10 ring-2 ring-foreground/20" : "border-foreground/10 hover:border-foreground/30 bg-foreground/5"}`}
                        >
                            <div className="text-4xl mb-4">✨</div>
                            <h3 className="text-lg font-bold mb-1">Default Theme</h3>
                            <p className="text-sm text-foreground/60 mb-6">The original clean look.</p>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold opacity-50 uppercase tracking-widest">
                                    {profile?.activeTheme === "default" ? "Active" : "Standard"}
                                </span>
                                {profile?.activeTheme !== "default" && (
                                    <span className="text-xs font-bold text-foreground/40">Apply →</span>
                                )}
                            </div>
                        </div>

                        {/* Owned Themes */}
                        {ownedThemes.map((themeId) => {
                            const item = ALL_ITEMS[themeId];
                            if (!item) return null;
                            const isActive = profile?.activeTheme === themeId;

                            return (
                                <div
                                    key={themeId}
                                    onClick={() => handleApplyTheme(themeId)}
                                    className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 ${isActive ? "border-foreground bg-foreground/10 ring-2 ring-foreground/20" : "border-foreground/10 hover:border-foreground/30 bg-foreground/5"}`}
                                >
                                    <div className="text-4xl mb-4">{item.icon}</div>
                                    <h3 className="text-lg font-bold mb-1">{item.name}</h3>
                                    <p className="text-sm text-foreground/60 mb-6">{item.description}</p>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs font-bold uppercase tracking-widest ${isActive ? "text-foreground" : "opacity-30"}`}>
                                            {isActive ? "Active" : "Owned"}
                                        </span>
                                        {!isActive && (
                                            <span className="text-xs font-bold text-foreground/40">Apply →</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Empty State / Shop Link */}
                        {ownedThemes.length === 0 && (
                            <Link
                                href="/shop"
                                className="p-6 rounded-2xl border border-dashed border-foreground/20 hover:border-foreground/40 transition-all flex flex-col items-center justify-center text-center group"
                            >
                                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🛍️</div>
                                <h3 className="text-sm font-bold">Discovery more themes</h3>
                                <p className="text-[10px] text-foreground/40 mt-1">Visit the gold shop</p>
                            </Link>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
