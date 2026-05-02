"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getUser, onAuthStateChange } from "@/lib/supabase/auth";
import { isMockDataEnabled, MOCK_USER_ID } from "@/lib/mockData";

type AuthCtx = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthCtx>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isMockDataEnabled()) {
      setUser({
        id: MOCK_USER_ID,
        email: "mock.investor@nestor.local",
        user_metadata: { display_name: "Mock Investor" },
      } as unknown as User);
      setLoading(false);
      return;
    }

    getUser().then(({ user: u }) => {
      setUser(u);
      setLoading(false);
    });

    const { data } = onAuthStateChange((u) => {
      setUser(u);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
