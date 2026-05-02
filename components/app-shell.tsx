"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth-provider";
import { Nav } from "@/components/nav";
import { Sidebar } from "@/components/sidebar";
import { Loader2, Sun, Moon } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true) }, []);

  const isAuthPage = pathname === "/auth";
  const isOnboarding = pathname === "/onboarding";
  const isLanding = pathname === "/";

  const toggleTheme = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  };

  if (loading && !isLanding && !isAuthPage && !isOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Theme toggle button (shared across all layouts)
  const themeButton = mounted ? (
    <button
      onClick={toggleTheme}
      className="fixed top-4 right-4 z-50 w-10 h-10 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center hover:bg-accent transition-colors"
      aria-label="Toggle theme"
    >
      {resolvedTheme === "light" ? (
        <Moon className="w-4 h-4 text-foreground" />
      ) : (
        <Sun className="w-4 h-4 text-foreground" />
      )}
    </button>
  ) : null;

  if (isAuthPage || isOnboarding) {
    return (
      <main className="flex-1 p-8 bg-background">
        {themeButton}
        {children}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 md:p-8 bg-background relative overflow-x-hidden">
        {themeButton}
        <Nav />
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
