import { parse } from 'acorn'
import type { BinaryOperator, ExpressionNode, ProgramNode, StatementNode, UnaryOperator } from './model'
import { binaryOperators, findFunctionDefinition, unaryOperators } from './model'

type AstNode = { type: string; [key: string]: any }

export class ExpressionParseError extends Error {
  constructor(message: string) { super(message); this.name = 'ExpressionParseError' }
}

/** Parse the JavaScript subset accepted by Companion 5.0. */
export function parseExpressionProgram(input: string): ProgramNode {
  if (!input.trim()) throw new ExpressionParseError('Paste an expression before importing.')
  try {
    const ast = parse(preprocessVariables(preprocessTemplates(input)), { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true }) as unknown as AstNode
    return { type: 'Program', statements: ast.body.map(fromStatement) }
  } catch (error) {
    if (error instanceof ExpressionParseError) throw error
    const message = error instanceof Error ? error.message.replace(/\s*\(\d+:\d+\)$/, '') : 'Unknown parser error'
    throw new ExpressionParseError(message)
  }
}

function fromStatement(node: AstNode): StatementNode {
  switch (node.type) {
    case 'ExpressionStatement': return node.expression.type === 'AssignmentExpression' ? fromAssignment(node.expression) : fromExpression(node.expression)
    case 'VariableDeclaration': {
      if (node.kind !== 'let' && node.kind !== 'const') throw unsupported(node)
      if (node.declarations.length !== 1 || node.declarations[0].id.type !== 'Identifier') throw new ExpressionParseError('Declare one named local value at a time.')
      const declaration = node.declarations[0]
      return { type: 'Declaration', kind: node.kind, name: declaration.id.name, value: declaration.init ? fromExpression(declaration.init) : undefined }
    }
    case 'IfStatement': return { type: 'IfStatement', condition: fromExpression(node.test), consequent: fromBlock(node.consequent), alternate: node.alternate ? fromBlock(node.alternate) : undefined }
    case 'WhileStatement': return { type: 'WhileStatement', condition: fromExpression(node.test), body: fromBlock(node.body) }
    case 'ForStatement': return { type: 'ForStatement', init: node.init ? fromForInit(node.init) : undefined, test: node.test ? fromExpression(node.test) : undefined, update: node.update ? fromExpression(node.update) : undefined, body: fromBlock(node.body) }
    case 'ForOfStatement': {
      if (node.left.type !== 'VariableDeclaration' || node.left.declarations.length !== 1 || node.left.declarations[0].id.type !== 'Identifier') throw new ExpressionParseError('for...of needs one let or const local variable.')
      return { type: 'ForOfStatement', kind: node.left.kind, name: node.left.declarations[0].id.name, iterable: fromExpression(node.right), body: fromBlock(node.body) }
    }
    case 'ReturnStatement': return { type: 'Return', value: node.argument ? fromExpression(node.argument) : undefined }
    case 'BreakStatement': return { type: 'Break' }
    case 'ContinueStatement': return { type: 'Continue' }
    default: throw unsupported(node)
  }
}

function fromForInit(node: AstNode): StatementNode {
  if (node.type === 'VariableDeclaration') return fromStatement(node)
  if (node.type === 'AssignmentExpression') return fromAssignment(node)
  return fromExpression(node)
}

function fromAssignment(node: AstNode): StatementNode {
  if (node.operator !== '=') throw new ExpressionParseError('Only = assignment is supported.')
  if (node.left.type === 'Identifier') return { type: 'Assignment', name: node.left.name, value: fromExpression(node.right) }
  if (node.left.type === 'MemberExpression') {
    const target = fromMember(node.left)
    if (target.type === 'PropertyAccess' || target.type === 'IndexAccess') return { type: 'Assignment', target, value: fromExpression(node.right) }
  }
  throw new ExpressionParseError('Assignments need a local variable, object property, or array index.')
}

function fromBlock(node: AstNode): StatementNode[] {
  return node.type === 'BlockStatement' ? node.body.map(fromStatement) : [fromStatement(node)]
}

