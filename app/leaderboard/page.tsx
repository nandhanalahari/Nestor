"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Trophy } from "lucide-react";

import { LeaderboardTable } from "@/components/LeaderboardTable";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/auth-provider";

export default function LeaderboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [searchRaw, setSearchRaw] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchRaw), 200);
    return () => window.clearTimeout(t);
  }, [searchRaw]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="-mx-4 -my-8 flex min-h-screen items-center justify-center bg-[#f9f9fe] md:-mx-8">
        <Loader2 className="size-8 animate-spin text-[#003666]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="-mx-4 -my-8 flex min-h-screen items-center justify-center bg-[#f9f9fe] md:-mx-8">
        <Loader2 className="size-8 animate-spin text-[#3f5165]" />
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-8 min-h-screen bg-[#f9f9fe] px-4 py-10 font-[Inter] text-[#002141] md:-mx-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8 pb-8">
      <div className="flex items-center gap-3 rounded-lg border border-[#e0e0e0] bg-white p-6 shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
        <div className="flex size-11 items-center justify-center rounded-lg bg-[#f7e382] text-[#002141]">
          <Trophy className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="font-[Manrope] text-3xl font-bold tracking-tight text-[#002141]">
            Leaderboard
          </h1>
          <p className="text-sm text-[#3f5165]">
            Compare XP with other Nestor investors.
          </p>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7aa0d6]"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search players by name…"
          value={searchRaw}
          onChange={(e) => setSearchRaw(e.target.value)}
          className="h-11 border-[#d7dce5] bg-white pl-9 text-[#002141] shadow-[0_20px_20px_rgba(0,0,0,0.04)] placeholder:text-[#7a8797] focus-visible:ring-[#7aa0d6]"
          aria-label="Filter leaderboard by display name"
        />
      </div>

      <Tabs defaultValue="alltime" className="w-full gap-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 border border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
          <TabsTrigger value="alltime" className="data-[state=active]:bg-[#002141] data-[state=active]:text-white">
            All Time
          </TabsTrigger>
          <TabsTrigger value="weekly" className="data-[state=active]:bg-[#002141] data-[state=active]:text-white">
            This Week
          </TabsTrigger>
        </TabsList>
        <TabsContent value="alltime" className="mt-0">
          <LeaderboardTable mode="alltime" searchQuery={debouncedSearch} />
        </TabsContent>
        <TabsContent value="weekly" className="mt-0">
          <LeaderboardTable mode="weekly" searchQuery={debouncedSearch} />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
