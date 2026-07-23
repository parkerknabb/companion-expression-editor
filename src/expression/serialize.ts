import type { BinaryOperator, ExpressionNode, ProgramNode, StatementNode } from './model'
import { findFunctionDefinition, variadicInlineInputLimit } from './model'

const precedence: Record<BinaryOperator, number> = { '||': 1, '??': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '===': 6, '!==': 6, '>': 7, '>=': 7, '<': 7, '<=': 7, '>>': 8, '<<': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10, '**': 11 }
const unaryPrecedence = 12
const accessPrecedence = 13

export function serializeProgram(program: ProgramNode): string { return program.statements.map((statement, index) => serializeStatement(statement, index < program.statements.length - 1)).join('\n') }
export function formatProgram(program: ProgramNode): string {
  return program.statements.map((statement, index) => {
    if (isExpressionStatement(statement)) return `${formatExpression(statement, 0, 'root')}${index < program.statements.length - 1 ? ';' : ''}`
    if (statement.type === 'Assignment') return `${assignmentTarget(statement)} = ${formatExpression(statement.value, 0, 'root')};`
    return formatStatement(statement, 0)
  }).join('\n')
}

function serializeStatement(statement: StatementNode, terminateExpression = true): string {
  switch (statement.type) {
    case 'Assignment': return `${assignmentTarget(statement)} = ${serializeExpression(statement.value)};`
    case 'Declaration': return `${statement.kind} ${statement.name}${statement.value ? ` = ${serializeExpression(statement.value)}` : ''};`
    case 'Return': return `return${statement.value ? ` ${serializeExpression(statement.value)}` : ''};`
    case 'Break': return 'break;'
    case 'Continue': return 'continue;'
    case 'IfStatement': return `if (${serializeExpression(statement.condition)}) ${serializeBody(statement.consequent)}${statement.alternate ? ` else ${serializeBody(statement.alternate)}` : ''}`
    case 'WhileStatement': return `while (${serializeExpression(statement.condition)}) ${serializeBody(statement.body)}`
    case 'ForStatement': return `for (${serializeForPart(statement.init)}; ${statement.test ? serializeExpression(statement.test) : ''}; ${statement.update ? serializeExpression(statement.update) : ''}) ${serializeBody(statement.body)}`
    case 'ForOfStatement': return `for (${statement.kind} ${statement.name} of ${serializeExpression(statement.iterable)}) ${serializeBody(statement.body)}`
    default: return `${serializeExpression(statement)}${terminateExpression ? ';' : ''}`
  }
}

function serializeForPart(statement?: StatementNode): string {
  if (!statement) return ''
  if (statement.type === 'Declaration') return `${statement.kind} ${statement.name}${statement.value ? ` = ${serializeExpression(statement.value)}` : ''}`
  if (statement.type === 'Assignment') return `${assignmentTarget(statement)} = ${serializeExpression(statement.value)}`
  return serializeExpression(statement as ExpressionNode)
}
function assignmentTarget(statement: Extract<StatementNode, { type: 'Assignment' }>): string { return statement.name ?? (statement.target ? serializeExpression(statement.target) : '') }
function serializeBody(statements: StatementNode[]): string { return `{ ${statements.map((statement) => serializeStatement(statement)).join(' ')} }` }

function formatStatement(statement: StatementNode, level: number): string {
  const pad = indent(level)
  switch (statement.type) {
    case 'IfStatement': return `${pad}if (${serializeExpression(statement.condition)}) ${formatBody(statement.consequent, level)}${statement.alternate ? ` else ${formatBody(statement.alternate, level)}` : ''}`
    case 'WhileStatement': return `${pad}while (${serializeExpression(statement.condition)}) ${formatBody(statement.body, level)}`
    case 'ForStatement': return `${pad}for (${serializeForPart(statement.init)}; ${statement.test ? serializeExpression(statement.test) : ''}; ${statement.update ? serializeExpression(statement.update) : ''}) ${formatBody(statement.body, level)}`
    case 'ForOfStatement': return `${pad}for (${statement.kind} ${statement.name} of ${serializeExpression(statement.iterable)}) ${formatBody(statement.body, level)}`
    default: return `${pad}${serializeStatement(statement)}`
  }
}
function formatBody(statements: StatementNode[], level: number): string { return statements.length ? `{\n${statements.map((statement) => formatStatement(statement, level + 1)).join('\n')}\n${indent(level)}}` : '{}' }
function indent(level: number): string { return '  '.repeat(level) }

