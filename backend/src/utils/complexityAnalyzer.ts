import Parser from 'tree-sitter';
const JavaScript = require('tree-sitter-javascript');

const parser = new Parser();
parser.setLanguage(JavaScript);

const complexityNodeTypes = new Set([
  'if_statement',
  'for_statement',
  'for_in_statement',
  'for_of_statement',
  'while_statement',
  'do_statement',
  'switch_statement',
  'conditional_expression',
]);

function normalizeScore(score: number): number {
  return Math.min(10, Math.max(1, Math.round(score)));
}

/**
 * UPDATED: Only extracts ADDED (+) lines.
 * Analyzing removed (-) lines gives a false complexity reading of the past state.
 */
function extractNewCode(diff: string): string {
  const lines = diff.split('\n');
  const isActualDiff = lines.some(l => l.startsWith('@@'));

  if (!isActualDiff) return diff; // Handle raw code input

  return lines
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n');
}

function countNodeComplexity(node: Parser.SyntaxNode, nesting: number): number {
  let score = 0;

  switch (node.type) {
    case 'if_statement':
    case 'for_statement':
    case 'for_in_statement':
    case 'for_of_statement':
    case 'while_statement':
    case 'do_statement':
    case 'switch_statement':
      // The core of Cognitive Load: Nesting increases the weight exponentially
      score += 1 + nesting;
      break;
    case 'conditional_expression': // Ternaries
      score += 1;
      break;
    case 'binary_expression': {
      const operatorText = node.child(1)?.text;
      if (operatorText === '&&' || operatorText === '||') {
        score += 0.5;
      }
      break;
    }
  }

  const childNesting = complexityNodeTypes.has(node.type) ? nesting + 1 : nesting;

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      score += countNodeComplexity(child, childNesting);
    }
  }

  return score;
}

export function calculateCognitiveComplexity(codeOrDiff: string): number {
  const code = extractNewCode(codeOrDiff);

  if (!code.trim()) return 1;

  try {
    const tree = parser.parse(code);
    // Weighted base: complexity / 2 to keep the 1-10 scale realistic
    const rawScore = countNodeComplexity(tree.rootNode, 0);
    return normalizeScore(rawScore / 2 || 1);
  } catch (error) {
    console.error('AST Parsing Error:', error);
    return 1;
  }
}