export type ExpressionNode =
  | VariableNode
  | LocalReferenceNode
  | LiteralNode
  | TemplateStringNode
  | TernaryNode
  | FunctionCallNode
  | IndexAccessNode
  | PropertyAccessNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | ArrayNode
  | ObjectNode
  | SpreadNode
  | ArrowFunctionNode
  | UpdateExpressionNode

export type StatementNode =
  | ExpressionNode
  | AssignmentNode
  | DeclarationNode
  | IfStatementNode
  | WhileStatementNode
  | ForStatementNode
  | ForOfStatementNode
  | ReturnStatementNode
  | BreakStatementNode
  | ContinueStatementNode

export interface ProgramNode { type: 'Program'; statements: StatementNode[] }
export interface VariableNode { type: 'Variable'; name: string }
export interface LocalReferenceNode { type: 'LocalReference'; name: string }
export interface AssignmentNode { type: 'Assignment'; name?: string; target?: PropertyAccessNode | IndexAccessNode; value: ExpressionNode }
export interface DeclarationNode { type: 'Declaration'; kind: 'let' | 'const'; name: string; value?: ExpressionNode }
export interface ReturnStatementNode { type: 'Return'; value?: ExpressionNode }
export interface BreakStatementNode { type: 'Break' }
export interface ContinueStatementNode { type: 'Continue' }
export interface IfStatementNode { type: 'IfStatement'; condition: ExpressionNode; consequent: StatementNode[]; alternate?: StatementNode[] }
export interface WhileStatementNode { type: 'WhileStatement'; condition: ExpressionNode; body: StatementNode[] }
export interface ForStatementNode { type: 'ForStatement'; init?: StatementNode; test?: ExpressionNode; update?: ExpressionNode; body: StatementNode[] }
export interface ForOfStatementNode { type: 'ForOfStatement'; kind: 'let' | 'const'; name: string; iterable: ExpressionNode; body: StatementNode[] }
export interface LiteralNode { type: 'Literal'; value: string | number | boolean | null | undefined }
export interface TemplateStringNode { type: 'TemplateString'; parts: Array<string | ExpressionNode> }
export interface TernaryNode { type: 'Ternary'; condition: ExpressionNode; whenTrue: ExpressionNode; whenFalse: ExpressionNode }
export interface FunctionCallNode { type: 'FunctionCall'; name: string; args: ExpressionNode[] }
export interface IndexAccessNode { type: 'IndexAccess'; object: ExpressionNode; index: ExpressionNode; optional?: boolean }
export interface PropertyAccessNode { type: 'PropertyAccess'; object: ExpressionNode; property: string; optional?: boolean }
export interface BinaryExpressionNode { type: 'BinaryExpression'; operator: BinaryOperator; left: ExpressionNode; right: ExpressionNode }
export interface UnaryExpressionNode { type: 'UnaryExpression'; operator: UnaryOperator; argument: ExpressionNode }
export interface ArrayNode { type: 'Array'; elements: ExpressionNode[] }
export interface ObjectNode { type: 'Object'; properties: Array<{ key: string; value: ExpressionNode }> }
export interface SpreadNode { type: 'Spread'; argument: ExpressionNode }
export interface ArrowFunctionNode { type: 'ArrowFunction'; params: string[]; body: ExpressionNode | StatementNode[] }
export interface UpdateExpressionNode { type: 'UpdateExpression'; operator: '++' | '--'; argument: LocalReferenceNode; prefix: boolean }

export type BinaryOperator = '||' | '??' | '&&' | '|' | '^' | '&' | '+' | '-' | '*' | '/' | '%' | '**' | '==' | '!=' | '===' | '!==' | '>' | '>=' | '<' | '<=' | '>>' | '<<'
export type UnaryOperator = '!' | '-' | '+' | '~' | 'typeof'

export interface FunctionDefinition {
  name: FunctionName
  label: string
  minArgs: number
  maxArgs: number | null
  argLabels: string[]
  category: 'Numeric' | 'String' | 'Variable' | 'Bool' | 'Time' | 'General' | 'Collections'
  variadic?: boolean
}

