import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { createRepositoryViaApi } from "../lib/api";
import type { Repository } from "../lib/supabaseClient";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: (repo: Repository) => void;
};

export function AddRepositoryModal({ open, onClose, onAdded }: Props) {
  const [owner, setOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOwner("");
    setRepoName("");
    setError(null);
    setBusy(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const o = owner.trim();
    const r = repoName.trim();
    if (!o || !r) {
      setError("Enter both owner and repository name.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const repo = await createRepositoryViaApi(o, r);
      onAdded(repo);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add repository.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="add-repository-modal"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close"
            onClick={handleClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-repo-title"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="add-repo-title" className="text-xl font-bold text-white">
                  Add repository
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  GitHub <span className="text-cyan-400">owner</span> (user or org) and{" "}
                  <span className="text-cyan-400">repository</span> name — same as in{" "}
                  <code className="text-slate-500">owner/repo</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="repo-owner" className="mb-1 block text-sm text-slate-400">
                  Owner
                </label>
                <input
                  id="repo-owner"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. octocat"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="repo-name" className="mb-1 block text-sm text-slate-400">
                  Repository name
                </label>
                <input
                  id="repo-name"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. Hello-World"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-cyan-400 disabled:opacity-60"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={busy}
                  className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary rounded-lg px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Add repository"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
