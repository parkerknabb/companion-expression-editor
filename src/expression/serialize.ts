import type { BinaryOperator, ExpressionNode, ProgramNode } from './model'

const precedence: Record<BinaryOperator, number> = {
  '||': 1,
  '&&': 2,
  '|': 3,
  '^': 4,
  '&': 5,
  '==': 6,
  '!=': 6,
  '===': 6,
  '!==': 6,
  '>': 7,
  '>=': 7,
  '<': 7,
  '<=': 7,
  '>>': 8,
  '<<': 8,
  '+': 9,
  '-': 9,
  '*': 10,
  '/': 10,
  '%': 10,
  '**': 11,
}

const unaryPrecedence = 12

export function serializeProgram(program: ProgramNode): string {
  return program.statements.map((statement) => serializeExpression(statement)).join(';\n')
}

export function serializeExpression(node: ExpressionNode, parentPrecedence = 0): string {
  switch (node.type) {
    case 'Variable':
      return serializeVariable(node.name)
    case 'Literal':
      return serializeLiteral(node.value)
    case 'FunctionCall':
      return `${node.name}(${node.args.map((arg) => serializeExpression(arg)).join(', ')})`
    case 'Ternary': {
      const code = `${serializeExpression(node.condition)} ? ${serializeExpression(node.whenTrue)} : ${serializeExpression(node.whenFalse)}`
      return parentPrecedence > 0 ? `(${code})` : code
    }
    case 'BinaryExpression': {
      const ownPrecedence = precedence[node.operator]
      const rightPrecedence = node.operator === '**' ? ownPrecedence : ownPrecedence + 1
      const code = `${serializeExpression(node.left, ownPrecedence)} ${node.operator} ${serializeExpression(node.right, rightPrecedence)}`
      return ownPrecedence < parentPrecedence ? `(${code})` : code
    }
    case 'UnaryExpression': {
      const code = `${node.operator}${serializeExpression(node.argument, unaryPrecedence)}`
      return unaryPrecedence < parentPrecedence ? `(${code})` : code
    }
  }
}

function serializeVariable(name: string): string {
  const variableReference = `$(${name})`
  return name.includes('$(') ? `parseVariables(${JSON.stringify(variableReference)})` : variableReference
}

function serializeLiteral(value: string | number | boolean | null): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === null) return 'null'
  return String(value)
}
