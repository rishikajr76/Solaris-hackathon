import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Shield } from "lucide-react";
import { HeroTyping } from "../components/HeroTyping";
import { MagneticButton } from "../components/MagneticButton";
import { FloatingParticles } from "../components/FloatingParticles";
import { supabase } from "../lib/supabaseClient";

// ✅ Type for violations
type Violation = {
  id: string;
  title: string;
  description: string;
  severity: string;
  created_at?: string;
};

export function HomePage() {
  const navigate = useNavigate();

  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔥 Fetch violations
    const fetchViolations = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("violations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching violations:", error);
      } else {
        setViolations(data || []);
      }

      setLoading(false);
    };

    fetchViolations();

    // 🔥 Realtime updates
    const channel = supabase
      .channel("violations_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "violations",
        },
        (payload) => {
          setViolations((prev) => [payload.new as Violation, ...prev]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe(); // ✅ FIXED cleanup
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden flex flex-col justify-center">
      <FloatingParticles />

      {/* 🔥 Navbar */}
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

      {/* 🔥 Hero */}
      <section className="max-w-7xl mx-auto px-8 py-16">
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
            security checks, and performance analysis.
          </p>

          <div className="flex gap-4 justify-center">
            <MagneticButton onClick={() => navigate("/auth")}>
              Launch App
            </MagneticButton>

            <motion.button
              whileHover={{ scale: 1.05 }}
              className="btn-secondary"
            >
              Learn More
            </motion.button>
          </div>
        </motion.div>

        {/* 🔥 Loading */}
        {loading && (
          <p className="text-center text-slate-400">
            Loading violations...
          </p>
        )}

        {/* 🔥 Violations Grid */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-20"
          >
            {violations.map((violation, index) => {
              const isHigh = violation.severity === "High";

              return (
                <motion.div
                  key={violation.id || index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  className={`p-6 rounded-xl backdrop-blur-xl border 
                  ${
                    isHigh
                      ? "border-red-500/40"
                      : "border-cyan-400/40"
                  }
                  bg-white/5 hover:shadow-xl transition-all`}
                >
                  <div
                    className={`mb-4 ${
                      isHigh ? "text-red-400" : "text-cyan-400"
                    }`}
                  >
                    <Shield className="w-8 h-8" />
                  </div>

                  <h3 className="text-lg font-semibold mb-2">
                    {violation.title || "Code Violation"}
                  </h3>

                  <p className="text-sm text-slate-400">
                    {violation.description || "Violation detected"}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Severity:{" "}
                    <span
                      className={
                        isHigh ? "text-red-400" : "text-cyan-400"
                      }
                    >
                      {violation.severity}
                    </span>
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </section>

      {/* 🔥 Footer */}
      <footer className="border-t border-white/10 mt-auto py-10">
        <div className="text-center text-slate-400 text-sm">
          © 2026 Sentinel-AG. AI-powered code governance.
        </div>
      </footer>
    </div>
  );
}