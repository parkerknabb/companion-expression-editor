import jsep from 'jsep'
import type {
  BinaryOperator,
  ExpressionNode,
  ProgramNode,
  StatementNode,
  UnaryOperator,
} from './model'
import { binaryOperators, findFunctionDefinition, unaryOperators } from './model'

type JsepNode = {
  type: string
  [key: string]: unknown
}

export class ExpressionParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExpressionParseError'
  }
}

configureJsep()

export function parseExpressionProgram(input: string): ProgramNode {
  const statements = splitStatements(input).filter((statement) => statement.trim().length > 0)
  if (statements.length === 0) {
    throw new ExpressionParseError('Paste an expression before importing.')
  }

  return {
    type: 'Program',
    statements: statements.map((statement) => parseStatement(statement)),
  }
}

function parseStatement(statement: string): StatementNode {
  const assignment = splitAssignment(statement.trim())
  if (assignment) {
    return {
      type: 'Assignment',
      name: assignment.name,
      value: parseExpression(assignment.value),
    }
  }

  return parseExpression(statement)
}

function parseExpression(statement: string): ExpressionNode {
  try {
    return fromJsep(jsep(preprocessVariables(preprocessTemplates(statement.trim()))) as JsepNode)
  } catch (error) {
    if (error instanceof ExpressionParseError) throw error
    const message = error instanceof Error ? error.message : 'Unknown parser error'
    throw new ExpressionParseError(message)
  }
}

function splitAssignment(statement: string): { name: string; value: string } | null {
  let quote: string | null = null
  let escaped = false
  let parenDepth = 0
  let templateDepth = 0

  for (let index = 0; index < statement.length; index += 1) {
    const char = statement[index]
    const next = statement[index + 1]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (templateDepth > 0) {
      if (char === '`') templateDepth -= 1
      if (char === '$' && next === '{') {
        const end = findTemplateInterpolationEnd(statement, index + 2)
        if (end === -1) throw new ExpressionParseError('Template interpolation is missing a closing brace.')
        index = end
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '`') {
      templateDepth += 1
      continue
    }
    if (char === '(') parenDepth += 1
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1)
    if (char !== '=' || parenDepth !== 0) continue
    if (next === '=' || statement[index - 1] === '=' || statement[index - 1] === '!' || statement[index - 1] === '<' || statement[index - 1] === '>') continue

    const name = statement.slice(0, index).trim()
    const value = statement.slice(index + 1).trim()
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) return null
    if (!value) throw new ExpressionParseError(`Local value "${name}" needs an expression.`)
    return { name, value }
  }

  return null
}

function preprocessVariables(input: string): string {
  let output = ''
  let quote: string | null = null
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]

    if (quote) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      output += char
      continue
    }

    if (char === '$' && next === '(') {
      const end = findVariableReferenceEnd(input, index)
      if (end === -1) throw new ExpressionParseError('Variable reference is missing a closing parenthesis.')
      const name = input.slice(index + 2, end)
      output += `__companionVariable(${JSON.stringify(name)})`
      index = end
      continue
    }

    output += char
  }

  return output
}

function preprocessTemplates(input: string): string {
  let output = ''
  let quote: string | null = null
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (quote) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      output += char
      continue
    }

    if (char === '`') {
      const parsed = parseTemplateLiteral(input, index)
      output += parsed.replacement
      index = parsed.end
      continue
    }

    output += char
  }

  return output
}

function parseTemplateLiteral(input: string, start: number): { replacement: string; end: number } {
  const args: string[] = []
  let text = ''
  let escaped = false

  for (let index = start + 1; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]

    if (escaped) {
      text += char
      escaped = false
      continue
    }

    if (char === '\\') {
      text += char
      escaped = true
      continue
    }

    if (char === '`') {
      args.push(JSON.stringify(text))
      return { replacement: `__companionTemplate(${args.join(', ')})`, end: index }
    }

    if (char === '$' && next === '{') {
      const end = findTemplateInterpolationEnd(input, index + 2)
      if (end === -1) throw new ExpressionParseError('Template interpolation is missing a closing brace.')
      args.push(JSON.stringify(text))
      args.push(preprocessVariables(preprocessTemplates(input.slice(index + 2, end).trim())))
      text = ''
      index = end
      continue
    }

    text += char
  }

  throw new ExpressionParseError('Template string is missing a closing backtick.')
}

