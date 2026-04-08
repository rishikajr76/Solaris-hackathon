import { motion } from "framer-motion";

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
}

export function MetricCard({ icon, label, value, trend }: MetricCardProps) {
  const isPositive = trend.startsWith("+");

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      className="relative p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800 
                 hover:border-cyan-400/30 transition-all duration-300 group"
    >
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300">
        <div className="absolute inset-0 bg-cyan-500/10 blur-xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center justify-between">
        {/* Left */}
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>

          <span
            className={`text-sm mt-2 inline-block ${
              isPositive ? "text-green-400" : "text-red-400"
            }`}
          >
            {trend}
          </span>
        </div>

        {/* Icon */}
        <div className="text-cyan-400 group-hover:scale-110 transition">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}