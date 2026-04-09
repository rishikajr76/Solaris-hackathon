import type { FC } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
  Legend,
} from "recharts";

const data = [
  { name: "Mon", reviews: 42, issues: 24 },
  { name: "Tue", reviews: 48, issues: 28 },
  { name: "Wed", reviews: 38, issues: 20 },
  { name: "Thu", reviews: 58, issues: 39 },
  { name: "Fri", reviews: 72, issues: 48 },
  { name: "Sat", reviews: 35, issues: 18 },
  { name: "Sun", reviews: 28, issues: 15 },
];

// 🔥 Better Tooltip
const CustomTooltip: FC<TooltipProps<number, string>> = ({
  active,
  payload,
  label,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-lg">
        <p className="text-sm text-cyan-400 font-semibold">{label}</p>
        <p className="text-sm text-white">
          Reviews: <span className="text-cyan-400">{payload[0].value}</span>
        </p>
        <p className="text-sm text-white">
          Issues: <span className="text-purple-400">{payload[1].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export function ReviewChart() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Weekly Review Metrics
          </h3>
          <p className="text-sm text-slate-400">
            PR reviews vs detected issues
          </p>
        </div>

        <span className="text-xs px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-400/20">
          Live
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
          />

          <XAxis
            dataKey="name"
            stroke="rgba(255,255,255,0.4)"
            tick={{ fontSize: 12 }}
          />

          <YAxis
            stroke="rgba(255,255,255,0.4)"
            tick={{ fontSize: 12 }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend />

          {/* Reviews Line */}
          <Line
            type="monotone"
            dataKey="reviews"
            stroke="#06b6d4"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />

          {/* Issues Line */}
          <Line
            type="monotone"
            dataKey="issues"
            stroke="#a855f7"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}