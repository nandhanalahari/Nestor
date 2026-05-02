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
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Trophy className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Compare XP with other Nestor investors.
          </p>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search players by name…"
          value={searchRaw}
          onChange={(e) => setSearchRaw(e.target.value)}
          className="h-10 pl-9"
          aria-label="Filter leaderboard by display name"
        />
      </div>

      <Tabs defaultValue="alltime" className="w-full gap-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="alltime">All Time</TabsTrigger>
          <TabsTrigger value="weekly">This Week</TabsTrigger>
        </TabsList>
        <TabsContent value="alltime" className="mt-0">
          <LeaderboardTable mode="alltime" searchQuery={debouncedSearch} />
        </TabsContent>
        <TabsContent value="weekly" className="mt-0">
          <LeaderboardTable mode="weekly" searchQuery={debouncedSearch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
