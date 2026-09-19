import { useEffect, useState } from "react";
import { getMyMembership, type MembershipTier } from "../db/friends";
import { supabase } from "../lib/supabaseClient";

const PREVIEW_KEY = "consistency:membershipPreviewTier";

function loadPreview(): "free" | "premium" | null {
  try {
    const v = localStorage.getItem(PREVIEW_KEY);
    return v === "free" || v === "premium" ? v : null;
  } catch {
    return null;
  }
}

export interface MembershipState {
  actualTier: MembershipTier | null;
  effectiveTier: MembershipTier | null;
  /** Free perks (templates, extra widgets, streak freezes) are gated on
   *  this, not on actualTier directly - an admin previewing as Free must
   *  actually see the Free experience, including the paywall. */
  isPremium: boolean;
  previewTier: "free" | "premium" | null;
  setPreview: (next: "admin" | "free" | "premium") => void;
  error: string | null;
}

/** Single source of truth for "what tier does this session act as" -
 *  fetched once here (not per-component) so App.tsx's feature gates and
 *  Settings > Membership's own display never disagree with each other. */
export function useMembership(): MembershipState {
  const [actualTier, setActualTier] = useState<MembershipTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewTier, setPreviewTier] = useState<"free" | "premium" | null>(loadPreview);

  useEffect(() => {
    let cancelled = false;

    function refetch() {
      getMyMembership()
        .then((result) => {
          if (!cancelled) setActualTier(result);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });
    }

    refetch();

    // Reaches an already-open app the moment an admin changes this
    // account's tier, instead of only taking effect on next launch. Scoped
    // to this user's own row via the filter (RLS would enforce that anyway
    // - see supabase/realtime_profiles_schema.sql for the publication side
    // of this, which is what actually turns broadcasts on).
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      channel = supabase
        .channel(`membership:${user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
          refetch,
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  function setPreview(next: "admin" | "free" | "premium") {
    const value = next === "admin" ? null : next;
    setPreviewTier(value);
    try {
      if (value) localStorage.setItem(PREVIEW_KEY, value);
      else localStorage.removeItem(PREVIEW_KEY);
    } catch {
      // Best-effort - a preview that doesn't persist across restarts is fine.
    }
  }

  const isAdmin = actualTier === "admin";
  const effectiveTier = isAdmin ? (previewTier ?? "admin") : actualTier;
  const isPremium = effectiveTier === "premium" || effectiveTier === "admin";

  return { actualTier, effectiveTier, isPremium, previewTier, setPreview, error };
}
