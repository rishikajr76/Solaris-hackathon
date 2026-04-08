import fs from 'fs';
import path from 'path';

export interface IndexedKnowledge {
  documentation: string[];
  architectureRules: string[];
  utilityContext: string[];
}

export async function buildRepositoryIndex(rootDir: string): Promise<IndexedKnowledge> {
  const knowledge: IndexedKnowledge = {
    documentation: [],
    architectureRules: [],
    utilityContext: []
  };

  function walk(directory: string) {
    const items = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(directory, item.name);
      
      // 1. Skip heavy/unnecessary folders
      if (item.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'coverage', '.vite'].includes(item.name)) {
          continue;
        }
        walk(itemPath);
      } else if (item.isFile()) {
        const ext = path.extname(item.name);
        
        // 2. Only index relevant files to save memory/tokens
        if (['.md', '.txt', '.ts', '.js'].includes(ext)) {
          const content = fs.readFileSync(itemPath, 'utf-8');
          
          // Categorize for better Prompt Engineering
          if (item.name.toLowerCase().includes('readme')) {
            knowledge.documentation.push(`File: ${item.name}\n${content}`);
          } else if (itemPath.includes('config') || item.name.includes('tailwind')) {
            knowledge.architectureRules.push(`Rules from ${item.name}: ${content.slice(0, 500)}`);
          } else if (itemPath.includes('utils')) {
            knowledge.utilityContext.push(`Utility ${item.name}: ${content.slice(0, 300)}`);
          }
        }
      }
    }
  }

  walk(rootDir);
  return knowledge;
}