function fromExpression(node: AstNode): ExpressionNode {
  switch (node.type) {
    case 'Literal': return { type: 'Literal', value: node.value }
    case 'Identifier':
      if (node.name === 'undefined') return { type: 'Literal', value: undefined }
      return { type: 'LocalReference', name: node.name }
    case 'BinaryExpression':
    case 'LogicalExpression': return fromBinary(node)
    case 'UnaryExpression': return fromUnary(node)
    case 'ConditionalExpression': return { type: 'Ternary', condition: fromExpression(node.test), whenTrue: fromExpression(node.consequent), whenFalse: fromExpression(node.alternate) }
    case 'CallExpression': return fromCall(node)
    case 'MemberExpression': return fromMember(node)
    case 'ChainExpression': return fromExpression(node.expression)
    case 'ArrayExpression': return { type: 'Array', elements: node.elements.map((element: AstNode | null) => element ? fromExpression(element) : { type: 'Literal', value: undefined }) }
    case 'ObjectExpression': return fromObject(node)
    case 'SpreadElement': return { type: 'Spread', argument: fromExpression(node.argument) }
    case 'ArrowFunctionExpression': return fromArrow(node)
    case 'UpdateExpression': {
      if (node.argument.type !== 'Identifier' || !['++', '--'].includes(node.operator)) throw new ExpressionParseError('Only local values can be updated with ++ or --.')
      return { type: 'UpdateExpression', operator: node.operator, argument: { type: 'LocalReference', name: node.argument.name }, prefix: node.prefix }
    }
    case 'AssignmentExpression': throw new ExpressionParseError('Assignments are statements, not values.')
    default: throw unsupported(node)
  }
}

function fromBinary(node: AstNode): ExpressionNode {
  const operator = node.operator as BinaryOperator
  if (!binaryOperators.includes(operator)) throw new ExpressionParseError(`Unsupported operator "${node.operator}".`)
  validateLogicalComparisonShortcut(node)
  return { type: 'BinaryExpression', operator, left: fromExpression(node.left), right: fromExpression(node.right) }
}

function fromUnary(node: AstNode): ExpressionNode {
  const operator = node.operator as UnaryOperator
  if (!unaryOperators.includes(operator)) throw new ExpressionParseError(`Unsupported unary operator "${node.operator}".`)
  return { type: 'UnaryExpression', operator, argument: fromExpression(node.argument) }
}

function fromCall(node: AstNode): ExpressionNode {
  const name = node.callee.type === 'Identifier' ? node.callee.name : ''
  const args = node.arguments.map(fromExpression)
  if (name === '__companionVariable') {
    const arg = args[0]
    if (!arg || arg.type !== 'Literal' || typeof arg.value !== 'string') throw new ExpressionParseError('Variable references must contain a variable name.')
    return { type: 'Variable', name: arg.value }
  }
  if (name === '__companionTemplate') return fromTemplateCall(args)
  const definition = findFunctionDefinition(name)
  if (!definition && !name) throw new ExpressionParseError('Unsupported function "anonymous".')
  if (definition && (args.length < definition.minArgs || (definition.maxArgs !== null && args.length > definition.maxArgs))) throw new ExpressionParseError(`${definition.label} requires ${formatArgCount(definition.minArgs, definition.maxArgs)}.`)
  return { type: 'FunctionCall', name: definition?.name ?? name, args }
}

function fromMember(node: AstNode): ExpressionNode {
  const object = fromExpression(node.object)
  if (node.computed) return { type: 'IndexAccess', object, index: fromExpression(node.property), ...(node.optional ? { optional: true } : {}) }
  if (node.property.type !== 'Identifier') throw new ExpressionParseError('Unsupported property access.')
  return { type: 'PropertyAccess', object, property: node.property.name, ...(node.optional ? { optional: true } : {}) }
}

function fromObject(node: AstNode): ExpressionNode {
  return {
    type: 'Object',
    properties: node.properties.map((property: AstNode) => {
      if (property.type === 'SpreadElement') return { key: '...', value: { type: 'Spread', argument: fromExpression(property.argument) } as ExpressionNode }
      if (property.type !== 'Property' || property.computed || property.kind !== 'init') throw new ExpressionParseError('Object values must use simple key: value entries.')
      const key = property.key.type === 'Identifier' ? property.key.name : String(property.key.value)
      return { key, value: fromExpression(property.value) }
    }),
  }
}

function fromArrow(node: AstNode): ExpressionNode {
  if (node.params.some((param: AstNode) => param.type !== 'Identifier')) throw new ExpressionParseError('Arrow function parameters must be local names.')
  return { type: 'ArrowFunction', params: node.params.map((param: AstNode) => param.name), body: node.body.type === 'BlockStatement' ? node.body.body.map(fromStatement) : fromExpression(node.body) }
}

