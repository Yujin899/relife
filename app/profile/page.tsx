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
    X,
    Edit2,
} from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { useNotifications } from "@/lib/notifications";
import BottomNav from "@/components/BottomNav";
import { AnimatePresence } from "framer-motion";

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
    const { user, signOut } = useAuth();
    const { showNotification } = useNotifications();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [shopItems, setShopItems] = useState<ShopItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"all" | "frames" | "themes" | "consumables">("all");
    const [updating, setUpdating] = useState<string | null>(null);
    const [badges, setBadges] = useState<Badge[]>([]);
    const [isZoomed, setIsZoomed] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editName, setEditName] = useState("");

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
            const payload: Record<string, string | null> = {};
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
        } catch {
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

    const handleUpdateProfile = async () => {
        if (!user || !editName.trim() || uploading) return;
        setUploading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/user/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ displayName: editName.trim() }),
            });
            if (!res.ok) throw new Error("Failed to update profile");
            showNotification({ title: "Profile Updated!", message: "Your name has been updated.", type: "success" });
            setShowEditModal(false);
        } catch {
            showNotification({ title: "Error", message: "Failed to update profile", type: "error" });
        } finally {
            setUploading(false);
        }
    };

    const handleAvatarEdit = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || uploading) return;

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

            // 2. Update via our API
            const token = await user.getIdToken();
            const res = await fetch("/api/user/profile", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ photoURL })
            });

            if (!res.ok) throw new Error("Failed to update avatar");

            showNotification({ title: "Success", message: "Avatar updated!", type: "success" });
        } catch (err) {
            const error = err as Error;
            showNotification({
                title: "Upload Failed",
                message: error.message || "Something went wrong",
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

    const inventoryItems = shopItems.filter(item =>
        profile.inventory.includes(item.id) ||
        (item.id === "frame_blue_neon" && profile.inventory.includes("frame_1"))
    );
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
                            <button
                                onClick={() => setIsZoomed(true)}
                                className="relative z-10 block transition-transform active:scale-95"
                            >
                                <UserAvatar
                                    src={profile.photoURL}
                                    fallback={profile.displayName}
                                    frame={profile.frame}
                                    size="xl"
                                    className="w-32 h-32 text-4xl shadow-2xl"
                                />
                            </button>

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

                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-black tracking-tight text-center">{profile?.displayName || "Adventurer"}</h1>
                            <button
                                onClick={() => {
                                    setEditName(profile?.displayName || "");
                                    setShowEditModal(true);
                                }}
                                className="p-2 rounded-xl bg-foreground/5 text-foreground/40 hover:text-foreground/70 hover:bg-foreground/10 transition-all border border-foreground/5 shadow-sm"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                        </div>

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
                                        onClick={() => handleEquip({ id: "theme_default", name: "Default", type: "cosmetic", icon: "sparkles", description: "Default Theme", cost: 0 })}
                                        className="px-3 py-1.5 bg-foreground text-background rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        Equip
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Frames Section - Horizontal Slider */}
                    {(activeTab === "all" || activeTab === "frames") && (
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground/40 ml-2">Choose Your Frame</h3>
                            <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar -mx-4 px-4 scroll-smooth">
                                {/* Unequip Option */}
                                <button
                                    onClick={handleUnequipFrame}
                                    className={`shrink-0 w-20 flex flex-col items-center gap-2 group transition-all ${!profile.frame ? "scale-105" : "opacity-40 hover:opacity-100"}`}
                                >
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 border-dashed ${!profile.frame ? "border-blue-500 bg-blue-500/5" : "border-foreground/10"}`}>
                                        <X className={`w-6 h-6 ${!profile.frame ? "text-blue-500" : "text-foreground/20"}`} />
                                    </div>
                                    <span className="text-[10px] font-black text-center truncate w-full uppercase tracking-tighter">None</span>
                                </button>

                                {/* League Frames */}
                                {["Bronze", "Silver", "Gold", "Platinum", "Diamond"].map((l) => {
                                    const leagueOrder = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
                                    const userLeagueIndex = leagueOrder.indexOf(profile.league || "Bronze");
                                    const frameLeagueIndex = leagueOrder.indexOf(l);
                                    if (frameLeagueIndex > userLeagueIndex) return null;

                                    const isEquipped = profile.frame?.toLowerCase().includes(l.toLowerCase());
                                    return (
                                        <button
                                            key={l}
                                            onClick={() => handleEquip({ id: `league_frame_${l.toLowerCase()}`, name: `${l} Frame`, type: "cosmetic", icon: l, description: "League Reward", cost: 0 })}
                                            className={`shrink-0 w-20 flex flex-col items-center gap-2 group transition-all ${isEquipped ? "scale-105" : "opacity-50 hover:opacity-100"}`}
                                        >
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center relative ${isEquipped ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background bg-blue-500/5 shadow-lg shadow-blue-500/20" : "bg-foreground/5 border border-foreground/10"}`}>
                                                <UserAvatar src={profile.photoURL} fallback={profile.displayName} league={l} frame={l} size="sm" />
                                                {isEquipped && (
                                                    <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white rounded-full p-1 shadow-lg border-2 border-background">
                                                        <Check className="w-2 h-2" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-black text-center truncate w-full uppercase tracking-tighter">{l}</span>
                                        </button>
                                    );
                                })}

                                {/* Purchased Frames */}
                                {inventoryItems.filter(i => i.id.startsWith("frame_")).map((item) => {
                                    const isEquipped = profile.frame === item.icon || profile.frame === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => handleEquip(item)}
                                            className={`shrink-0 w-20 flex flex-col items-center gap-2 group transition-all ${isEquipped ? "scale-105" : "opacity-50 hover:opacity-100"}`}
                                        >
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center relative ${isEquipped ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background bg-blue-500/5 shadow-lg shadow-blue-500/20" : "bg-foreground/5 border border-foreground/10"}`}>
                                                <UserAvatar src={profile.photoURL} fallback={profile.displayName} frame={item.icon} size="sm" />
                                                {isEquipped && (
                                                    <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white rounded-full p-1 shadow-lg border-2 border-background">
                                                        <Check className="w-2 h-2" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-black text-center truncate w-full uppercase tracking-tighter">{item.name.replace(" Frame", "")}</span>
                                        </button>
                                    );
                                })}
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
                        {filteredItems.filter(i => !i.id.startsWith("frame_")).map((item) => {
                            const isEquipped =
                                (item.id.startsWith("theme_") && profile.activeTheme === item.id);
                            return (
                                <motion.div
                                    key={item.id}
                                    layout
                                    className={`relative p-4 rounded-2xl border transition-all flex items-center gap-4 group ${isEquipped ? "border-blue-500/30 bg-blue-500/5" : "border-foreground/10 bg-background hover:border-foreground/20"}`}
                                >
                                    <div className="w-12 h-12 flex-shrink-0 bg-foreground/5 rounded-xl flex items-center justify-center text-2xl overflow-hidden relative">
                                        <LucideIcon name={item.icon} className="w-6 h-6 opacity-70" />
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
                    </div>
                </div>

                <div className="h-10" />
                <Link href="/dashboard" className="hidden sm:block text-center text-sm font-medium text-foreground/40 hover:text-foreground transition">
                    ← Back to Dashboard
                </Link>
            </main>
            <BottomNav />

            {/* Avatar Zoom Overlay */}
            <AnimatePresence>
                {isZoomed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
                        onClick={() => setIsZoomed(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            className="relative max-w-[80vw] max-h-[80vh] w-64 h-64 sm:w-96 sm:h-96 aspect-square flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <UserAvatar
                                src={profile.photoURL}
                                fallback={profile.displayName}
                                frame={profile.frame}
                                size="full"
                                className="w-full h-full text-7xl"
                            />
                            <button
                                onClick={() => setIsZoomed(false)}
                                className="absolute -top-16 sm:-top-20 right-0 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md border border-white/10 shadow-xl"
                            >
                                <X className="w-6 h-6 sm:w-8 sm:h-8" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Profile Modal */}
            <AnimatePresence>
                {showEditModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                            onClick={() => setShowEditModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative w-full max-w-md bg-background border border-foreground/10 p-8 rounded-[2.5rem] shadow-2xl overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-6">
                                <button onClick={() => setShowEditModal(false)} className="p-2 rounded-full hover:bg-foreground/5 text-foreground/40 transition">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-black tracking-tight mb-2">Edit Profile</h2>
                                <p className="text-sm text-foreground/50 font-medium tracking-tight">Personalize your identity</p>
                            </div>

                            <div className="space-y-6">
                                {/* Avatar Edit */}
                                <div className="flex flex-col items-center">
                                    <div className="relative group/edit">
                                        <UserAvatar
                                            src={profile.photoURL}
                                            fallback={profile.displayName}
                                            frame={profile.frame}
                                            size="xl"
                                            className="w-24 h-24 text-2xl"
                                        />
                                        <button
                                            onClick={() => document.getElementById("avatar-upload")?.click()}
                                            className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover/edit:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                                        >
                                            <Camera className="w-6 h-6 text-white" />
                                        </button>
                                        <input
                                            id="avatar-upload"
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleAvatarEdit}
                                        />
                                        {uploading && (
                                            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                                                <Loader2 className="w-6 h-6 animate-spin text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => document.getElementById("avatar-upload")?.click()}
                                        className="mt-3 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition"
                                    >
                                        Change Photo
                                    </button>
                                </div>

                                {/* Name Edit */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40 ml-2">Display Name</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Your Name"
                                        className="w-full px-6 py-4 rounded-2xl bg-foreground/5 border border-foreground/5 focus:border-blue-500 outline-none font-bold transition-all text-center"
                                    />
                                </div>

                                <button
                                    onClick={handleUpdateProfile}
                                    disabled={uploading || !editName.trim() || editName === profile.displayName}
                                    className="w-full py-5 bg-foreground text-background font-black rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                                >
                                    {uploading ? (
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                    ) : (
                                        "Save Changes"
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
