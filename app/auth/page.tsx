"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  LogIn,
  Lock,
  Mail,
  ShieldCheck,
  Star,
  User,
  UserPlus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";

type AuthView = "landing" | "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [view, setView] = useState<AuthView>("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const goHome = () => {
    resetMessages();
    setView("landing");
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();

    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const hasLocalProfile = !!localStorage.getItem("nestor_user_profile");
      router.push(res.ok || hasLocalProfile ? "/" : "/onboarding");
    } catch {
      router.push("/");
    }

    setLoading(false);
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const { error: err } = await signUp(email, password, name);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const { error: loginErr } = await signIn(email, password);
    if (loginErr) {
      setSuccess("Account created! Sign in to continue.");
      setView("login");
    } else {
      router.push("/onboarding");
    }

    setLoading(false);
  };

  if (view === "login") {
    return (
      <AuthScreenShell onBack={goHome}>
        <div className="mx-auto mb-7 text-center text-white">
          <div className="mb-3 text-4xl font-extrabold tracking-tight text-white">
            Nestor
          </div>
          <h1 className="text-3xl font-extrabold">Welcome Back</h1>
          <p className="mt-2 font-[Inter] text-base text-white">
            Sign in to your account
          </p>
        </div>

        <Card className="mx-auto w-full max-w-[448px] rounded-2xl border-0 bg-white p-7 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
          <CardContent className="p-0">
            <form onSubmit={submitLogin} className="space-y-5">
              <AuthField
                icon={Mail}
                label="Email Address"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={setEmail}
              />
              <AuthField
                icon={Lock}
                label="Password"
                placeholder="Enter your password"
                type="password"
                value={password}
                onChange={setPassword}
              />

              <AuthMessage error={error} success={success} />

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#003666] px-6 py-3.5 text-base font-extrabold text-white shadow-[0_16px_24px_rgba(0,33,65,0.22)] transition-colors hover:bg-[#002141] disabled:opacity-60"
              >
                <LogIn className="h-5 w-5" />
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="font-[Inter] text-sm text-slate-500">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              className="w-full rounded-xl bg-[#f7e382] px-6 py-3.5 text-base font-extrabold text-[#002141] shadow-[0_12px_22px_rgba(0,0,0,0.12)]"
            >
              Log in with Nestor
            </button>

            <p className="mt-6 text-center font-[Inter] text-sm text-[#002141]">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setView("signup");
                }}
                className="font-semibold text-[#003666] hover:underline"
              >
                Register here
              </button>
            </p>
          </CardContent>
        </Card>
      </AuthScreenShell>
    );
  }

  if (view === "signup") {
    return (
      <AuthScreenShell onBack={goHome}>
        <div className="mx-auto mb-6 text-center text-white">
          <div className="mb-3 text-4xl font-extrabold tracking-tight text-white">
            Nestor
          </div>
          <h1 className="text-3xl font-extrabold">Create Your Account</h1>
          <p className="mt-2 font-[Inter] text-base text-white">
            Join Nestor and start building clarity
          </p>
        </div>

        <Card className="mx-auto w-full max-w-[448px] rounded-2xl border-0 bg-white p-7 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
          <CardContent className="p-0">
            <form onSubmit={submitSignup} className="space-y-4">
              <AuthField
                icon={User}
                label="Full Name"
                placeholder="John Doe"
                value={name}
                onChange={setName}
              />
              <AuthField
                icon={Mail}
                label="Email Address"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={setEmail}
              />
              <AuthField
                icon={Lock}
                label="Password"
                placeholder="Create a password"
                type="password"
                value={password}
                onChange={setPassword}
              />
              <AuthField
                icon={Lock}
                label="Confirm Password"
                placeholder="Confirm your password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
              />

              <AuthMessage error={error} success={success} />

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#f7e382] px-6 py-3.5 text-base font-extrabold text-[#002141] shadow-[0_16px_24px_rgba(0,0,0,0.14)] transition-colors hover:bg-[#dac769] disabled:opacity-60"
              >
                <UserPlus className="h-5 w-5" />
                {loading ? "Creating..." : "Create Account"}
              </button>
            </form>

            <p className="mt-5 text-center font-[Inter] text-sm text-[#002141]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setView("login");
                }}
                className="font-semibold text-[#003666] hover:underline"
              >
                Sign in
              </button>
            </p>
          </CardContent>
        </Card>
      </AuthScreenShell>
    );
  }

  return (
    <div className="-m-8 min-h-screen bg-white font-[Manrope] text-[#002141]">
      <header className="flex h-[112px] items-center justify-between bg-white px-16">
        <div className="text-2xl font-extrabold tracking-tight text-[#003666]">
          Nestor
        </div>
        <button
          type="button"
          onClick={() => setView("login")}
          className="rounded-full bg-[#003666] px-9 py-4 text-lg font-bold text-white shadow-[0_10px_18px_rgba(0,33,65,0.22)] transition-colors hover:bg-[#002141]"
        >
          Login
        </button>
      </header>

      <main>
        <section className="bg-[#003666] px-16 py-24 text-white">
          <div className="mx-auto grid max-w-[1680px] grid-cols-1 items-center gap-16 lg:grid-cols-[0.95fr_1.05fr]">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-3xl"
            >
              <h1 className="text-6xl font-extrabold leading-[1.08] tracking-tight md:text-7xl">
                Your portfolio,
                <span className="mt-2 block text-[#f7e382]">guided.</span>
              </h1>
              <p className="mt-9 max-w-2xl font-[Inter] text-2xl leading-relaxed text-white/90">
                Nestor helps you understand your investments, track risk, and
                turn complex market signals into clear next steps.
              </p>
              <button
                type="button"
                onClick={() => setView("signup")}
                className="mt-14 inline-flex items-center gap-4 rounded-full bg-[#f7e382] px-10 py-5 text-xl font-extrabold text-[#002141] shadow-[0_16px_28px_rgba(0,0,0,0.18)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started
                <ArrowRight className="h-6 w-6" />
              </button>
            </motion.div>

            <PortfolioPreview />
          </div>
        </section>

        <section className="bg-[#f9f9fe] px-16 py-24">
          <div className="mx-auto max-w-[1680px] text-center">
            <h2 className="text-4xl font-extrabold text-[#003666]">
              Why Nestor?
            </h2>
            <p className="mx-auto mt-5 max-w-3xl font-[Inter] text-xl text-slate-600">
              We make it easier to understand your portfolio and build financial
              confidence one decision at a time.
            </p>

            <div className="mt-20 grid grid-cols-1 gap-9 text-left md:grid-cols-3">
              {[
                {
                  icon: BarChart3,
                  title: "Smart Portfolio Insights",
                  body: "Track your holdings, allocation, and risk in language that is clear enough to act on.",
                },
                {
                  icon: ShieldCheck,
                  title: "Know Your Risk",
                  body: "See how market events could affect your portfolio before you make a big decision.",
                },
                {
                  icon: Star,
                  title: "Build Toward Goals",
                  body: "Connect investment choices to the goals that matter most, from a home to retirement.",
                },
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{
                    duration: 0.45,
                    delay: index * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <Card className="h-full rounded-2xl border-[#e0e0e0] bg-white p-8 shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
                    <CardContent className="p-0">
                      <div className="mb-9 flex h-16 w-16 items-center justify-center rounded-xl bg-[#fff8d6] text-[#73640e]">
                        <item.icon className="h-8 w-8" />
                      </div>
                      <h3 className="text-2xl font-extrabold text-[#003666]">
                        {item.title}
                      </h3>
                      <p className="mt-5 font-[Inter] text-lg leading-relaxed text-slate-600">
                        {item.body}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-16 py-24">
          <div className="mx-auto max-w-[1680px]">
            <div className="rounded-3xl bg-[#003666] px-12 py-16 text-center text-white lg:px-20">
              <h2 className="text-4xl font-extrabold">
                Ready to see your portfolio clearly?
              </h2>
              <p className="mx-auto mt-6 max-w-3xl font-[Inter] text-xl leading-relaxed text-white/85">
                Get started today to see your holdings, risks, goals, and
                plain-English guidance in one place.
              </p>
              <button
                type="button"
                onClick={() => setView("signup")}
                className="mt-10 inline-flex items-center gap-4 rounded-full bg-[#f7e382] px-10 py-5 text-lg font-extrabold text-[#002141] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>

        <footer className="bg-[#101820] px-16 py-16 text-white">
          <div className="mx-auto flex max-w-[1680px] flex-col justify-between gap-8 md:flex-row md:items-center">
            <div className="text-sm font-extrabold text-white/80">Nestor</div>
            <p className="max-w-3xl font-[Inter] text-sm text-white/70">
              Nestor is an educational portfolio tool. Information shown is for
              learning and planning support, not individualized financial advice.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function AuthScreenShell({
  children,
  onBack,
}: {
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="-m-8 min-h-screen bg-[#003666] font-[Manrope] text-white">
      <header className="h-[60px] border-b border-white/15 bg-[#275f80]">
        <div className="mx-auto flex h-full max-w-[1500px] items-center px-8">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-3 text-base font-extrabold text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Home
          </button>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-60px)] flex-col items-center px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function AuthField({
  icon: Icon,
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-[Inter] text-sm font-semibold text-[#002141]">
        {label}
      </span>
      <div className="relative">
        <Icon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <Input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required
          className="h-11 rounded-xl border-slate-300 bg-white pl-12 font-[Inter] text-base text-[#002141] placeholder:text-slate-400 focus-visible:ring-[#7aa0d6]"
        />
      </div>
    </label>
  );
}

function AuthMessage({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (!error && !success) return null;
  return (
    <p
      className={
        error
          ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-[Inter] text-sm text-red-700"
          : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-[Inter] text-sm text-emerald-700"
      }
    >
      {error ?? success}
    </p>
  );
}

function PortfolioPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, delay: 0.1 }}
      className="rounded-3xl bg-white p-8 text-[#002141] shadow-[0_28px_70px_rgba(0,0,0,0.2)]"
    >
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-lg font-extrabold text-[#003666]">
            Portfolio Overview
          </p>
          <p className="mt-1 font-[Inter] text-xs text-slate-500">
            Personalized insight preview
          </p>
        </div>
        <span className="rounded-full bg-[#f7e382] px-3 py-1 text-xs font-extrabold text-[#524700]">
          Guided
        </span>
      </div>

      <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col items-center justify-center">
          <div className="relative h-52 w-52">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="43" fill="none" stroke="#eef2f7" strokeWidth="16" />
              <circle cx="60" cy="60" r="43" fill="none" stroke="#003666" strokeDasharray="140 270" strokeLinecap="round" strokeWidth="16" />
              <circle cx="60" cy="60" r="43" fill="none" stroke="#7aa0d6" strokeDasharray="74 270" strokeDashoffset="-140" strokeLinecap="round" strokeWidth="16" />
              <circle cx="60" cy="60" r="43" fill="none" stroke="#f7e382" strokeDasharray="56 270" strokeDashoffset="-214" strokeLinecap="round" strokeWidth="16" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-[Inter] text-xs text-slate-500">Risk</span>
              <span className="text-xl font-extrabold text-[#003666]">
                Balanced
              </span>
            </div>
          </div>
          <button className="mt-4 rounded-full bg-slate-100 px-5 py-2 font-[Inter] text-xs font-semibold text-[#003666]">
            Hover to explore
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-extrabold text-[#003666]">
            Top Portfolio Signals
          </p>
          {[
            ["Stocks", "$37,515.12", "62%"],
            ["Bonds", "$13,089.90", "22%"],
            ["Cash", "$6,105.55", "10%"],
            ["Global", "$3,988.86", "6%"],
          ].map(([label, value, pill], index) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 font-[Inter] text-sm"
            >
              <span className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      index === 0
                        ? "#003666"
                        : index === 1
                          ? "#7aa0d6"
                          : index === 2
                            ? "#f7e382"
                            : "#193a3a",
                  }}
                />
                {label}
              </span>
              <span className="flex items-center gap-3 text-slate-500">
                {value}
                <strong className="rounded-full bg-[#003666] px-2.5 py-1 text-xs text-white">
                  {pill}
                </strong>
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
