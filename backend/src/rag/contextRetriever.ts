export async function retrieveProjectContext(diff: string): Promise<string> {
  // Placeholder for RAG context retrieval.
  // In production, this should query a ChromaDB vector store using the diff and return project-specific architecture guidance.
  return `Project rules: use async/await, avoid global state, keep API routes thin, follow repository naming conventions.`;
}
