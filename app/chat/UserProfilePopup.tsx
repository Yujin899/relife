import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Shield, Zap } from "lucide-react";
import { useEffect, useRef } from "react";

interface UserProfilePopupProps {
    isOpen: boolean;
    onClose: () => void;
    user: {
        uid: string;
        displayName: string;
        league: string;
        photoURL?: string; // Optional if we have it
    } | null;
}

const LEAGUE_ICONS: Record<string, any> = {
    "Diamond": Trophy,
    "Platinum": Shield,
    "Gold": Zap,
    "Silver": Zap,
    "Bronze": Zap,
};

const LEAGUE_COLORS: Record<string, string> = {
    "Diamond": "#7dd3fc",   // Sky 300
    "Platinum": "#a8a8aa",  // Gray 400
    "Gold": "#d4a017",      // Traditional Gold
    "Silver": "#9ca3af",    // Gray 400
    "Bronze": "#CD7F32",    // Bronze
};

export default function UserProfilePopup({ isOpen, onClose, user }: UserProfilePopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!user) return null;

    const LeagueIcon = LEAGUE_ICONS[user.league] || Zap;
    const leagueColor = LEAGUE_COLORS[user.league] || "#ffffff";

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                    />

                    {/* Popup */}
                    <motion.div
                        ref={popupRef}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", duration: 0.3 }}
                        className="fixed inset-0 m-auto w-[320px] h-fit bg-[#121212] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                        {/* Header / Banner */}
                        <div className="h-24 bg-blue-600/20 relative">
                            <button
                                onClick={onClose}
                                className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/20 text-white/50 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Avatar & Content */}
                        <div className="px-6 pb-6 -mt-10 relative">
                            {/* Avatar */}
                            <div className="w-20 h-20 rounded-full border-4 border-[#121212] bg-[#181818] flex items-center justify-center shadow-lg relative z-10">
                                <span className="text-2xl font-black text-white" style={{ color: leagueColor }}>
                                    {user.displayName[0]}
                                </span>
                            </div>

                            {/* User Info */}
                            <div className="mt-3">
                                <h3 className="text-xl font-bold text-white mb-0.5">{user.displayName}</h3>
                                <div className="flex items-center gap-1.5 mb-4">
                                    <LeagueIcon className="w-3.5 h-3.5" style={{ color: leagueColor }} />
                                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: leagueColor }}>
                                        {user.league} League
                                    </span>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-white/5 mb-4" />

                                {/* Stats / Meta */}
                                <div className="space-y-3">
                                    <div className="bg-white/5 rounded-lg p-3">
                                        <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1">User ID</div>
                                        <div className="text-xs text-white/50 font-mono truncate select-all">
                                            {user.uid}
                                        </div>
                                    </div>

                                    {/* Note Placeholder */}
                                    <div className="text-xs text-white/40 italic">
                                        "Learning involves repetition, and repetition is the key to mastery."
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
