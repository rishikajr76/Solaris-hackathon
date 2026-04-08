import { useState } from "react";
import { motion } from "framer-motion";
import { type Repository } from "../lib/supabaseClient";

interface ProjectTableProps {
  repositories: Repository[];
}

export function ProjectTable({ repositories }: ProjectTableProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 backdrop-blur-md"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Header */}
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80">
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                Repository
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                Owner
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                Last Synced
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {repositories.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-10 text-center text-slate-400"
                >
                  🚀 No repositories found. Add your first repo!
                </td>
              </tr>
            ) : (
              repositories.map((repo) => (
                <motion.tr
                  key={repo.id}
                  onMouseEnter={() => setHoveredId(repo.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`border-b border-slate-800 transition-all duration-300 ${
                    hoveredId === repo.id
                      ? "bg-slate-800/60"
                      : "hover:bg-slate-800/30"
                  }`}
                >
                  {/* Repo Name */}
                  <td className="px-6 py-4 text-sm font-medium text-cyan-400">
                    {repo.repo_name}
                  </td>

                  {/* Owner */}
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {repo.owner}
                  </td>

                  {/* Last Synced */}
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {repo.last_synced_at
                      ? new Date(repo.last_synced_at).toLocaleDateString()
                      : "—"}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-sm flex gap-3">
                    <button
                      onClick={() =>
                        console.log("View details:", repo.id)
                      }
                      className="text-cyan-400 hover:text-white transition font-semibold"
                    >
                      View
                    </button>

                    <button
                      onClick={() =>
                        console.log("Sync repo:", repo.id)
                      }
                      className="text-purple-400 hover:text-white transition font-semibold"
                    >
                      Sync
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}