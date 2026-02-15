"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type NotificationType = "success" | "error" | "info" | "badge";

interface Notification {
    id: string;
    message: string;
    type: NotificationType;
    icon?: string;
    title?: string;
}

interface NotificationContextType {
    showNotification: (n: Omit<Notification, "id">) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const showNotification = useCallback((n: Omit<Notification, "id">) => {
        const id = Math.random().toString(36).slice(2, 9);
        setNotifications((prev) => [...prev, { ...n, id }]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            setNotifications((prev) => prev.filter((item) => item.id !== id));
        }, 5000);
    }, []);

    const removeNotification = (id: string) => {
        setNotifications((prev) => prev.filter((item) => item.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <div className="fixed bottom-4 right-4 z-9999 flex flex-col gap-2 pointer-events-none w-full max-w-sm">
                <AnimatePresence>
                    {notifications.map((n) => (
                        <motion.div
                            key={n.id}
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            className="pointer-events-auto"
                        >
                            <div className="bg-background border border-foreground/10 rounded-2xl shadow-2xl p-4 flex items-center gap-4 group">
                                {n.icon ? (
                                    <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-xl shrink-0">
                                        {n.icon}
                                    </div>
                                ) : (
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${n.type === "success" ? "bg-green-500" :
                                        n.type === "error" ? "bg-red-500" :
                                            n.type === "badge" ? "bg-amber-500" :
                                                "bg-blue-500"
                                        }`} />
                                )}
                                <div className="flex-1 min-w-0">
                                    {n.title && <p className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-0.5">{n.title}</p>}
                                    <p className="text-sm font-medium leading-tight">{n.message}</p>
                                </div>
                                <button
                                    onClick={() => removeNotification(n.id)}
                                    className="p-1 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                                >
                                    <span className="text-xs text-foreground/20 hover:text-foreground">✕</span>
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
}
