import fs from 'fs';
import path from 'path';

/**
 * Enhanced Context Retriever
 * Instead of just a string, it provides the AI with:
 * 1. The Project Structure (File Tree)
 * 2. Key Tech Stack details
 * 3. Architecture Rules
 */
export async function retrieveProjectContext(diff: string): Promise<string> {
  const rootPath = path.resolve(__dirname, '../../');
  
  // 1. Get a snapshot of the project structure
  // This tells the AI if it's in a Monorepo, MVC, or Microservice setup
  const projectMap = getProjectMap(rootPath);

  return `
--- SYSTEM ARCHITECTURE CONTEXT ---
Project Structure:
${projectMap}

Architecture Guidelines:
- Framework: Vite + React (Frontend), Node.js + TypeScript (Backend)
- State Management: Supabase Realtime / React Hooks
- Rules: Use async/await, avoid global state, maintain strictly typed interfaces.
- AIoT Integration: Ensure data privacy for affective computing metrics.

--- DIFF SPECIFIC CONTEXT ---
The following review should consider how these changes impact the existing file tree above.
`.trim();
}

function getProjectMap(dir: string, depth = 0): string {
  if (depth > 2) return ''; // Don't go too deep to save tokens
  let map = '';
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    if (['node_modules', '.git', 'dist', '.env'].includes(file)) return;
    map += `${'  '.repeat(depth)}├── ${file}\n`;
    
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      map += getProjectMap(fullPath, depth + 1);
    }
  });

  return map;
}