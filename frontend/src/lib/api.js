import { supabase } from "../supabaseClient";

export const API_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

/**
 * Fetch wrapper that automatically attaches the current Supabase JWT to the
 * Authorization header. Use this for all requests to the Express backend.
 */
export async function apiFetch(path, options = {}) {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const token = session?.access_token;

  const headers = {
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  return fetch(`${API_URL}${path}`, { ...options, headers });
}
