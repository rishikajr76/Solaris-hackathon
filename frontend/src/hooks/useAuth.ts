import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import type { User, Session } from "@supabase/supabase-js";

const MIN_PASSWORD_LEN = 6;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Non-error feedback (e.g. “confirm your email”) */
  const [notice, setNotice] = useState<string | null>(null);

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
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setError(null);
    setNotice(null);
    setAuthBusy(true);

    try {
      if (!email || !password) throw new Error("Email and password are required");
      if (password.length < MIN_PASSWORD_LEN) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      });

      if (error) {
        if ((error as { status?: number }).status === 429) {
          throw new Error("Too many signup attempts. Please try again later.");
        }
        throw error;
      }

      // Only treat as signed-in when Supabase issued a session (e.g. email confirm off).
      // If "Confirm email" is on, session is null — do not set user or dashboard breaks.
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setNotice(null);
      } else if (data.user) {
        setSession(null);
        setUser(null);
        setNotice(
          "Account created. Check your email for a confirmation link, then sign in here."
        );
      } else {
        throw new Error("Sign up did not complete. Please try again.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signup failed";
      setError(message);
    } finally {
      isSubmittingRef.current = false;
      setAuthBusy(false);
    }
  };

  // 🔐 SIGN IN (Login)
  const signIn = async (email: string, password: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setError(null);
    setNotice(null);
    setAuthBusy(true);

    try {
      if (!email || !password) throw new Error("Email and password are required");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if ((error as { status?: number }).status === 429) {
          throw new Error("Too many login attempts. Please wait a moment.");
        }
        if ((error as { status?: number }).status === 400) {
          throw new Error("Invalid email or password. Please check your credentials.");
        }
        throw error;
      }

      setSession(data.session);
      setUser(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      isSubmittingRef.current = false;
      setAuthBusy(false);
    }
  };

  // 🔓 SIGN OUT
  const signOut = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setError(null);
    setNotice(null);
    setAuthBusy(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setSession(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      isSubmittingRef.current = false;
      setAuthBusy(false);
    }
  };

  return {
    user,
    session,
    loading,
    authBusy,
    error,
    notice,
    signUp,
    signIn,
    signOut,
  };
}