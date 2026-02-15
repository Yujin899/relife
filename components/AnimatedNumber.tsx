"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

interface AnimatedNumberProps {
    value: number;
    className?: string;
    duration?: number;
}

export default function AnimatedNumber({ value, className }: AnimatedNumberProps) {
    // We use a spring for smooth "game-feel" counting
    const spring = useSpring(value, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    const rounded = useTransform(spring, (latest) => {
        const val = Number(latest);
        return isNaN(val) ? "0" : Math.round(val).toLocaleString();
    });

    useEffect(() => {
        spring.set(value);
    }, [value, spring]);

    return (
        <motion.span className={className}>
            {rounded}
        </motion.span>
    );
}