export const variadicInlineInputLimit = 3

export type FunctionName =
  | 'length' | 'round' | 'floor' | 'ceil' | 'abs' | 'fromRadix' | 'toRadix' | 'toFixed' | 'isNumber' | 'max' | 'min' | 'randomInt' | 'log' | 'log10' | 'exp' | 'sqrt' | 'pow' | 'stringCompare'
  | 'trim' | 'strlen' | 'substr' | 'split' | 'jsonparse' | 'jsonpath' | 'join' | 'concat' | 'includes' | 'indexOf' | 'lastIndexOf' | 'toUpperCase' | 'toLowerCase' | 'replaceAll' | 'encode' | 'decode' | 'encodeURI' | 'decodeURI' | 'encodeURIComponent' | 'decodeURIComponent'
  | 'parseVariables' | 'getVariable' | 'blink' | 'bool' | 'unixNow' | 'timestampToSeconds' | 'secondsToTimestamp' | 'msToTimestamp' | 'timeOffset' | 'timeDiff'
  | 'jsonstringify' | 'arrayIncludes' | 'arrayIndexOf' | 'arrayLastIndexOf' | 'arraySlice' | 'arrayConcat' | 'arrayFlat'
  | 'arrayMap' | 'arrayFilter' | 'arrayReduce' | 'arrayForEach' | 'arrayFind' | 'arrayFindIndex' | 'arraySome' | 'arrayEvery' | 'arraySort' | 'arrayReverse' | 'objectKeys' | 'objectValues'
  | 'parseDate' | 'dateYear' | 'dateMonth' | 'dateDay' | 'dateHour' | 'dateMinute' | 'dateSecond' | 'dateWeekday' | 'dateFormat' | 'dateAdd'

export const binaryOperators: BinaryOperator[] = ['||', '??', '&&', '|', '^', '&', '+', '-', '*', '/', '%', '**', '==', '!=', '===', '!==', '>', '>=', '<', '<=', '>>', '<<']
export const unaryOperators: UnaryOperator[] = ['!', '-', '+', '~', 'typeof']

const basic = (name: FunctionName, category: FunctionDefinition['category'], minArgs: number, maxArgs: number | null, argLabels: string[], variadic = false): FunctionDefinition => ({ name, label: name, minArgs, maxArgs, argLabels, category, variadic })

