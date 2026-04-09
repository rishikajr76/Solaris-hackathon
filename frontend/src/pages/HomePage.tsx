import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { HeroTyping } from "../components/HeroTyping";
import { MagneticButton } from "../components/MagneticButton";
import { FloatingParticles } from "../components/FloatingParticles";
import { LiveEngineFeed } from "../components/LiveEngineFeed";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col overflow-x-hidden">
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

      {/* 🚀 Hero + live feed (scroll down for feed — avoid overflow-hidden clipping) */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pt-28 pb-20 md:pb-28 mt-2 w-full">
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

          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-4 justify-center">
              <MagneticButton onClick={() => navigate("/auth")}>
                Launch App
              </MagneticButton>
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">
              Scroll for live engine feed
            </p>
          </div>
        </motion.div>

        <LiveEngineFeed />
      </section>

      <footer className="border-t border-white/10 mt-auto py-8">
        <div className="text-center text-slate-500 text-xs">
          © 2026 Sentinel-AG • Real-time Affective Computing & Code Governance
        </div>
      </footer>
    </div>
  );
}