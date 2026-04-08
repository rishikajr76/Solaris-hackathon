import { BarChart3, TrendingUp, AlertCircle } from "lucide-react";
import { MetricCard } from "./MetricCard";

export function MetricCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <MetricCard
        icon={<BarChart3 className="w-8 h-8" />}
        label="PRs Analyzed"
        value="2847"
        trend="+12.5%"
      />
      <MetricCard
        icon={<TrendingUp className="w-8 h-8" />}
        label="Success Rate"
        value="94%"
        trend="+3.2%"
      />
      <MetricCard
        icon={<AlertCircle className="w-8 h-8" />}
        label="Issues Found"
        value="128"
        trend="-8.1%"
      />
    </div>
  );
}