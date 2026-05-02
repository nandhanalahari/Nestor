"use client";

import { supabase } from "./supabase/client";
import { isMockDataEnabled } from "./mockData";

export async function authFetch(url: string, init?: RequestInit) {
  if (isMockDataEnabled()) {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string>),
      "X-Nestor-Mock-Data": "true",
    };

    if (init?.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    return fetch(url, { ...init, headers });
  }

  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session;
  }

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  if (init?.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, { ...init, headers });
}
