export interface GoldInput {
    score: number;
    totalQuestions: number;
    lastQuizDate: string | null; // "YYYY-MM-DD" or null
    currentStreak: number;
    today: string;               // "YYYY-MM-DD"
    yesterday: string;           // "YYYY-MM-DD"
}

export interface GoldResult {
    base: number;
    perfectBonus: number;
    dailyBonus: number;
    streakBonus: number;
    total: number;
    newStreak: number;
}

export function calculateGold(input: GoldInput): GoldResult {
    const { score, totalQuestions, lastQuizDate, currentStreak, today, yesterday } = input;

    // Base: 10 gold per correct answer
    const base = score * 10;

    // Perfect score bonus
    const perfectBonus = score === totalQuestions ? 30 : 0;

    // Daily bonus: first quiz of the day
    const dailyBonus = lastQuizDate !== today ? 20 : 0;

    // Streak calculation
    let newStreak: number;
    if (lastQuizDate === today) {
        // Already quizzed today — streak unchanged
        newStreak = currentStreak;
    } else if (lastQuizDate === yesterday) {
        // Consecutive day — streak grows
        newStreak = currentStreak + 1;
    } else {
        // Streak broken — restart at 1
        newStreak = 1;
    }

    // Streak bonus: +10 per streak day, only if streak >= 3, capped at 14
    const streakBonus = newStreak >= 3 ? Math.min(newStreak, 14) * 10 : 0;

    const total = base + perfectBonus + dailyBonus + streakBonus;

    return { base, perfectBonus, dailyBonus, streakBonus, total, newStreak };
}

/**
 * Get today and yesterday as "YYYY-MM-DD" strings in UTC.
 */
export function getTodayAndYesterday(): { today: string; yesterday: string } {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split("T")[0];
    return { today, yesterday };
}
