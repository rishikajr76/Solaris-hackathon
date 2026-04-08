import { motion } from "framer-motion";
import { Sidebar } from "../components/Sidebar";
import { MetricCards } from "../components/MetricCards";
import { ReviewChart } from "../components/ReviewChart";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // 🔒 Protect Route
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-900">
      <Sidebar />

      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex-1 md:ml-64 overflow-auto"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          
          {/* 🔥 Header */}
          <motion.div
            initial={{ y: -15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-10"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
              Dashboard
            </h1>
            <p className="text-slate-400">
              Welcome to your code governance hub 🚀
            </p>
          </motion.div>

          {/* 📊 Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-10"
          >
            <MetricCards />
          </motion.div>

          {/* 📈 Charts + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <ReviewChart />

            {/* Performance Summary */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="glass-neon p-6 rounded-xl"
            >
              <h3 className="text-lg font-semibold mb-6 text-gradient">
                Performance Summary
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <span className="text-slate-300">Avg. Review Time</span>
                  <span className="text-purple-400 font-semibold">
                    2.5 minutes
                  </span>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <span className="text-slate-300">Issues Found</span>
                  <span className="text-cyan-400 font-semibold">
                    89 this week
                  </span>
                </div>

                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <span className="text-slate-300">Code Quality</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-purple-500"
                        style={{ width: "87%" }}
                      />
                    </div>
                    <span className="text-sm text-slate-300">87%</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-300">Team Efficiency</span>
                  <span className="text-green-400 font-semibold">
                    ↑ 12.4%
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 🕒 Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-neon p-6 rounded-xl"
          >
            <h3 className="text-lg font-semibold mb-4 text-gradient">
              Recent Activity
            </h3>

            <div className="space-y-3">
              {[
                {
                  repo: "sentinel-ag",
                  pr: "456",
                  status: "Reviewed",
                  time: "2 hours ago",
                },
                {
                  repo: "api-gateway",
                  pr: "388",
                  status: "Approved",
                  time: "4 hours ago",
                },
                {
                  repo: "auth-service",
                  pr: "112",
                  status: "Issues Found",
                  time: "1 day ago",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center py-3 border-b border-white/5 last:border-0"
                >
                  <div>
                    <p className="text-cyan-400 font-semibold">
                      {item.repo}
                    </p>
                    <p className="text-sm text-slate-400">
                      PR #{item.pr}
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        item.status === "Approved"
                          ? "text-green-400"
                          : item.status === "Issues Found"
                          ? "text-red-400"
                          : "text-purple-400"
                      }`}
                    >
                      {item.status}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </motion.main>
    </div>
  );
}