function validateLogicalComparisonShortcut(node: AstNode): void {
  const equality = ['==', '!=', '===', '!=='].includes(node.operator)
  const logical = (value: AstNode) => ['LogicalExpression', 'BinaryExpression'].includes(value.type) && ['||', '&&'].includes(value.operator)
  const comparison = (value: AstNode) => value.type === 'BinaryExpression' && ['==', '!=', '===', '!==', '>', '>=', '<', '<='].includes(value.operator)
  if (equality && (logical(node.left) || logical(node.right))) throw new ExpressionParseError('Compare each condition directly, for example value == "A" || value == "B".')
  if (['||', '&&'].includes(node.operator) && ((comparison(node.left) && node.right.type === 'Literal') || (comparison(node.right) && node.left.type === 'Literal'))) throw new ExpressionParseError('Compare each condition directly, for example value == "A" || value == "B".')
}

function fromTemplateCall(args: ExpressionNode[]): ExpressionNode {
  if (!args.length) return { type: 'TemplateString', parts: [''] }
  return { type: 'TemplateString', parts: args.map((arg, index) => {
    if (index % 2) return arg
    if (arg.type !== 'Literal' || typeof arg.value !== 'string') throw new ExpressionParseError('Template string text parts must be strings.')
    return arg.value
  }) }
}

function formatArgCount(min: number, max: number | null): string { return max === null ? `at least ${min} arguments` : min === max ? `${min} argument${min === 1 ? '' : 's'}` : `${min} to ${max} arguments` }
function unsupported(node: AstNode): ExpressionParseError { return new ExpressionParseError(`Unsupported Companion 5.0 syntax "${node.type}".`) }

function preprocessVariables(input: string): string {
  let output = '', quote: string | null = null, escaped = false
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index], next = input[index + 1]
    if (quote) { output += char; if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = null; continue }
    if (char === '"' || char === "'" || char === '`') { quote = char; output += char; continue }
    if (char === '$' && next === '(') { const end = findVariableReferenceEnd(input, index); if (end === -1) throw new ExpressionParseError('Variable reference is missing a closing parenthesis.'); const name = input.slice(index + 2, end); if (name.includes('$(')) throw new ExpressionParseError('Nested variable references must use parseVariables().'); output += `__companionVariable(${JSON.stringify(name)})`; index = end; continue }
    output += char
  }
  return output
}

function preprocessTemplates(input: string): string {
  let output = '', quote: string | null = null, escaped = false
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quote) { output += char; if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = null; continue }
    if (char === '"' || char === "'") { quote = char; output += char; continue }
    if (char === '`') { const parsed = parseTemplateLiteral(input, index); output += parsed.replacement; index = parsed.end; continue }
    output += char
  }
  return output
}

function parseTemplateLiteral(input: string, start: number): { replacement: string; end: number } {
  const args: string[] = []; let text = '', escaped = false
  for (let index = start + 1; index < input.length; index += 1) {
    const char = input[index], next = input[index + 1]
    if (escaped) { text += char; escaped = false; continue }
    if (char === '\\') { text += char; escaped = true; continue }
    if (char === '`') { args.push(JSON.stringify(text)); return { replacement: `__companionTemplate(${args.join(', ')})`, end: index } }
    if (char === '$' && next === '{') { const end = findTemplateInterpolationEnd(input, index + 2); if (end === -1) throw new ExpressionParseError('Template interpolation is missing a closing brace.'); args.push(JSON.stringify(text), preprocessVariables(preprocessTemplates(input.slice(index + 2, end).trim()))); text = ''; index = end; continue }
    text += char
  }
  throw new ExpressionParseError('Template string is missing a closing backtick.')
}

function findTemplateInterpolationEnd(input: string, start: number): number { let depth = 1, quote: string | null = null, escaped = false; for (let index = start; index < input.length; index += 1) { const char = input[index]; if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = null; continue }; if (char === '"' || char === "'" || char === '`') { quote = char; continue }; if (char === '{') depth += 1; if (char === '}' && --depth === 0) return index }; return -1 }
function findVariableReferenceEnd(input: string, start: number): number { let depth = 0; for (let index = start; index < input.length; index += 1) { if (input[index] === '$' && input[index + 1] === '(') { depth += 1; index += 1; continue }; if (input[index] === ')' && --depth === 0) return index }; return -1 }
