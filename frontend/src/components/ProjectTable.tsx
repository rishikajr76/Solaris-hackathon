import { useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { type Repository } from "../lib/supabaseClient";
import { syncRepositoryViaApi } from "../lib/api";

interface ProjectTableProps {
  repositories: Repository[];
  onRepositoryUpdated?: (repo: Repository) => void;
}

export function ProjectTable({ repositories, onRepositoryUpdated }: ProjectTableProps) {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleView = (repo: Repository, e: MouseEvent) => {
    e.preventDefault();
    navigate(`/projects/${repo.id}`);
  };

  const handleSync = async (repo: Repository, e: MouseEvent) => {
    e.preventDefault();
    setSyncError(null);
    setSyncingId(repo.id);
    try {
      const updated = await syncRepositoryViaApi(repo.id);
      onRepositoryUpdated?.(updated);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 backdrop-blur-md"
    >
      {syncError && (
        <div className="border-b border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {syncError}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Header */}
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80">
              <th className="px-6 py-4 text-left text-sm font-semibold tracking-wide text-slate-300">
                Repository
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold tracking-wide text-slate-300">
                Owner
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold tracking-wide text-slate-300">
                Last Synced
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold tracking-wide text-slate-300">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {repositories.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-10 text-center readable-prose-muted"
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
                  <td className="px-6 py-4 text-[15px] font-medium text-cyan-400">
                    {repo.repo_name}
                  </td>

                  {/* Owner */}
                  <td className="px-6 py-4 text-[15px] text-slate-300">
                    {repo.owner}
                  </td>

                  {/* Last Synced */}
                  <td className="px-6 py-4 text-[15px] tabular-nums text-slate-400">
                    {repo.last_synced_at
                      ? new Date(repo.last_synced_at).toLocaleDateString()
                      : "—"}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-[15px] flex gap-3">
                    <button
                      type="button"
                      onClick={(e) => handleView(repo, e)}
                      className="text-cyan-400 hover:text-white transition font-semibold"
                    >
                      View
                    </button>

                    <button
                      type="button"
                      onClick={(e) => void handleSync(repo, e)}
                      disabled={syncingId === repo.id}
                      className="text-purple-400 hover:text-white transition font-semibold disabled:opacity-40"
                    >
                      {syncingId === repo.id ? "Syncing…" : "Sync"}
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