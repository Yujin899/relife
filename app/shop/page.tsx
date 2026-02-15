"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useNotifications } from "@/lib/notifications";
import UserAvatar from "@/components/UserAvatar";
import BottomNav from "@/components/BottomNav";
import { ChevronLeft, ShoppingCart, Sparkles, Zap, Coins, Clock } from "lucide-react";
import LucideIcon from "@/components/LucideIcon";
import { motion } from "framer-motion";

export default function ShopPage() {
    return (
        <AuthGuard>
            <ShopContent />
        </AuthGuard>
    );
}

function ShopContent() {
    const { user } = useAuth();
    const { showNotification } = useNotifications();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [items, setItems] = useState<ShopItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setProfile({
                    totalGold: data.totalGold || 0,
                    inventory: data.inventory || [],
                    streakFreezes: data.streakFreezes || 0,
                });
            }
        });

        const fetchItems = async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch("/api/shop", {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const data = await res.json();
                if (data.items) setItems(data.items);
            } catch (err) {
                console.error("Failed to fetch shop items", err);
            } finally {
                setLoading(false);
            }
        };

        fetchItems();
        return () => unsub();
    }, [user]);

    async function handlePurchase(item: ShopItem) {
        if (!user || purchasing) return;
        setPurchasing(item.id);
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/shop", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ itemId: item.id }),
            });

            const data = await res.json();
            if (!res.ok) {
                showNotification({
                    title: "Purchase Failed",
                    message: data.error || "Something went wrong",
                    type: "error"
                });
            } else {
                showNotification({
                    title: "Purchase Successful!",
                    message: `You bought ${item.name}`,
                    type: "success"
                });
            }
        } catch {
            showNotification({
                title: "Error",
                message: "Failed to connect to shop",
                type: "error"
            });
        } finally {
            setPurchasing(null);
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
        <div className="min-h-screen bg-background text-foreground pb-24">
            {/* Header */}
            <header className="border-b border-foreground/10 bg-background/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 hover:bg-foreground/5 rounded-full transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-black italic uppercase tracking-tight flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-blue-500" />
                                Black Market
                            </h1>
                            <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-[0.2em]">Upgrade Your Experience</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-center gap-2 shadow-lg shadow-yellow-500/5"
                        >
                            <Coins className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm font-black text-yellow-500 italic">
                                {profile?.totalGold.toLocaleString()} G
                            </span>
                        </motion.div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {items.map((item) => {
                        const isOwned = item.id.startsWith("theme_") && profile?.inventory.includes(item.id);
                        const isFreezeCapped = item.id === "streak_freeze" && (profile?.streakFreezes ?? 0) >= (item.limit || 1);
                        const canAfford = (profile?.totalGold ?? 0) >= item.cost;
                        const isDisabled = isOwned || isFreezeCapped || !canAfford || !!purchasing;

                        let buttonText = "Acquire";
                        if (purchasing === item.id) buttonText = "Processing...";
                        else if (isOwned) buttonText = "Owned";
                        else if (isFreezeCapped) buttonText = "Max Capacity";
                        else if (!canAfford) buttonText = "Insufficient Gold";

                        const isFrame = item.id.startsWith("frame_");

                        return (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="relative p-8 rounded-[2.5rem] border border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-all duration-500 flex flex-col group overflow-hidden"
                            >
                                {/* Static Background Glow */}
                                <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/5 blur-[50px] rounded-full group-hover:bg-blue-500/10 transition-all duration-700" />

                                <div className="mb-8 flex justify-center group-hover:scale-110 transition-transform duration-500 relative z-10">
                                    {isFrame ? (
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-blue-500/10 blur-[30px] rounded-full group-hover:bg-blue-500/20 transition-all" />
                                            <UserAvatar
                                                src={user?.photoURL || undefined}
                                                fallback={user?.displayName || "User"}
                                                frame={item.icon}
                                                size="xl"
                                                className="shadow-2xl relative z-10"
                                            />
                                        </div>
                                    ) : (
                                        <div className={`
                                            w-24 h-24 rounded-3xl bg-gradient-to-br from-foreground/5 to-transparent flex items-center justify-center text-4xl shadow-xl shadow-black/5 border border-foreground/5 relative
                                            ${item.id === "streak_freeze" ? "text-cyan-500" : "text-amber-500"}
                                        `}>
                                            <LucideIcon name={item.icon} className="w-12 h-12" strokeWidth={1.5} />
                                            {item.id === "streak_freeze" && (
                                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-cyan-500 text-white rounded-full border-4 border-background flex items-center justify-center text-[10px] font-black">
                                                    {profile?.streakFreezes || 0}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="text-center mb-6 relative z-10">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${item.type === "cosmetic" ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"}`}>
                                            {item.type}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black tracking-tight mb-2 uppercase italic">{item.name}</h3>
                                    <p className="text-xs text-foreground/40 font-medium leading-relaxed min-h-[40px] px-2 text-balance">
                                        {item.description}
                                    </p>
                                </div>

                                <div className="mt-auto pt-6 border-t border-foreground/5 flex flex-col gap-4 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Coins className="w-3.5 h-3.5 text-yellow-500" />
                                            <span className="text-lg font-black text-yellow-500 italic tracking-tighter">
                                                {item.cost.toLocaleString()}
                                            </span>
                                        </div>
                                        {item.id === "streak_freeze" && (
                                            <div className="flex items-center gap-1 text-foreground/30">
                                                <Clock className="w-3 h-3" />
                                                <span className="text-[9px] font-bold uppercase">One Use</span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handlePurchase(item)}
                                        disabled={isDisabled}
                                        className={`
                                            relative h-12 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase overflow-hidden transition-all group/btn
                                            ${isDisabled
                                                ? "bg-foreground/5 text-foreground/20 cursor-not-allowed border border-foreground/5"
                                                : "bg-foreground text-background shadow-xl hover:shadow-foreground/10 active:scale-[0.98]"
                                            }
                                        `}
                                    >
                                        <span className="relative z-10">{buttonText}</span>
                                        {!isDisabled && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </main>
            <BottomNav />
        </div>
    );
}
