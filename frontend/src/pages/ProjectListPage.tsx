import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { ProjectTable } from '../components/ProjectTable'
import { supabase, type Repository } from '../lib/supabaseClient'
import { Plus, RefreshCw } from 'lucide-react'

export function ProjectListPage() {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRepositories()

    // 🔥 REAL-TIME SUBSCRIPTION (HUGE UPGRADE)
    const channel = supabase
      .channel('repositories_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'repositories',
        },
        (payload) => {
          console.log('Realtime update:', payload)

          if (payload.eventType === 'INSERT') {
            setRepositories((prev) => [
              payload.new as Repository,
              ...prev,
            ])
          }

          if (payload.eventType === 'UPDATE') {
            setRepositories((prev) =>
              prev.map((repo) =>
                repo.id === payload.new.id ? (payload.new as Repository) : repo
              )
            )
          }

          if (payload.eventType === 'DELETE') {
            setRepositories((prev) =>
              prev.filter((repo) => repo.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe() // ✅ proper cleanup
    }
  }, [])

  const fetchRepositories = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('repositories')
        .select('*')
        .order('last_synced_at', { ascending: false })

      if (fetchError) throw fetchError

      setRepositories(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repositories')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar />

      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="flex-1 overflow-auto pt-20 md:pt-0"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          
          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          >
            <div>
              <h1 className="text-4xl font-bold text-gradient mb-2">Projects</h1>
              <p className="text-slate-400">
                Manage your repositories and enable code reviews
              </p>
            </div>

            <div className="flex gap-3">
              {/* Refresh */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={fetchRepositories}
                disabled={loading}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw
                  size={16}
                  className={loading ? 'animate-spin' : ''}
                />
                Refresh
              </motion.button>

              {/* Add Repo */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={16} />
                Add Repository
              </motion.button>
            </div>
          </motion.div>

          {/* Error State */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300"
            >
              {error}
              <button
                onClick={fetchRepositories}
                className="ml-3 text-red-200 hover:text-red-100 font-semibold"
              >
                Try again
              </button>
            </motion.div>
          )}

          {/* Loading State */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-neon p-12 rounded-xl text-center"
            >
              <div className="inline-block">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  className="w-12 h-12 border-3 border-purple-neon/30 border-t-purple-neon rounded-full"
                />
              </div>
              <p className="mt-4 text-slate-400">
                Loading repositories...
              </p>
            </motion.div>
          )}

          {/* Table */}
          {!loading && repositories.length > 0 && (
            <ProjectTable repositories={repositories} />
          )}

          {/* Empty State */}
          {!loading && repositories.length === 0 && !error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-neon p-12 rounded-xl text-center"
            >
              <p className="text-slate-400 mb-4">
                No repositories found
              </p>

              <p className="text-sm text-slate-500 mb-6">
                Add your first repository to get started with AI-powered code reviews.
              </p>

              <motion.button
                whileHover={{ scale: 1.05 }}
                className="btn-primary"
              >
                Add Your First Repository
              </motion.button>
            </motion.div>
          )}
        </div>
      </motion.main>
    </div>
  )
}