"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ShoppingBag,
    User,
    MessageSquare,
    Trophy
} from "lucide-react";

export default function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
        { href: "/shop", icon: ShoppingBag, label: "Shop" },
        { href: "/profile", icon: User, label: "Profile" },
        { href: "/leaderboard", icon: Trophy, label: "Leagues" },
        { href: "/chat", icon: MessageSquare, label: "Chat" },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 block sm:hidden">
            <div className="bg-background/80 backdrop-blur-lg border-t border-foreground/5 px-6 pb-6 pt-3 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
                <div className="flex items-center justify-between max-w-md mx-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-1 transition-all ${isActive
                                        ? "text-blue-500 scale-110"
                                        : "text-foreground/40 hover:text-foreground/60"
                                    }`}
                            >
                                <div className={`p-2 rounded-2xl transition-all ${isActive ? "bg-blue-500/10" : ""}`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-tighter ${isActive ? "opacity-100" : "opacity-0"}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
            {/* Safe area padding for some mobile browsers */}
            <div className="h-[safe-area-inset-bottom] bg-background/80 backdrop-blur-lg" />
        </nav>
    );
}
