import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔹 Ref to prevent multiple rapid requests
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // 🔥 Get current session
    const getSession = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (error) {
          setError(error.message);
        } else {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
      } catch (err) {
        if (isMounted) setError("Failed to fetch session");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    getSession();

    // 🔥 Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 🔐 SIGN UP (Register)
  const signUp = async (email: string, password: string) => {
    if (isSubmittingRef.current) return; // prevent rapid clicks
    isSubmittingRef.current = true;
    setError(null);

    try {
      if (!email || !password) throw new Error("Email and password are required");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        if ((error as any).status === 429) {
          throw new Error("Too many signup attempts. Please try again later.");
        } else {
          throw error;
        }
      }

      setUser(data.user);
      setSession(data.session);
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // 🔐 SIGN IN (Login)
  const signIn = async (email: string, password: string) => {
    if (isSubmittingRef.current) return; // prevent rapid clicks
    isSubmittingRef.current = true;
    setError(null);

    try {
      if (!email || !password) throw new Error("Email and password are required");

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if ((error as any).status === 429) {
          throw new Error("Too many login attempts. Please wait a moment.");
        } else if ((error as any).status === 400) {
          throw new Error("Invalid email or password. Please check your credentials.");
        } else {
          throw error;
        }
      }

      setUser(data.user);
      setSession(data.session);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // 🔓 SIGN OUT
  const signOut = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setError(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setSession(null);
    } catch (err: any) {
      setError(err.message || "Logout failed");
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return {
    user,
    session,
    loading,
    error,
    signUp,
    signIn,
    signOut,
  };
}