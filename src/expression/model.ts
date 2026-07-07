export type ExpressionNode =
  | VariableNode
  | LocalReferenceNode
  | LiteralNode
  | TemplateStringNode
  | TernaryNode
  | FunctionCallNode
  | IndexAccessNode
  | BinaryExpressionNode
  | UnaryExpressionNode

export type StatementNode = ExpressionNode | AssignmentNode

export interface ProgramNode {
  type: 'Program'
  statements: StatementNode[]
}

export interface VariableNode {
  type: 'Variable'
  name: string
}

export interface LocalReferenceNode {
  type: 'LocalReference'
  name: string
}

export interface AssignmentNode {
  type: 'Assignment'
  name: string
  value: ExpressionNode
}

export interface LiteralNode {
  type: 'Literal'
  value: string | number | boolean | null
}

export interface TemplateStringNode {
  type: 'TemplateString'
  parts: Array<string | ExpressionNode>
}

export interface TernaryNode {
  type: 'Ternary'
  condition: ExpressionNode
  whenTrue: ExpressionNode
  whenFalse: ExpressionNode
}

export interface FunctionCallNode {
  type: 'FunctionCall'
  name: FunctionName
  args: ExpressionNode[]
}

export interface IndexAccessNode {
  type: 'IndexAccess'
  object: ExpressionNode
  index: ExpressionNode
}

export interface BinaryExpressionNode {
  type: 'BinaryExpression'
  operator: BinaryOperator
  left: ExpressionNode
  right: ExpressionNode
}

export interface UnaryExpressionNode {
  type: 'UnaryExpression'
  operator: UnaryOperator
  argument: ExpressionNode
}

export type BinaryOperator =
  | '||'
  | '&&'
  | '|'
  | '^'
  | '&'
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '**'
  | '=='
  | '!='
  | '==='
  | '!=='
  | '>'
  | '>='
  | '<'
  | '<='
  | '>>'
  | '<<'

export type UnaryOperator = '!' | '-' | '+' | '~'

export interface FunctionDefinition {
  name: FunctionName
  label: string
  minArgs: number
  maxArgs: number | null
  argLabels: string[]
  category: 'Numeric' | 'String' | 'Variable' | 'Bool' | 'Time' | 'General'
  variadic?: boolean
}

export const variadicInlineInputLimit = 3

export type FunctionName =
  | 'length'
  | 'round'
  | 'floor'
  | 'ceil'
  | 'abs'
  | 'fromRadix'
  | 'toRadix'
  | 'toFixed'
  | 'isNumber'
  | 'max'
  | 'min'
  | 'randomInt'
  | 'log'
  | 'log10'
  | 'trim'
  | 'strlen'
  | 'substr'
  | 'split'
  | 'jsonparse'
  | 'jsonpath'
  | 'join'
  | 'concat'
  | 'includes'
  | 'indexOf'
  | 'lastIndexOf'
  | 'toUpperCase'
  | 'toLowerCase'
  | 'replaceAll'
  | 'encode'
  | 'decode'
  | 'encodeURI'
  | 'decodeURI'
  | 'encodeURIComponent'
  | 'decodeURIComponent'
  | 'getVariable'
  | 'blink'
  | 'bool'
  | 'unixNow'
  | 'timestampToSeconds'
  | 'secondsToTimestamp'
  | 'msToTimestamp'
  | 'timeOffset'
  | 'timeDiff'

export const binaryOperators: BinaryOperator[] = [
  '||',
  '&&',
  '|',
  '^',
  '&',
  '+',
  '-',
  '*',
  '/',
  '%',
  '**',
  '==',
  '!=',
  '===',
  '!==',
  '>',
  '>=',
  '<',
  '<=',
  '>>',
  '<<',
]

export const unaryOperators: UnaryOperator[] = ['!', '-', '+', '~']

