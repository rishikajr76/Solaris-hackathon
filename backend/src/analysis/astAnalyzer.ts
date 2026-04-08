import Parser from 'tree-sitter';
// Fallback for native C++ bindings in Node.js
const JavaScript = require('tree-sitter-javascript');

const parser = new Parser();
parser.setLanguage(JavaScript);

export interface ComplexityAnalysis {
  complexityScore: number;
  conditionals: number;
  loops: number;
  logicalOperators: number;
  nestedDepth: number;
}

/**
 * FIXED: Only extracts the ADDED code. 
 * If you include removed lines (-), the parser sees invalid syntax 
 * because it's looking at two versions of code at once.
 */
function extractNewCode(diff: string): string {
  return diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n');
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

function countDepth(node: any, currentDepth = 0): number {
  let maxDepth = currentDepth;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      // Calculate depth based on decision branching
      const nextDepth = countDepth(child, currentDepth + (isDecisionNode(child.type) ? 1 : 0));
      maxDepth = Math.max(maxDepth, nextDepth);
    }
  }
  return maxDepth;
}

function traverse(node: any, analysis: ComplexityAnalysis): void {
  // Use a more robust type checking
  if (node.type === 'if_statement' || node.type === 'conditional_expression') {
    analysis.conditionals += 1;
  } else if ([
    'for_statement', 'for_in_statement', 'for_of_statement', 
    'while_statement', 'do_statement'
  ].includes(node.type)) {
    analysis.loops += 1;
  } else if (node.type === 'binary_expression') {
    const operator = node.child(1)?.text;
    if (operator === '&&' || operator === '||') {
      analysis.logicalOperators += 1;
    }
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) traverse(child, analysis);
  }
}

export function analyzeComplexity(diff: string): ComplexityAnalysis {
  const code = extractNewCode(diff);
  
  if (!code.trim()) {
    return { complexityScore: 1, conditionals: 0, loops: 0, logicalOperators: 0, nestedDepth: 0 };
  }

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

  // Cognitive Load Formula: Weighs nesting and logic heavily
  const rawScore = 
    (analysis.conditionals * 1) + 
    (analysis.loops * 1.5) + 
    (analysis.logicalOperators * 0.5) + 
    (analysis.nestedDepth * 2);

  analysis.complexityScore = Math.max(1, Math.min(10, Math.round(rawScore / 2)));

  return analysis;
}