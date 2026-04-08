import { createClient } from "@supabase/supabase-js";

// 🔐 Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ❗ Safety check
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

// 🚀 Create client
export const supabase = createClient(supabaseUrl, supabaseKey);

// 📦 Types (for your DB tables)
export type Repository = {
  id: string;
  repo_name: string;
  owner: string;
  last_synced_at: string;
};