function findTemplateInterpolationEnd(input: string, start: number): number {
  let depth = 1
  let quote: string | null = null
  let escaped = false

  for (let index = start; index < input.length; index += 1) {
    const char = input[index]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

function findVariableReferenceEnd(input: string, start: number): number {
  let depth = 0
  for (let index = start; index < input.length; index += 1) {
    if (input[index] === '$' && input[index + 1] === '(') {
      depth += 1
      index += 1
      continue
    }

    if (input[index] === ')') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

function splitStatements(input: string): string[] {
  const statements: string[] = []
  let start = 0
  let quote: string | null = null
  let escaped = false
  let parenDepth = 0
  let braceDepth = 0
  let templateDepth = 0

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (templateDepth > 0) {
      if (char === '`') templateDepth -= 1
      if (char === '$' && next === '{') {
        const end = findTemplateInterpolationEnd(input, index + 2)
        if (end === -1) throw new ExpressionParseError('Template interpolation is missing a closing brace.')
        index = end
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '`') {
      templateDepth += 1
      continue
    }
    if (char === '(') parenDepth += 1
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1)
    if (char === '{') braceDepth += 1
    if (char === '}') braceDepth = Math.max(0, braceDepth - 1)
    if ((char === ';' || isStatementNewline(input, index)) && parenDepth === 0 && braceDepth === 0) {
      statements.push(input.slice(start, index))
      start = index + 1
    }
  }

  statements.push(input.slice(start))
  return statements
}

function isStatementNewline(input: string, index: number): boolean {
  if (input[index] !== '\n') return false

  const before = input.slice(0, index).trimEnd()
  const after = input.slice(index + 1).trimStart()
  if (!before || !after) return false

  const previous = before[before.length - 1]
  const next = after[0]
  if ('?::,+-*/%&|^('.includes(previous)) return false
  if ('?:,)]}'.includes(next)) return false
  return true
}

function fromJsep(node: JsepNode): ExpressionNode {
  switch (node.type) {
    case 'Literal':
      return { type: 'Literal', value: node.value as string | number | boolean | null }
    case 'Identifier':
      if (node.name === 'true') return { type: 'Literal', value: true }
      if (node.name === 'false') return { type: 'Literal', value: false }
      if (node.name === 'null') return { type: 'Literal', value: null }
      return { type: 'LocalReference', name: String(node.name) }
    case 'BinaryExpression':
    case 'LogicalExpression':
      return fromBinary(node)
    case 'UnaryExpression':
      return fromUnary(node)
    case 'ConditionalExpression':
      return {
        type: 'Ternary',
        condition: fromJsep(node.test as JsepNode),
        whenTrue: fromJsep(node.consequent as JsepNode),
        whenFalse: fromJsep(node.alternate as JsepNode),
      }
    case 'CallExpression':
      return fromCall(node)
    case 'MemberExpression':
      return fromMember(node)
    default:
      throw new ExpressionParseError(`Unsupported expression shape "${node.type}".`)
  }
}

function fromBinary(node: JsepNode): ExpressionNode {
  const operator = node.operator as BinaryOperator
  if (!binaryOperators.includes(operator)) {
    throw new ExpressionParseError(`Unsupported operator "${String(node.operator)}".`)
  }
  return {
    type: 'BinaryExpression',
    operator,
    left: fromJsep(node.left as JsepNode),
    right: fromJsep(node.right as JsepNode),
  }
}

function fromUnary(node: JsepNode): ExpressionNode {
  const operator = node.operator as UnaryOperator
  if (!unaryOperators.includes(operator)) {
    throw new ExpressionParseError(`Unsupported unary operator "${String(node.operator)}".`)
  }
  return {
    type: 'UnaryExpression',
    operator,
    argument: fromJsep(node.argument as JsepNode),
  }
}

function fromCall(node: JsepNode): ExpressionNode {
  const callee = node.callee as JsepNode
  const name = callee.type === 'Identifier' ? String(callee.name) : ''
  const args = (node.arguments as JsepNode[]).map((arg) => fromJsep(arg))

  if (name === '__companionVariable') {
    const [arg] = args
    if (!arg || arg.type !== 'Literal' || typeof arg.value !== 'string') {
      throw new ExpressionParseError('Variable references must contain a variable name.')
    }
    return { type: 'Variable', name: arg.value }
  }

  if (name === '__companionTemplate') {
    return fromTemplateCall(args)
  }

  if (name === 'parseVariables') {
    return fromParseVariablesCall(args)
  }

  const definition = findFunctionDefinition(name)
  if (!definition) {
    throw new ExpressionParseError(`Unsupported function "${name || 'anonymous'}".`)
  }

  if (args.length < definition.minArgs || (definition.maxArgs !== null && args.length > definition.maxArgs)) {
    throw new ExpressionParseError(
      `${definition.label} requires ${formatArgCount(definition.minArgs, definition.maxArgs)}.`,
    )
  }

  return {
    type: 'FunctionCall',
    name: definition.name,
    args,
  }
}

function fromMember(node: JsepNode): ExpressionNode {
  if (node.computed !== true) {
    throw new ExpressionParseError('Only bracket index access like split("a,b", ",")[0] is supported.')
  }

  return {
    type: 'IndexAccess',
    object: fromJsep(node.object as JsepNode),
    index: fromJsep(node.property as JsepNode),
  }
}

function fromTemplateCall(args: ExpressionNode[]): ExpressionNode {
  if (args.length === 0) return { type: 'TemplateString', parts: [''] }
  return {
    type: 'TemplateString',
    parts: args.map((arg, index) => {
      if (index % 2 === 0) {
        if (arg.type !== 'Literal' || typeof arg.value !== 'string') {
          throw new ExpressionParseError('Template string text parts must be strings.')
        }
        return arg.value
      }
      return arg
    }),
  }
}

function fromParseVariablesCall(args: ExpressionNode[]): ExpressionNode {
  const [arg] = args
  if (!arg || arg.type !== 'Literal' || typeof arg.value !== 'string') {
    throw new ExpressionParseError('parseVariables can only import as a native variable block when its first argument is a string variable reference.')
  }

  const variableName = unwrapVariableReference(arg.value)
  if (!variableName) {
    throw new ExpressionParseError('parseVariables can only import as a native variable block for a single variable reference.')
  }

  return { type: 'Variable', name: variableName }
}

function unwrapVariableReference(value: string): string | null {
  if (!value.startsWith('$(')) return null
  const end = findVariableReferenceEnd(value, 0)
  if (end !== value.length - 1) return null
  return value.slice(2, -1)
}

function formatArgCount(minArgs: number, maxArgs: number | null): string {
  if (maxArgs === null) return `at least ${minArgs} argument${minArgs === 1 ? '' : 's'}`
  if (minArgs === maxArgs) return `${minArgs} argument${minArgs === 1 ? '' : 's'}`
  return `${minArgs} to ${maxArgs} arguments`
}

function configureJsep(): void {
  jsep.addBinaryOp('**', 11, true)
  jsep.addBinaryOp('<<', 8)
  jsep.addBinaryOp('>>', 8)
  jsep.addBinaryOp('&', 5)
  jsep.addBinaryOp('^', 4)
  jsep.addBinaryOp('|', 3)
}
