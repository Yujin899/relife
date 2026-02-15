/**
 * Leitner Spaced Repetition System Utilities
 * 
 * Logic:
 * - Box 1: 1 Day
 * - Box 2: 3 Days
 * - Box 3: 7 Days
 * - Box 4: 14 Days (Mastered)
 */

export const LEITNER_INTERVALS = [1, 3, 7, 14]; // in days

/**
 * Calculate the next review date based on the box number.
 * @param box current box (1-indexed)
 * @returns Date for the next review
 */
export function calculateNextReview(box: number): Date {
    const days = LEITNER_INTERVALS[box - 1] || 1;
    const next = new Date();
    next.setDate(next.getDate() + days);
    next.setHours(0, 0, 0, 0); // Normalize to start of day
    return next;
}

/**
 * Get the next box number on success.
 * Max box is 4.
 */
export function promoteBox(currentBox: number): number {
    return Math.min(currentBox + 1, 4);
}

/**
 * Reset to Box 1 on failure.
 */
export function demoteBox(): number {
    return 1;
}
