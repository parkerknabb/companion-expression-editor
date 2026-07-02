import type { BinaryOperator, ExpressionNode, ProgramNode, StatementNode } from './model'
import { findFunctionDefinition, variadicInlineInputLimit } from './model'

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
  return program.statements.map((statement) => serializeStatement(statement)).join(';\n')
}

export function formatProgram(program: ProgramNode): string {
  return program.statements.map((statement) => formatStatement(statement)).join(';\n')
}

function serializeStatement(statement: StatementNode): string {
  if (statement.type === 'Assignment') return `${statement.name} = ${serializeExpression(statement.value)}`
  return serializeExpression(statement)
}

function formatStatement(statement: StatementNode): string {
  if (statement.type === 'Assignment') return `${statement.name} = ${formatExpression(statement.value, 0, 'root')}`
  return formatExpression(statement, 0, 'root')
}

export function serializeExpression(node: ExpressionNode, parentPrecedence = 0): string {
  switch (node.type) {
    case 'Variable':
      return serializeVariable(node.name)
    case 'LocalReference':
      return node.name
    case 'Literal':
      return serializeLiteral(node.value)
    case 'TemplateString':
      return serializeTemplateString(node.parts)
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

type FormatContext = 'root' | 'ternaryBranch' | 'functionArg'

function formatExpression(node: ExpressionNode, level: number, context: FormatContext): string {
  switch (node.type) {
    case 'Ternary':
      return formatTernary(node, level)
    case 'FunctionCall':
      return shouldFormatFunctionMultiline(node, context)
        ? formatFunctionCall(node, level)
        : serializeExpression(node)
    default:
      return serializeExpression(node)
  }
}

function formatTernary(node: Extract<ExpressionNode, { type: 'Ternary' }>, level: number): string {
  return [
    serializeExpression(node.condition),
    `${indent(level + 1)}? ${formatExpression(node.whenTrue, level + 1, 'ternaryBranch')}`,
    `${indent(level + 1)}: ${formatExpression(node.whenFalse, level + 1, 'ternaryBranch')}`,
  ].join('\n')
}

function formatFunctionCall(node: Extract<ExpressionNode, { type: 'FunctionCall' }>, level: number): string {
  const argIndent = indent(level + 2)
  const closeIndent = indent(level + 1)
  const args = node.args
    .map((arg, index) => {
      const suffix = index === node.args.length - 1 ? '' : ','
      return `${argIndent}${formatExpression(arg, level + 2, 'functionArg')}${suffix}`
    })
    .join('\n')

  return `${node.name}(\n${args}\n${closeIndent})`
}

function shouldFormatFunctionMultiline(node: Extract<ExpressionNode, { type: 'FunctionCall' }>, context: FormatContext): boolean {
  const definition = findFunctionDefinition(node.name)
  if (definition?.variadic) return node.args.length > variadicInlineInputLimit
  if (node.args.some((arg) => arg.type === 'Ternary')) return true
  if (serializeExpression(node).length > 80) return true
  return context === 'ternaryBranch' && node.args.length > 1
}

function indent(level: number): string {
  return '  '.repeat(level)
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

function serializeTemplateString(parts: Array<string | ExpressionNode>): string {
  return `\`${parts.map((part) => (typeof part === 'string' ? escapeTemplateText(part) : `\${${serializeExpression(part)}}`)).join('')}\``
}

function escapeTemplateText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}
