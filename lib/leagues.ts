export interface LeagueInfo {
    name: string;
    color: string;
}

const LEAGUES = [
    { name: "Diamond", threshold: 50000, color: "#7dd3fc" },
    { name: "Platinum", threshold: 15000, color: "#a8a8aa" },
    { name: "Gold", threshold: 5000, color: "#d4a017" },
    { name: "Silver", threshold: 1000, color: "#9ca3af" },
    { name: "Bronze", threshold: 0, color: "#CD7F32" },
] as const;

export function getLeague(totalGold: number): LeagueInfo {
    for (const league of LEAGUES) {
        if (totalGold >= league.threshold) {
            return { name: league.name, color: league.color };
        }
    }
    return { name: "Bronze", color: "#CD7F32" };
}

export function getNextLeague(totalGold: number): { name: string; threshold: number; remaining: number } | null {
    for (let i = LEAGUES.length - 1; i >= 0; i--) {
        if (totalGold < LEAGUES[i].threshold) {
            return {
                name: LEAGUES[i].name,
                threshold: LEAGUES[i].threshold,
                remaining: LEAGUES[i].threshold - totalGold,
            };
        }
    }
    return null; // Already at Diamond
}