export const functionDefinitions: FunctionDefinition[] = [
  { name: 'length', label: 'length', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'General' },
  { name: 'round', label: 'round', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'Numeric' },
  { name: 'floor', label: 'floor', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'Numeric' },
  { name: 'ceil', label: 'ceil', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'Numeric' },
  { name: 'abs', label: 'abs', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'Numeric' },
  { name: 'fromRadix', label: 'fromRadix', minArgs: 2, maxArgs: 2, argLabels: ['value', 'radix'], category: 'Numeric' },
  { name: 'toRadix', label: 'toRadix', minArgs: 2, maxArgs: 2, argLabels: ['value', 'radix'], category: 'Numeric' },
  { name: 'toFixed', label: 'toFixed', minArgs: 2, maxArgs: 2, argLabels: ['value', 'digits'], category: 'Numeric' },
  { name: 'isNumber', label: 'isNumber', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'Numeric' },
  { name: 'max', label: 'max', minArgs: 2, maxArgs: null, argLabels: ['value', 'value 2'], category: 'Numeric', variadic: true },
  { name: 'min', label: 'min', minArgs: 2, maxArgs: null, argLabels: ['value', 'value 2'], category: 'Numeric', variadic: true },
  { name: 'randomInt', label: 'randomInt', minArgs: 2, maxArgs: 2, argLabels: ['min', 'max'], category: 'Numeric' },
  { name: 'log', label: 'log', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'Numeric' },
  { name: 'log10', label: 'log10', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'Numeric' },
  { name: 'trim', label: 'trim', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'String' },
  { name: 'strlen', label: 'strlen', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'String' },
  { name: 'substr', label: 'substr', minArgs: 2, maxArgs: 3, argLabels: ['value', 'start', 'end'], category: 'String' },
  { name: 'split', label: 'split', minArgs: 2, maxArgs: 2, argLabels: ['string', 'separator'], category: 'String' },
  { name: 'jsonparse', label: 'jsonparse', minArgs: 1, maxArgs: 1, argLabels: ['json'], category: 'String' },
  { name: 'jsonpath', label: 'jsonpath', minArgs: 2, maxArgs: 2, argLabels: ['json', 'path'], category: 'String' },
  { name: 'join', label: 'join', minArgs: 2, maxArgs: 2, argLabels: ['array', 'separator'], category: 'String' },
  { name: 'concat', label: 'concat', minArgs: 1, maxArgs: null, argLabels: ['value'], category: 'String', variadic: true },
  { name: 'includes', label: 'includes', minArgs: 2, maxArgs: 2, argLabels: ['value', 'find'], category: 'String' },
  { name: 'indexOf', label: 'indexOf', minArgs: 2, maxArgs: 3, argLabels: ['value', 'find', 'offset'], category: 'String' },
  { name: 'lastIndexOf', label: 'lastIndexOf', minArgs: 2, maxArgs: 3, argLabels: ['value', 'find', 'offset'], category: 'String' },
  { name: 'toUpperCase', label: 'toUpperCase', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'String' },
  { name: 'toLowerCase', label: 'toLowerCase', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'String' },
  { name: 'replaceAll', label: 'replaceAll', minArgs: 3, maxArgs: 3, argLabels: ['value', 'find', 'replace'], category: 'String' },
  { name: 'encode', label: 'encode', minArgs: 1, maxArgs: 2, argLabels: ['string', 'encoding'], category: 'String' },
  { name: 'decode', label: 'decode', minArgs: 1, maxArgs: 2, argLabels: ['string', 'encoding'], category: 'String' },
  { name: 'encodeURI', label: 'encodeURI', minArgs: 1, maxArgs: 1, argLabels: ['string'], category: 'String' },
  { name: 'decodeURI', label: 'decodeURI', minArgs: 1, maxArgs: 1, argLabels: ['string'], category: 'String' },
  { name: 'encodeURIComponent', label: 'encodeURIComponent', minArgs: 1, maxArgs: 1, argLabels: ['string'], category: 'String' },
  { name: 'decodeURIComponent', label: 'decodeURIComponent', minArgs: 1, maxArgs: 1, argLabels: ['string'], category: 'String' },
  { name: 'getVariable', label: 'getVariable', minArgs: 1, maxArgs: 2, argLabels: ['variable', 'name'], category: 'Variable' },
  { name: 'blink', label: 'blink', minArgs: 1, maxArgs: 2, argLabels: ['cycle ms', 'on portion'], category: 'Variable' },
  { name: 'bool', label: 'bool', minArgs: 1, maxArgs: 1, argLabels: ['value'], category: 'Bool' },
  { name: 'unixNow', label: 'unixNow', minArgs: 0, maxArgs: 0, argLabels: [], category: 'Time' },
  { name: 'timestampToSeconds', label: 'timestampToSeconds', minArgs: 1, maxArgs: 1, argLabels: ['timestamp'], category: 'Time' },
  { name: 'secondsToTimestamp', label: 'secondsToTimestamp', minArgs: 1, maxArgs: 2, argLabels: ['seconds', 'format'], category: 'Time' },
  { name: 'msToTimestamp', label: 'msToTimestamp', minArgs: 1, maxArgs: 2, argLabels: ['milliseconds', 'format'], category: 'Time' },
  { name: 'timeOffset', label: 'timeOffset', minArgs: 2, maxArgs: 3, argLabels: ['timestamp', 'offset', '12 hour'], category: 'Time' },
  { name: 'timeDiff', label: 'timeDiff', minArgs: 2, maxArgs: 2, argLabels: ['from', 'to'], category: 'Time' },
]

export const functionNames = functionDefinitions.map((definition) => definition.name)

export function findFunctionDefinition(name: string): FunctionDefinition | undefined {
  return functionDefinitions.find((definition) => definition.name === name)
}
