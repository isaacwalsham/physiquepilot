import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { getDayType } from "../lib/dayType";

// ─── Context ──────────────────────────────────────────────────────────────────

const ProfileContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async (userId) => {
    const { data, error: err } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (err && err.code !== "PGRST116") {
      setError(err.message);
      return null;
    }
    return data || null;
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const data = await fetchProfile(user.id);
    setProfile(data);
    setLoading(false);
  }, [fetchProfile]);

  // Load on mount + re-load on auth state change
  useEffect(() => {
    loadProfile();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") loadProfile();
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, [loadProfile]);

  /**
   * Optimistically update local profile state, then persist to Supabase.
   * Returns { error } — null on success.
   */
  const updateProfile = useCallback(
    async (patch) => {
      if (!profile?.user_id) return { error: "No profile loaded" };

      // Optimistic update immediately
      setProfile((prev) => ({ ...prev, ...patch }));

      const { error: err } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", profile.user_id);

      if (err) {
        // Rollback on failure
        setProfile((prev) => {
          const rolled = { ...prev };
          for (const k of Object.keys(patch)) {
            rolled[k] = profile[k];
          }
          return rolled;
        });
        return { error: err.message };
      }

      return { error: null };
    },
    [profile]
  );

  const refreshProfile = useCallback(() => loadProfile(), [loadProfile]);

  // Derived: today's day type — manual override (stored in profile) takes priority;
  // otherwise computed from the training schedule via getDayType()
  const todayDayType = (() => {
    if (!profile) return "rest";
    const todayISO = new Date().toISOString().slice(0, 10);
    if (profile.today_day_type_date === todayISO && profile.today_day_type) {
      return profile.today_day_type;
    }
    return getDayType(profile, new Date());
  })();

  const value = {
    profile,
    loading,
    error,
    todayDayType,
    updateProfile,
    refreshProfile,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>");
  return ctx;
}

export default ProfileContext;
