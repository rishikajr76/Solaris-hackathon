import { createClient } from "@supabase/supabase-js";

// 🔐 Environment variables (see frontend/.env.example)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both URL and anon key are set — required for auth, DB, and realtime. */
export const isSupabaseConfigured = Boolean(supabaseUrl?.trim() && supabaseKey?.trim());

if (import.meta.env.DEV && !isSupabaseConfigured) {
  console.warn(
    "[Sentinel-AG] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy frontend/.env.example to frontend/.env. The UI will load, but Supabase features will fail until configured."
  );
}

// Placeholders allow the app to mount; real credentials come from .env
export const supabase = createClient(
  supabaseUrl?.trim() || "https://placeholder.supabase.co",
  supabaseKey?.trim() || "sb-placeholder-anon-key-not-configured"
);

// 📦 Types (for your DB tables)
export type Repository = {
  id: string;
  repo_name: string;
  owner: string;
  last_synced_at: string | null;
};