"use client";

import { useState } from "react";
import { Camera } from "lucide-react";

interface UserAvatarProps {
    src?: string | null;
    fallback: string;
    league?: string;
    size?: "sm" | "md" | "lg" | "xl"; // sm: 8, md: 10, lg: 16, xl: 24
    className?: string;
    editable?: boolean;
    onEdit?: () => void;
    frame?: string | null;
}

const LEAGUE_COLORS: Record<string, string> = {
    "Diamond": "#7dd3fc",   // Sky blue
    "Platinum": "#a8a8aa",  // Silver/Grey
    "Gold": "#d4a017",      // Gold
    "Silver": "#9ca3af",    // Light Grey
    "Bronze": "#CD7F32",    // Bronze
};

const SIZE_CLASSES = {
    sm: "w-8 h-8 text-[10px]",
    md: "w-10 h-10 text-xs",
    lg: "w-16 h-16 text-lg",
    xl: "w-24 h-24 text-2xl",
};

export default function UserAvatar({
    src,
    fallback,
    league = "Bronze",
    size = "md",
    className = "",
    editable = false,
    onEdit,
    frame
}: UserAvatarProps) {
    const [imgError, setImgError] = useState(false);
    const borderColor = LEAGUE_COLORS[league] || LEAGUE_COLORS["Bronze"];

    // Glow effect for high tiers (only if no frame is present, or maybe combined?)
    // If a frame is present, we might want to disable the border/glow or integrate it.
    // For now, let's keep the league border/glow as a "base" and the frame sits on top.

    const glowStyle = league === "Diamond"
        ? `0 0 10px ${borderColor}`
        : league === "Platinum"
            ? `0 0 5px ${borderColor}`
            : "none";

    return (
        <div className={`relative group/avatar ${className}`}>
            <div
                onClick={editable ? onEdit : undefined}
                className={`${SIZE_CLASSES[size]} rounded-full flex items-center justify-center shrink-0 relative z-10 transition-transform ${editable ? "cursor-pointer hover:opacity-90 active:scale-95" : ""}`}
                style={{
                    backgroundColor: "#18181b", // dark gray background for transparent images
                    border: frame ? "none" : `2px solid ${borderColor}`,
                    boxShadow: frame ? "none" : glowStyle,
                }}
            >
                {src && !imgError ? (
                    <img
                        src={src}
                        alt="Avatar"
                        className="w-full h-full object-cover rounded-full"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <span className="font-black text-white" style={{ color: borderColor }}>
                        {fallback.charAt(0).toUpperCase()}
                    </span>
                )}

                {/* Frame Overlay */}
                {frame && (
                    <img
                        src={frame}
                        alt="Frame"
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-auto h-[135%] max-w-none pointer-events-none z-20"
                    />
                )}
            </div>

            {/* Edit Badge */}
            {editable && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-[#09090b] flex items-center justify-center z-20 pointer-events-none shadow-md">
                    <Camera className="w-3 h-3 text-white" />
                </div>
            )}
        </div>
    );
}
