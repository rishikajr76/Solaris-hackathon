import fs from 'fs';
import path from 'path';

export async function buildRepositoryIndex(rootDir: string): Promise<string[]> {
  const entries: string[] = [];

  function walk(directory: string) {
    const items = fs.readdirSync(directory, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(directory, item.name);
      if (item.isDirectory()) {
        if (['node_modules', '.git', 'dist'].includes(item.name)) {
          continue;
        }
        walk(itemPath);
      } else if (item.isFile()) {
        if (['README.md', 'docs', 'utils'].some((segment) => itemPath.includes(segment))) {
          entries.push(fs.readFileSync(itemPath, 'utf-8'));
        }
      }
    }
  }

  walk(rootDir);
  return entries;
}
