"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Nav } from "@/components/nav";
import { Sidebar } from "@/components/sidebar";
import { Loader2 } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const isAuthPage = pathname === "/auth";
  const isOnboarding = pathname === "/onboarding";
  const isLanding = pathname === "/";

  useEffect(() => {
    if (loading) return;

    if (user) {
      if (isAuthPage) {
        router.replace("/");
      }
      return;
    }

    if (!isAuthPage) {
      router.replace("/auth");
    }
  }, [loading, user, isAuthPage, router]);

  if (loading && !isLanding && !isAuthPage && !isOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthPage || isOnboarding) {
    return (
      <main className="min-h-screen bg-background p-8">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="min-h-screen min-w-0 overflow-x-hidden bg-background pl-64">
        <Nav />
        <div className="mx-auto max-w-7xl px-8 pb-12 pt-24">
          {children}
        </div>
      </main>
    </div>
  );
}
