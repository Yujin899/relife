"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    updateProfile,
    type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, displayName: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function ensureUserDoc(user: User) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName || "Student",
            email: user.email || "",
            createdAt: serverTimestamp(),
            totalGold: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastQuizDate: null,
            totalQuizzes: 0,
            totalCorrect: 0,
            totalQuestions: 0,
            completedQuests: 0,
            role: "student",
            // Phase 3: Economy
            inventory: [],
            streakFreezes: 0,
            activeTheme: "default",
            settings: {
                prefersMotion: true,
                enableSound: true,
                isPrivate: false,
            },
            lastChatAt: null,
        });
    } else {
        // Daily Login Check: Streak Maintenance
        const data = snap.data();
        const lastDateVal = data.lastQuizDate; // Timestamp or null

        if (lastDateVal && typeof lastDateVal.toDate === "function") {
            const lastDate = lastDateVal.toDate();
            const now = new Date();

            // Normalize to start of day for comparison
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);

            const yesterdayStart = new Date(todayStart);
            yesterdayStart.setDate(yesterdayStart.getDate() - 1);

            const lastDateStart = new Date(lastDate);
            lastDateStart.setHours(0, 0, 0, 0);

            // If last quiz was BEFORE yesterday (i.e. missed at least one whole day)
            if (lastDateStart < yesterdayStart) {
                const freezes = data.streakFreezes || 0;

                if (freezes > 0) {
                    // Consume freeze, save streak
                    console.log("❄️ Streak Freeze Activated!");
                    await updateDoc(userRef, {
                        streakFreezes: freezes - 1,
                        // Set lastQuizDate to Yesterday to bridge the gap
                        // effectively making it look like they played yesterday
                        lastQuizDate: Timestamp.fromDate(new Date(yesterdayStart.setHours(12))),
                    });
                } else {
                    // Streak Lost
                    if (data.currentStreak > 0) {
                        console.log("😞 Streak Reset");
                        await updateDoc(userRef, {
                            currentStreak: 0
                        });
                    }
                }
            }
        }
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                await ensureUserDoc(firebaseUser);
                setUser(firebaseUser);

                // Fetch and apply theme
                const userRef = doc(db, "users", firebaseUser.uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    const theme = snap.data().activeTheme || "default";
                    document.documentElement.setAttribute("data-theme", theme);
                }
            } else {
                setUser(null);
                document.documentElement.setAttribute("data-theme", "default");
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const signIn = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signUp = async (email: string, password: string, displayName: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
        await ensureUserDoc(cred.user);
    };

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
