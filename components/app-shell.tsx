"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Nav } from "@/components/nav";
import { Sidebar } from "@/components/sidebar";
import { Loader2 } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileNavOpen]);

  if (loading && !isLanding && !isAuthPage && !isOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthPage || isOnboarding) {
    return (
      <main className="min-h-screen bg-background p-4 sm:p-8">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <Sidebar
        mobileOpen={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
      />
      <main className="min-h-screen min-w-0 overflow-x-hidden bg-background pt-12 sm:pt-14 lg:pl-64 lg:pt-0">
        <Nav onMenuClick={() => setMobileNavOpen(true)} />
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6 sm:pb-12 sm:pt-6 lg:px-8 lg:pt-24">
          {children}
        </div>
      </main>
    </div>
  );
}
