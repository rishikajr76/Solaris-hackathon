import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';

const parser = new Parser();
parser.setLanguage(JavaScript);

export interface ComplexityAnalysis {
  complexityScore: number;
  conditionals: number;
  loops: number;
  logicalOperators: number;
  nestedDepth: number;
}

function extractCodeFromDiff(diff: string): string {
  return diff
    .split('\n')
    .filter((line) => !line.startsWith('diff ') && !line.startsWith('index ') && !line.startsWith('--- ') && !line.startsWith('+++ ') && !line.startsWith('@@'))
    .map((line) => {
      if (line.startsWith('+') || line.startsWith('-')) {
        return line.slice(1);
      }
      return line;
    })
    .join('\n');
}

function countDepth(node: any, currentDepth = 0): number {
  let maxDepth = currentDepth;

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const nextDepth = countDepth(child, currentDepth + (isDecisionNode(child.type) ? 1 : 0));
      if (nextDepth > maxDepth) {
        maxDepth = nextDepth;
      }
    }
  }

  return maxDepth;
}

function isDecisionNode(type: string): boolean {
  return [
    'if_statement',
    'for_statement',
    'for_in_statement',
    'for_of_statement',
    'while_statement',
    'do_statement',
    'switch_statement',
    'conditional_expression',
  ].includes(type);
}

function traverse(node: any, analysis: ComplexityAnalysis): void {
  switch (node.type) {
    case 'if_statement':
      analysis.conditionals += 1;
      break;
    case 'for_statement':
    case 'for_in_statement':
    case 'for_of_statement':
    case 'while_statement':
    case 'do_statement':
      analysis.loops += 1;
      break;
    case 'binary_expression': {
      const operator = node.child(1)?.text;
      if (operator === '&&' || operator === '||') {
        analysis.logicalOperators += 1;
      }
      break;
    }
    case 'conditional_expression':
      analysis.conditionals += 1;
      break;
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      traverse(child, analysis);
    }
  }
}

function normalizeScore(rawScore: number): number {
  const score = Math.max(1, Math.min(10, Math.round(rawScore)));
  return score;
}

export function analyzeComplexity(diff: string): ComplexityAnalysis {
  const code = extractCodeFromDiff(diff);
  const tree = parser.parse(code);

  const analysis: ComplexityAnalysis = {
    complexityScore: 1,
    conditionals: 0,
    loops: 0,
    logicalOperators: 0,
    nestedDepth: 0,
  };

  traverse(tree.rootNode, analysis);
  analysis.nestedDepth = countDepth(tree.rootNode);
  const rawScore = analysis.conditionals + analysis.loops + analysis.logicalOperators * 0.5 + analysis.nestedDepth * 0.5;
  analysis.complexityScore = normalizeScore(rawScore);

  return analysis;
}

export interface TaintFinding {
  sink: string;
  source: string;
  line: number;
  description: string;
}

export function findTaintFlows(diff: string): TaintFinding[] {
  // Minimal taint analysis placeholder; extend with actual AST flow analysis later.
  return [];
}
