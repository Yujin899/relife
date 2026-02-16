import { useEffect, useState } from "react";
import { ref, onValue, off } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import UserAvatar from "@/components/UserAvatar";

interface PresenceUser {
    uid: string;
    displayName: string;
    league: string;
    state: "online" | "offline";
    photoURL?: string;
    currentChannel?: string;
}



export default function PresenceSidebar() {
    const [members, setMembers] = useState<PresenceUser[]>([]);

    useEffect(() => {
        const presenceRef = ref(rtdb, "status");
        const unsubscribe = onValue(presenceRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val() as Record<string, any>;
                const onlineUsers = Object.values(data)
                    .filter((u: any) => u.state === "online")
                    .map((u: any) => ({
                        uid: u.uid,
                        displayName: u.displayName,
                        league: u.league,
                        photoURL: u.photoURL,
                        state: u.state,
                        currentChannel: u.currentChannel
                    })) as PresenceUser[];
                setMembers(onlineUsers);
            } else {
                setMembers([]);
            }
        });

        return () => off(presenceRef, "value", unsubscribe);
    }, []);

    return (
        <div className="w-60 bg-[#121212] border-l border-white/5 hidden lg:flex flex-col">
            <div className="p-4 border-b border-white/5">
                <h2 className="font-bold text-xs uppercase tracking-widest text-white/30">
                    Online Members — {members.length}
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
                {["Diamond", "Platinum", "Gold", "Silver", "Bronze"].map((league) => {
                    const leagueMembers = members.filter(m => m.league === league);
                    if (leagueMembers.length === 0) return null;

                    return (
                        <div key={league}>
                            <div className="px-2 mb-2 flex items-center gap-1.5 text-xs font-bold text-white/20 uppercase tracking-widest">
                                {league}
                                <span className="text-[9px]">• {leagueMembers.length}</span>
                            </div>
                            <div className="space-y-1">
                                {leagueMembers.map((member) => (
                                    <div key={member.uid} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition opacity-50 hover:opacity-100 cursor-pointer group">
                                        <div className="relative">
                                            <UserAvatar
                                                src={member.photoURL}
                                                fallback={member.displayName}
                                                league={member.league}
                                                size="sm"
                                            />
                                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-black rounded-full flex items-center justify-center z-20">
                                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-white/90 truncate group-hover:text-blue-400 transition-colors">
                                                {member.displayName}
                                            </div>
                                            <div className="text-[10px] text-white/30 truncate">
                                                {league === "Gold" ? "Studying..." : "Browsing"}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
