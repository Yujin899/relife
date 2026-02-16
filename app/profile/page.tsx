"use client";

import { useState, useEffect } from "react";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import UserAvatar from "@/components/UserAvatar";
import LucideIcon from "@/components/LucideIcon";
import { motion } from "framer-motion";
import {
    Trophy,
    Package,
    Check,
    Loader2,
    Camera,
    Medal,
    ChevronLeft,
    LogOut,
} from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { useNotifications } from "@/lib/notifications";
import BottomNav from "@/components/BottomNav";

interface UserProfile {
    displayName: string;
    photoURL: string;
    totalGold: number;
    inventory: string[];
    frame?: string;
    activeTheme?: string;
    totalCorrect: number;
    totalQuestions: number;
    totalQuizzes?: number;
    league?: string;
    profileUpdates?: number;
}

interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    earned: boolean;
}

interface ShopItem {
    id: string;
    name: string;
    description: string;
    type: "consumable" | "cosmetic";
    icon: string;
    cost: number;
}

export default function ProfilePage() {
    return (
        <AuthGuard>
            <ProfileContent />
        </AuthGuard>
    );
}

function ProfileContent() {
    const { user } = useAuth();
    const { showNotification } = useNotifications();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [shopItems, setShopItems] = useState<ShopItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"all" | "frames" | "themes" | "consumables">("all");
    const [updating, setUpdating] = useState<string | null>(null);
    const [badges, setBadges] = useState<Badge[]>([]);

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setProfile({
                    displayName: data.displayName || user.displayName || "User",
                    photoURL: data.photoURL || user.photoURL || "",
                    totalGold: data.totalGold || 0,
                    inventory: data.inventory || [],
                    frame: data.frame,
                    activeTheme: data.activeTheme || "default",
                    totalCorrect: data.totalCorrect || 0,
                    totalQuestions: data.totalQuestions || 0,
                    totalQuizzes: data.totalQuizzes || 0,
                    league: data.league || "Bronze",
                    profileUpdates: data.profileUpdates || 0,
                });
            }
        });

        const fetchShop = async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/shop", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.items) setShopItems(data.items);
            } catch (err) {
                console.error("Failed to fetch shop items", err);
            } finally {
                setLoading(false);
            }
        };

        const fetchBadges = async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/achievements", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.badges) {
                    setBadges(data.badges.filter((b: Badge) => b.earned));
                }
            } catch (err) {
                console.error("Failed to fetch badges", err);
            }
        };

        fetchShop();
        fetchBadges();
        return () => unsub();
    }, [user]);

    const handleEquip = async (item: ShopItem) => {
        if (!user || updating) return;
        setUpdating(item.id);
        try {
            const token = await user.getIdToken();
            const payload: any = {};
            if (item.id.startsWith("theme_")) {
                payload.activeTheme = item.id;
            } else if (item.id.startsWith("frame_")) {
                payload.frame = item.id === "frame_none" ? null : item.id;
            } else if (item.id.startsWith("league_frame_")) {
                payload.frame = item.icon;
            } else {
                setUpdating(null);
                return;
            }
            const res = await fetch("/api/user/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed");
            showNotification({ title: "Equipped!", message: `Equipped ${item.name}`, type: "success" });
        } catch (err) {
            showNotification({ title: "Error", message: "Failed to equip item", type: "error" });
        } finally {
            setUpdating(null);
        }
    };

    const handleUnequipFrame = async () => {
        if (!user || updating) return;
        setUpdating("unequip_frame");
        try {
            const token = await user.getIdToken();
            await fetch("/api/user/settings", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ frame: null }),
            });
            showNotification({ title: "Updated", message: "Frame removed", type: "success" });
        } catch {
            showNotification({ title: "Error", message: "Failed to unequip", type: "error" });
        } finally {
            setUpdating(null);
        }
    };

    const [uploading, setUploading] = useState(false);

    const handleAvatarEdit = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || uploading) return;

        if ((profile?.profileUpdates || 0) <= 0) {
            showNotification({
                title: "No Updates Available",
                message: "Please purchase a Profile Image Update from the shop.",
                type: "error"
            });
            return;
        }

        setUploading(true);
        try {
            // 1. Upload to Cloudinary
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
            formData.append("cloud_name", process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "");

            const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: formData,
            });

            if (!cloudinaryRes.ok) throw new Error("Cloudinary upload failed");
            const cloudinaryData = await cloudinaryRes.json();
            const photoURL = cloudinaryData.secure_url;

            // 2. Update via our API (this handles token consumption)
            const token = await user.getIdToken();
            const res = await fetch("/api/user/avatar", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ photoURL })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update avatar");
            }

            showNotification({ title: "Success", message: "Avatar updated!", type: "success" });
        } catch (err: any) {
            showNotification({
                title: "Upload Failed",
                message: err.message || "Something went wrong",
                type: "error"
            });
        } finally {
            setUploading(false);
            if (e.target) e.target.value = "";
        }
    };

    if (loading || !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-foreground/20" />
            </div>
        );
    }

    const inventoryItems = shopItems.filter(item => profile.inventory.includes(item.id));
    const filteredItems = inventoryItems.filter(item => {
        if (activeTab === "all") return true;
        if (activeTab === "frames") return item.id.startsWith("frame_");
        if (activeTab === "themes") return item.id.startsWith("theme_");
        if (activeTab === "consumables") return item.type === "consumable";
        return true;
    });

    const accuracy = profile.totalQuestions > 0
        ? Math.round((profile.totalCorrect / profile.totalQuestions) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-background text-foreground pb-20 sm:pb-0">
            <Script src="https://widget.cloudinary.com/v2.0/global/all.js" strategy="lazyOnload" />

            <header className="pt-6 pb-12 px-4 bg-gradient-to-b from-foreground/5 to-transparent border-b border-foreground/5">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <Link href="/dashboard" className="p-2 -ml-2 text-foreground/40 hover:text-foreground transition flex items-center gap-1">
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
                        </Link>
                        <button
                            onClick={() => signOut()}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/5 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all border border-red-500/10"
                        >
                            <LogOut className="w-3 h-3" />
                            Sign Out
                        </button>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="relative mb-6 group/avatar">
                            <UserAvatar
                                src={profile.photoURL}
                                fallback={profile.displayName}
                                frame={profile.frame}
                                size="xl"
                                className="w-32 h-32 text-4xl shadow-2xl"
                                editable={true}
                                onEdit={() => document.getElementById("avatar-input")?.click()}
                            />
                            <input
                                id="avatar-input"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAvatarEdit}
                            />
                            {uploading && (
                                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center z-30">
                                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                                </div>
                            )}
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-background border border-foreground/10 px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                                <Trophy className="w-3 h-3 text-yellow-500" />
                                <span className="text-xs font-bold text-foreground/80">{profile?.league || "Bronze"}</span>
                            </div>
                        </div>

                        <h1 className="text-2xl font-black tracking-tight mb-2 text-center">{profile?.displayName || "Adventurer"}</h1>

                        <div className="flex items-center gap-2 text-sm font-medium text-foreground/60 mb-6">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 text-yellow-500 rounded-full border border-yellow-500/20">
                                <span className="font-black">{profile?.totalGold?.toLocaleString() || 0}</span> G
                            </div>
                            {profile?.profileUpdates !== undefined && (
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${profile.profileUpdates > 0 ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-foreground/5 text-foreground/40 border-foreground/5"}`}>
                                    <Camera className="w-3 h-3" />
                                    <span className="font-black">{profile.profileUpdates}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 -mt-6">
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-10">
                    <div className="bg-background border border-foreground/10 p-3 sm:p-4 rounded-2xl shadow-sm text-center">
                        <div className="text-xl sm:text-2xl font-black mb-1">{profile?.totalCorrect || 0}</div>
                        <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Correct</div>
                    </div>
                    <div className="bg-background border border-foreground/10 p-3 sm:p-4 rounded-2xl shadow-sm text-center">
                        <div className="text-xl sm:text-2xl font-black mb-1">{accuracy}%</div>
                        <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Accuracy</div>
                    </div>
                    <div className="bg-background border border-foreground/10 p-3 sm:p-4 rounded-2xl shadow-sm text-center">
                        <div className="text-xl sm:text-2xl font-black mb-1">{profile?.totalQuizzes || 0}</div>
                        <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Quizzes</div>
                    </div>
                </div>

                {/* Badges Section - Horizontal Scroll */}
                {badges.length > 0 && (
                    <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Medal className="w-5 h-5 text-amber-500" />
                                Badges
                            </h2>
                            <Link href="/achievements" className="text-[10px] font-black uppercase tracking-widest text-foreground/40 hover:text-foreground transition">
                                View All →
                            </Link>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-1 px-1">
                            {badges.map((badge) => (
                                <div
                                    key={badge.id}
                                    className="flex-shrink-0 w-28 p-4 rounded-[2rem] border border-amber-500/20 bg-gradient-to-b from-amber-500/10 to-transparent text-center flex flex-col items-center group hover:border-amber-500/40 transition-all shadow-lg shadow-amber-500/5"
                                >
                                    <div className="text-3xl mb-3 group-hover:scale-125 transition-transform drop-shadow-lg">{badge.icon}</div>
                                    <p className="text-[10px] font-black text-amber-900/80 dark:text-amber-200/80 uppercase tracking-tight truncate w-full">{badge.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Package className="w-5 h-5 opacity-70" />
                            Your Bag
                        </h2>
                        <Link href="/shop" className="text-xs font-bold text-blue-500 hover:underline">
                            Visit Shop →
                        </Link>
                    </div>

                    <div className="flex p-1 bg-foreground/5 rounded-xl gap-1 overflow-x-auto no-scrollbar">
                        {(["all", "frames", "themes", "consumables"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`
                                    flex-1 px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap
                                    ${activeTab === tab
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-foreground/50 hover:bg-foreground/5 hover:text-foreground/70"
                                    }
                                `}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {(activeTab === "all" || activeTab === "themes") && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="relative p-5 rounded-2xl border border-foreground/10 bg-background hover:border-foreground/20 transition-all flex items-center gap-4 group">
                                <div className="w-12 h-12 flex-shrink-0 bg-foreground/5 rounded-xl flex items-center justify-center text-2xl">✨</div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-sm truncate">Default Theme</h3>
                                    <p className="text-xs text-foreground/50 truncate">Classic Look</p>
                                </div>
                                {profile?.activeTheme === "default" ? (
                                    <div className="px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-[10px] font-bold flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Equipped
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleEquip({ id: "theme_default", name: "Default", type: "cosmetic" } as any)}
                                        className="px-3 py-1.5 bg-foreground text-background rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        Equip
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {filteredItems.length === 0 && activeTab !== "all" && activeTab !== "themes" && activeTab !== "frames" && (
                        <div className="text-center py-12 border-2 border-dashed border-foreground/10 rounded-2xl">
                            <div className="text-4xl mb-3 opacity-30">🎒</div>
                            <p className="text-foreground/40 text-sm font-medium">Nothing here yet.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* League Frames - Dynamically added to frames tab */}
                        {(activeTab === "all" || activeTab === "frames") && (
                            <>
                                {["Bronze", "Silver", "Gold", "Platinum", "Diamond"].map((l) => {
                                    // User must have reached this league to "own" the frame?
                                    // Actually, let's just show them if they are in that league or higher
                                    // For now, let's just provide them as always available based on current league rank
                                    const leagueOrder = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
                                    const userLeagueIndex = leagueOrder.indexOf(profile.league || "Bronze");
                                    const frameLeagueIndex = leagueOrder.indexOf(l);

                                    if (frameLeagueIndex > userLeagueIndex) return null;

                                    const frameId = `league_frame_${l.toLowerCase()}`;
                                    const isEquipped = profile.frame === l;

                                    return (
                                        <motion.div
                                            key={frameId}
                                            layout
                                            className={`relative p-4 rounded-2xl border transition-all flex items-center gap-4 group ${isEquipped ? "border-blue-500/30 bg-blue-500/5" : "border-foreground/10 bg-background hover:border-foreground/20"}`}
                                        >
                                            <div className="w-12 h-12 flex-shrink-0 bg-foreground/5 rounded-xl flex items-center justify-center text-2xl overflow-hidden relative">
                                                <UserAvatar src={profile.photoURL} fallback={profile.displayName} league={l} frame={null} size="sm" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-sm truncate">{l} Frame</h3>
                                                <p className="text-xs text-foreground/50 truncate pr-2">League Reward</p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {isEquipped ? (
                                                    <div className="px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-[10px] font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Equipped</div>
                                                ) : (
                                                    <button onClick={() => handleEquip({ id: frameId, name: `${l} Frame`, type: "cosmetic", icon: l } as any)} className="px-3 py-1.5 bg-foreground text-background rounded-lg text-xs font-bold sm:opacity-0 group-hover:opacity-100 transition-opacity">Equip</button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </>
                        )}

                        {filteredItems.map((item) => {
                            const isEquipped =
                                (item.id.startsWith("theme_") && profile.activeTheme === item.id) ||
                                (item.id.startsWith("frame_") && (profile.frame === item.icon || profile.frame === item.id));
                            return (
                                <motion.div
                                    key={item.id}
                                    layout
                                    className={`relative p-4 rounded-2xl border transition-all flex items-center gap-4 group ${isEquipped ? "border-blue-500/30 bg-blue-500/5" : "border-foreground/10 bg-background hover:border-foreground/20"}`}
                                >
                                    <div className="w-12 h-12 flex-shrink-0 bg-foreground/5 rounded-xl flex items-center justify-center text-2xl overflow-hidden relative">
                                        {item.id.startsWith("frame_") ? (
                                            <UserAvatar src={profile.photoURL} fallback={profile.displayName} frame={item.icon} size="sm" />
                                        ) : (
                                            <LucideIcon name={item.icon} className="w-6 h-6 opacity-70" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm truncate">{item.name}</h3>
                                        <p className="text-xs text-foreground/50 truncate pr-2">{item.description}</p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {isEquipped ? (
                                            <div className="px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-[10px] font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Equipped</div>
                                        ) : (
                                            item.type === "cosmetic" && (
                                                <button onClick={() => handleEquip(item)} className="px-3 py-1.5 bg-foreground text-background rounded-lg text-xs font-bold sm:opacity-0 group-hover:opacity-100 transition-opacity">Equip</button>
                                            )
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                        {activeTab === "frames" && profile.frame && (
                            <button onClick={handleUnequipFrame} className="col-span-full p-3 text-xs font-bold text-red-500 hover:bg-red-500/5 rounded-xl transition-colors border border-transparent hover:border-red-500/10 dashed">Unequip Current Frame</button>
                        )}
                    </div>
                </div>

                <div className="h-10" />
                <Link href="/dashboard" className="hidden sm:block text-center text-sm font-medium text-foreground/40 hover:text-foreground transition">
                    ← Back to Dashboard
                </Link>
            </main>
            <BottomNav />
        </div>
    );
}
