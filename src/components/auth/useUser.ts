"use client";

import { useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  srn: string | null;
  prn: string;
  createdAt: number;
}

/**
 * The signed-in user, fetched from /api/auth/me.
 * `undefined` = still loading, `null` = logged out, otherwise the user.
 */
export function useUser() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setUser(d.user ?? null);
      })
      .catch(() => {
        if (alive) setUser(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  return user;
}
