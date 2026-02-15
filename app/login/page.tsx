"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
    const { user, loading, signIn, signUp, signInWithGoogle } = useAuth();
    const router = useRouter();
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            router.push("/dashboard");
        }
    }, [user, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            if (isRegister) {
                if (!displayName.trim()) {
                    setError("Display name is required");
                    setSubmitting(false);
                    return;
                }
                await signUp(email, password, displayName.trim());
            } else {
                await signIn(email, password);
            }
            router.push("/dashboard");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Something went wrong";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogle = async () => {
        setError("");
        setSubmitting(true);
        try {
            await signInWithGoogle();
            router.push("/dashboard");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Something went wrong";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    if (user) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-sm">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Relife</h1>
                    <p className="text-sm text-foreground/50 mt-1">Study. Compete. Improve.</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegister && (
                        <div>
                            <label htmlFor="displayName" className="block text-sm font-medium text-foreground/70 mb-1">
                                Display Name
                            </label>
                            <input
                                id="displayName"
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-foreground/10 bg-foreground/5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 transition"
                                placeholder="Your name"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-foreground/70 mb-1">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-foreground/10 bg-foreground/5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 transition"
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-foreground/70 mb-1">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-foreground/10 bg-foreground/5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 transition"
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                    >
                        {submitting ? "..." : isRegister ? "Create Account" : "Sign In"}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-foreground/10" />
                    <span className="text-xs text-foreground/30">or</span>
                    <div className="flex-1 h-px bg-foreground/10" />
                </div>

                {/* Google */}
                <button
                    onClick={handleGoogle}
                    disabled={submitting}
                    className="w-full py-2.5 rounded-lg border border-foreground/10 text-foreground text-sm font-medium hover:bg-foreground/5 transition disabled:opacity-50 cursor-pointer"
                >
                    Continue with Google
                </button>

                {/* Toggle */}
                <p className="text-center text-sm text-foreground/50 mt-6">
                    {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                        type="button"
                        onClick={() => {
                            setIsRegister(!isRegister);
                            setError("");
                        }}
                        className="text-foreground font-medium hover:underline cursor-pointer"
                    >
                        {isRegister ? "Sign in" : "Register"}
                    </button>
                </p>
            </div>
        </div>
    );
}
