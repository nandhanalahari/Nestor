"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "signup") {
      const { error: err } = await signUp(email, password, name);
      if (err) {
        setError(err.message);
      } else {
        // After signup, send user to onboarding quiz
        // Auto-login so they have a session for the quiz
        const { error: loginErr } = await signIn(email, password);
        if (loginErr) {
          setSuccess("Account created! Sign in to continue.");
          setMode("login");
        } else {
          router.push("/onboarding");
        }
      }
    } else {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err.message);
      } else {
        // Check if user has completed onboarding
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch("/api/profile", {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          // Also check localStorage fallback
          const hasLocalProfile = !!localStorage.getItem("nestor_user_profile");
          router.push((res.ok || hasLocalProfile) ? "/dashboard" : "/onboarding");
        } catch {
          router.push("/dashboard");
        }
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center -m-8 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md px-4"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4"
          >
            <TrendingUp className="w-8 h-8 text-primary-foreground" />
          </motion.div>
          <h1 className="text-3xl font-bold text-foreground">Nestor.</h1>
          <p className="text-muted-foreground mt-1">
            Smart portfolio management for everyone
          </p>
        </div>

        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Sign in to manage your portfolio"
                : "Start your investment journey"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {mode === "signup" && (
                  <motion.div
                    key="name"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Display name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10"
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2"
                >
                  {error}
                </motion.p>
              )}

              {success && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2"
                >
                  {success}
                </motion.p>
              )}

              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                {mode === "login" ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {mode === "login"
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