type FormatContext = 'root' | 'ternaryBranch' | 'functionArg'
function isExpressionStatement(statement: StatementNode): statement is ExpressionNode { return !['Assignment', 'Declaration', 'Return', 'Break', 'Continue', 'IfStatement', 'WhileStatement', 'ForStatement', 'ForOfStatement'].includes(statement.type) }
function formatExpression(node: ExpressionNode, level: number, context: FormatContext): string {
  if (node.type === 'Ternary') return [serializeExpression(node.condition), `${indent(level + 1)}? ${formatExpression(node.whenTrue, level + 1, 'ternaryBranch')}`, `${indent(level + 1)}: ${formatExpression(node.whenFalse, level + 1, 'ternaryBranch')}`].join('\n')
  if (node.type === 'FunctionCall' && shouldFormatFunctionMultiline(node, context)) {
    const args = node.args.map((arg, index) => `${indent(level + 2)}${formatExpression(arg, level + 2, 'functionArg')}${index === node.args.length - 1 ? '' : ','}`).join('\n')
    return `${node.name}(\n${args}\n${indent(level + 1)})`
  }
  return serializeExpression(node)
}

export function serializeExpression(node: ExpressionNode, parentPrecedence = 0): string {
  switch (node.type) {
    case 'Variable': return serializeVariable(node.name)
    case 'LocalReference': return node.name
    case 'Literal': return serializeLiteral(node.value)
    case 'TemplateString': return `\`${node.parts.map((part) => typeof part === 'string' ? escapeTemplateText(part) : `\${${serializeExpression(part)}}`).join('')}\``
    case 'FunctionCall': return `${node.name}(${node.args.map((arg) => serializeExpression(arg)).join(', ')})`
    case 'IndexAccess': { const code = `${serializeExpression(node.object, accessPrecedence)}${node.optional ? '?.' : ''}[${serializeExpression(node.index)}]`; return accessPrecedence < parentPrecedence ? `(${code})` : code }
    case 'PropertyAccess': { const code = `${serializeExpression(node.object, accessPrecedence)}${node.optional ? '?.' : '.'}${node.property}`; return accessPrecedence < parentPrecedence ? `(${code})` : code }
    case 'Ternary': { const code = `${serializeExpression(node.condition)} ? ${serializeExpression(node.whenTrue)} : ${serializeExpression(node.whenFalse)}`; return parentPrecedence > 0 ? `(${code})` : code }
    case 'BinaryExpression': { const own = precedence[node.operator]; const right = node.operator === '**' ? own : own + 1; const code = `${serializeExpression(node.left, own)} ${node.operator} ${serializeExpression(node.right, right)}`; return own < parentPrecedence ? `(${code})` : code }
    case 'UnaryExpression': { const code = node.operator === 'typeof' ? `typeof ${serializeExpression(node.argument, unaryPrecedence)}` : `${node.operator}${serializeExpression(node.argument, unaryPrecedence)}`; return unaryPrecedence < parentPrecedence ? `(${code})` : code }
    case 'Array': return `[${node.elements.map((element) => serializeExpression(element)).join(', ')}]`
    case 'Object': return `{ ${node.properties.map(({ key, value }) => key === '...' ? serializeExpression(value) : `${isIdentifier(key) ? key : JSON.stringify(key)}: ${serializeExpression(value)}`).join(', ')} }`
    case 'Spread': return `...${serializeExpression(node.argument)}`
    case 'ArrowFunction': { const params = node.params.length === 1 ? node.params[0] : `(${node.params.join(', ')})`; return `${params} => ${Array.isArray(node.body) ? serializeBody(node.body) : serializeExpression(node.body)}` }
    case 'UpdateExpression': return node.prefix ? `${node.operator}${node.argument.name}` : `${node.argument.name}${node.operator}`
  }
}

function serializeVariable(name: string): string { const value = `$(${name})`; return name.includes('$(') ? `parseVariables(${JSON.stringify(value)})` : value }
function serializeLiteral(value: string | number | boolean | null | undefined): string { if (typeof value === 'string') return JSON.stringify(value); if (value === null) return 'null'; if (value === undefined) return 'undefined'; return String(value) }
function escapeTemplateText(value: string): string { return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') }
function isIdentifier(value: string): boolean { return /^[A-Za-z_$][\w$]*$/.test(value) }

// Keep the compact, readable function layout introduced by the original editor.
function shouldFormatFunctionMultiline(node: Extract<ExpressionNode, { type: 'FunctionCall' }>, _context: FormatContext): boolean { const definition = findFunctionDefinition(node.name); return Boolean(definition?.variadic && node.args.length > variadicInlineInputLimit) }
