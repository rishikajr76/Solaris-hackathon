import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { FloatingParticles } from "../components/FloatingParticles";
import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "../lib/supabaseClient";

export function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, authBusy, error, notice, signIn, signUp } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user && !loading) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) return;
    if (!email || !password) return;

    if (isLogin) {
      await signIn(email, password);
    } else {
      await signUp(email, password);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center overflow-hidden">
      <FloatingParticles />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="glass-neon p-8 rounded-2xl w-full max-w-md mx-4 z-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gradient mb-2">
            Sentinel-AG
          </h1>
          <p className="text-slate-400">
            AI-Powered Code Governance
          </p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          {!isSupabaseConfigured && (
            <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-lg text-amber-100 text-sm">
              Add <code className="text-cyan-300">VITE_SUPABASE_URL</code> and{" "}
              <code className="text-cyan-300">VITE_SUPABASE_ANON_KEY</code> to{" "}
              <code className="text-cyan-300">frontend/.env</code> (same project as the
              backend). Restart the dev server after saving.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {notice && !error && (
            <div className="p-3 bg-cyan-500/15 border border-cyan-500/35 rounded-lg text-cyan-100 text-sm">
              {notice}
            </div>
          )}

          {/* Email */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white outline-none focus:border-cyan-400"
          />

          {/* Password */}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white outline-none focus:border-cyan-400"
          />

          {/* Button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={loading || authBusy || !isSupabaseConfigured}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || authBusy
              ? "Processing..."
              : isLogin
              ? "Sign In"
              : "Sign Up"}
          </motion.button>

          {/* Toggle */}
          <p className="text-center text-sm text-slate-400">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
              }}
              className="ml-2 text-cyan-400 hover:underline"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>

          {/* Info */}
          <p className="text-center text-xs text-slate-500 mt-2">
            Secure authentication powered by Supabase
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 space-y-3 pt-6 border-t border-white/10"
        >
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-cyan-400 mt-1" />
            <p className="text-sm text-slate-300">
              Secure email authentication
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-purple-500 mt-1" />
            <p className="text-sm text-slate-300">
              Access your dashboard instantly
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-cyan-400 mt-1" />
            <p className="text-sm text-slate-300">
              Start AI-powered code insights
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}