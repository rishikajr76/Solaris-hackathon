import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';

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
  const scaled = Math.round(score);
  return Math.min(10, Math.max(1, scaled));
}

function extractCodeFromDiff(diff: string): string {
  return diff
    .split('\n')
    .filter((line) => {
      if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('@@')) {
        return false;
      }
      return true;
    })
    .map((line) => {
      if (line.startsWith('+') || line.startsWith('-')) {
        return line.slice(1);
      }
      return line;
    })
    .join('\n');
}

function countNodeComplexity(node: Parser.SyntaxNode, nesting: number): number {
  let score = 0;

  switch (node.type) {
    case 'if_statement':
      score += 1 + nesting;
      break;
    case 'for_statement':
    case 'for_in_statement':
    case 'for_of_statement':
    case 'while_statement':
    case 'do_statement':
      score += 1 + nesting;
      break;
    case 'switch_statement':
      score += 1 + nesting;
      break;
    case 'conditional_expression':
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
  const code = extractCodeFromDiff(codeOrDiff);

  try {
    const tree = parser.parse(code);
    const rawScore = countNodeComplexity(tree.rootNode, 0);
    return normalizeScore(rawScore || 1);
  } catch (error) {
    console.error('Failed to parse code for complexity analysis:', error);
    return 1;
  }
}
