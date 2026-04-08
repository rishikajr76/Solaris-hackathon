import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Shield, Zap, Activity } from "lucide-react"; // Added Zap for complexity
import { HeroTyping } from "../components/HeroTyping";
import { MagneticButton } from "../components/MagneticButton";
import { FloatingParticles } from "../components/FloatingParticles";
import { supabase } from "../lib/supabaseClient";

// ✅ Type aligned with Backend ReviewData
type Review = {
  id: string;
  title?: string;
  description?: string;
  summary: string;
  severity: 'Low' | 'Medium' | 'High';
  complexity_score: number;
  created_at?: string;
};

export function HomePage() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      // 🔥 Fetching from 'reviews' table to match databaseService.ts
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) {
        console.error("Error fetching reviews:", error);
      } else {
        setReviews(data || []);
      }
      setLoading(false);
    };

    fetchReviews();

    // 🔥 Realtime updates from the Backend engine
    const channel = supabase
      .channel("realtime_reviews")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reviews",
        },
        (payload) => {
          setReviews((prev) => [payload.new as Review, ...prev].slice(0, 6));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden flex flex-col justify-center">
      <FloatingParticles />

      {/* 🛡️ Navbar */}
      <nav className="fixed top-0 w-full glass-dark border-b z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-gradient">Sentinel-AG</div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/auth")}
            className="btn-primary"
          >
            Get Started
          </motion.button>
        </div>
      </nav>

      {/* 🚀 Hero Section */}
      <section className="max-w-7xl mx-auto px-8 py-24 mt-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <HeroTyping
              text="Governing code at the speed of thought."
              speed={40}
            />
          </h1>

          <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            AI-powered code governance with automated review insights,
            security checks, and cognitive complexity analysis.
          </p>

          <div className="flex gap-4 justify-center">
            <MagneticButton onClick={() => navigate("/auth")}>
              Launch App
            </MagneticButton>
          </div>
        </motion.div>

        {/* 📊 Live Review Feed */}
        <div className="mt-20">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <Activity className="text-cyan-400 w-5 h-5 animate-pulse" />
            <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Live Engine Feed</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {reviews.map((review, index) => {
                // ✅ Logic check: Red if High severity, Cyan otherwise
                const isHigh = review.severity === "High";

                return (
                  <motion.div
                    key={review.id || index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -5 }}
                    className={`p-6 rounded-2xl backdrop-blur-xl border transition-all duration-300 ${
                      isHigh
                        ? "border-red-500/40 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                        : "border-cyan-400/40 bg-white/5 shadow-[0_0_20px_rgba(34,211,238,0.05)]"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={isHigh ? "text-red-400" : "text-cyan-400"}>
                        <Shield className="w-8 h-8" />
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                          isHigh ? "bg-red-500/20 text-red-400" : "bg-cyan-500/20 text-cyan-400"
                        }`}>
                          {review.severity}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold mb-2 text-white line-clamp-1">
                      {review.title || "Automated Review"}
                    </h3>

                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {review.summary}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs text-slate-300">
                          Load: {review.complexity_score}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-tighter">
                        {review.created_at ? new Date(review.created_at).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </section>

      <footer className="border-t border-white/10 mt-auto py-8">
        <div className="text-center text-slate-500 text-xs">
          © 2026 Sentinel-AG • Real-time Affective Computing & Code Governance
        </div>
      </footer>
    </div>
  );
}