export const functionDefinitions: FunctionDefinition[] = [
  basic('length', 'General', 1, 1, ['value']),
  basic('round', 'Numeric', 1, 1, ['value']), basic('floor', 'Numeric', 1, 1, ['value']), basic('ceil', 'Numeric', 1, 1, ['value']), basic('abs', 'Numeric', 1, 1, ['value']),
  basic('fromRadix', 'Numeric', 2, 2, ['value', 'radix']), basic('toRadix', 'Numeric', 2, 2, ['value', 'radix']), basic('toFixed', 'Numeric', 2, 2, ['value', 'digits']), basic('isNumber', 'Numeric', 1, 1, ['value']), basic('max', 'Numeric', 2, null, ['value', 'value 2'], true), basic('min', 'Numeric', 2, null, ['value', 'value 2'], true), basic('randomInt', 'Numeric', 2, 2, ['min', 'max']), basic('log', 'Numeric', 1, 2, ['value', 'base']), basic('log10', 'Numeric', 1, 1, ['value']), basic('exp', 'Numeric', 1, 1, ['value']), basic('sqrt', 'Numeric', 1, 1, ['value']), basic('pow', 'Numeric', 2, 2, ['base', 'exponent']), basic('stringCompare', 'String', 2, 2, ['a', 'b']),
  basic('trim', 'String', 1, 1, ['value']), basic('strlen', 'String', 1, 1, ['value']), basic('substr', 'String', 2, 3, ['value', 'start', 'end']), basic('split', 'String', 2, 2, ['string', 'separator']), basic('jsonparse', 'String', 1, 1, ['json']), basic('jsonpath', 'String', 2, 2, ['json', 'path']), basic('join', 'String', 2, 2, ['array', 'separator']), basic('concat', 'String', 1, null, ['value'], true), basic('includes', 'String', 2, 2, ['value', 'find']), basic('indexOf', 'String', 2, 3, ['value', 'find', 'offset']), basic('lastIndexOf', 'String', 2, 3, ['value', 'find', 'offset']), basic('toUpperCase', 'String', 1, 1, ['value']), basic('toLowerCase', 'String', 1, 1, ['value']), basic('replaceAll', 'String', 3, 3, ['value', 'find', 'replace']), basic('encode', 'String', 1, 2, ['string', 'encoding']), basic('decode', 'String', 1, 2, ['string', 'encoding']), basic('encodeURI', 'String', 1, 1, ['string']), basic('decodeURI', 'String', 1, 1, ['string']), basic('encodeURIComponent', 'String', 1, 1, ['string']), basic('decodeURIComponent', 'String', 1, 1, ['string']),
  basic('parseVariables', 'Variable', 1, 2, ['string', 'undefined value']), basic('getVariable', 'Variable', 1, 2, ['variable', 'name']), basic('blink', 'Variable', 1, 2, ['cycle ms', 'on portion']), basic('bool', 'Bool', 1, 1, ['value']),
  basic('unixNow', 'Time', 0, 0, []), basic('timestampToSeconds', 'Time', 1, 1, ['timestamp']), basic('secondsToTimestamp', 'Time', 1, 2, ['seconds', 'format']), basic('msToTimestamp', 'Time', 1, 2, ['milliseconds', 'format']), basic('timeOffset', 'Time', 2, 3, ['timestamp', 'offset', '12 hour']), basic('timeDiff', 'Time', 2, 2, ['from', 'to']),
  basic('jsonstringify', 'Collections', 1, 1, ['object']), basic('arrayIncludes', 'Collections', 2, 2, ['array', 'value']), basic('arrayIndexOf', 'Collections', 2, 3, ['array', 'value', 'offset']), basic('arrayLastIndexOf', 'Collections', 2, 3, ['array', 'value', 'offset']), basic('arraySlice', 'Collections', 1, 3, ['array', 'start', 'end']), basic('arrayConcat', 'Collections', 1, null, ['array'], true), basic('arrayFlat', 'Collections', 1, 1, ['array']),
  basic('arrayMap', 'Collections', 2, 2, ['array', 'callback']), basic('arrayFilter', 'Collections', 2, 2, ['array', 'callback']), basic('arrayReduce', 'Collections', 2, 3, ['array', 'callback', 'initial value']), basic('arrayForEach', 'Collections', 2, 2, ['array', 'callback']), basic('arrayFind', 'Collections', 2, 2, ['array', 'callback']), basic('arrayFindIndex', 'Collections', 2, 2, ['array', 'callback']), basic('arraySome', 'Collections', 2, 2, ['array', 'callback']), basic('arrayEvery', 'Collections', 2, 2, ['array', 'callback']), basic('arraySort', 'Collections', 1, 2, ['array', 'comparator']), basic('arrayReverse', 'Collections', 1, 1, ['array']), basic('objectKeys', 'Collections', 1, 1, ['object']), basic('objectValues', 'Collections', 1, 1, ['object']),
  basic('parseDate', 'Time', 1, 1, ['value']), basic('dateYear', 'Time', 1, 2, ['value', 'timezone']), basic('dateMonth', 'Time', 1, 2, ['value', 'timezone']), basic('dateDay', 'Time', 1, 2, ['value', 'timezone']), basic('dateHour', 'Time', 1, 2, ['value', 'timezone']), basic('dateMinute', 'Time', 1, 2, ['value', 'timezone']), basic('dateSecond', 'Time', 1, 2, ['value', 'timezone']), basic('dateWeekday', 'Time', 1, 2, ['value', 'timezone']), basic('dateFormat', 'Time', 2, 3, ['value', 'format', 'timezone']), basic('dateAdd', 'Time', 3, 3, ['value', 'amount', 'unit']),
]

export const functionNames = functionDefinitions.map((definition) => definition.name)
export function findFunctionDefinition(name: string): FunctionDefinition | undefined { return functionDefinitions.find((definition) => definition.name === name) }
