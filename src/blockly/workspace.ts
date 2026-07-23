import * as Blockly from 'blockly/core'
import type { BinaryOperator, ExpressionNode, FunctionName, ProgramNode, StatementNode, TemplateStringNode, UnaryOperator } from '../expression/model'
import { findFunctionDefinition, functionDefinitions } from '../expression/model'
import { expressionCheck, functionBlockType } from './blocks'
import { escapeStringField, unescapeStringField } from './stringField'

const defaultLiteral: ExpressionNode = { type: 'Literal', value: '' }
const logicWarningId = 'companion-logic'

export function workspaceToProgram(workspace: Blockly.Workspace): ProgramNode {
  const programBlock =
    workspace.getTopBlocks(false).find((block) => block.type === 'companion_program') ??
    workspace.getTopBlocks(false).find((block) => block.previousConnection !== null)

  if (!programBlock) return { type: 'Program', statements: [defaultLiteral] }

  if (programBlock.type !== 'companion_program') {
    return { type: 'Program', statements: collectStatements(programBlock) }
  }

  const firstStatement = programBlock.getInputTargetBlock('STATEMENTS')
  return {
    type: 'Program',
    statements: firstStatement ? collectStatements(firstStatement) : [defaultLiteral],
  }
}

export function loadProgramIntoWorkspace(workspace: Blockly.WorkspaceSvg, program: ProgramNode): void {
  Blockly.Events.disable()
  try {
    workspace.clear()
    if (!isBlocklyRepresentable(program)) throw new Error('This Companion 5.0 construct does not have a visual block yet.')
    const programBlock = workspace.newBlock('companion_program')
    programBlock.initSvg()
    programBlock.render()

    let previous: Blockly.Block | null = null
    program.statements.forEach((statement, index) => {
      const statementBlock = statementToBlock(workspace, statement, index === program.statements.length - 1)
      statementBlock.render()

      if (previous) {
        if (!previous.nextConnection || !statementBlock.previousConnection) {
          throw new Error('Cannot connect adjacent statement blocks.')
        }
        previous.nextConnection.connect(statementBlock.previousConnection)
      } else {
        const statementsConnection = programBlock.getInput('STATEMENTS')?.connection
        if (!statementsConnection || !statementBlock.previousConnection) {
          throw new Error('Cannot connect program statement block.')
        }
        statementsConnection.connect(statementBlock.previousConnection)
      }
      previous = statementBlock
    })
  } finally {
    Blockly.Events.enable()
  }
}

function isBlocklyRepresentable(program: ProgramNode): boolean {
  const supported = new Set(['Program', 'Assignment', 'Declaration', 'IfStatement', 'WhileStatement', 'ForStatement', 'ForOfStatement', 'Return', 'Break', 'Continue', 'Variable', 'LocalReference', 'Literal', 'TemplateString', 'Ternary', 'FunctionCall', 'IndexAccess', 'PropertyAccess', 'BinaryExpression', 'UnaryExpression', 'UpdateExpression', 'ArrowFunction', 'Array', 'Object', 'Spread'])
  const visit = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return true
    const node = value as { type?: unknown }
    if (typeof node.type === 'string' && !supported.has(node.type)) return false
    if (node.type === 'ForStatement' && !asCountingLoop(node as Extract<StatementNode, { type: 'ForStatement' }>)) return false
    if (node.type === 'Array' && Array.isArray((node as { elements?: unknown[] }).elements) && (node as { elements: unknown[] }).elements.length > 6) return false
    if (node.type === 'Object' && Array.isArray((node as { properties?: unknown[] }).properties) && (node as { properties: unknown[] }).properties.length > 4) return false
    return Object.values(value).every(visit)
  }
  return visit(program)
}

export function ensureDefaultWorkspace(workspace: Blockly.WorkspaceSvg): void {
  if (workspace.getAllBlocks(false).length === 0) {
    loadProgramIntoWorkspace(workspace, {
      type: 'Program',
      statements: [{ type: 'Variable', name: 'internal:time_hms' }],
    })
  }
}

export function updateBlockWarnings(workspace: Blockly.Workspace): number {
  let warningCount = 0
  workspace.getAllBlocks(false).forEach((block) => {
    const warning = block.type === 'companion_binary' ? getBinaryLogicWarning(block) : null
    block.setWarningText(warning, logicWarningId)
    if (warning) warningCount += 1
  })
  return warningCount
}

function collectStatements(first: Blockly.Block): StatementNode[] {
  const statements: StatementNode[] = []
  let current: Blockly.Block | null = first
  while (current) {
    if (current.type === 'companion_assignment') {
      statements.push({
        type: 'Assignment',
        name: String(current.getFieldValue('NAME') ?? ''),
        value: childExpression(current, 'VALUE'),
      })
    } else if (current.type === 'companion_member_assignment') {
      const target = childExpression(current, 'TARGET')
      if (target.type === 'PropertyAccess' || target.type === 'IndexAccess') statements.push({ type: 'Assignment', target, value: childExpression(current, 'VALUE') })
    } else if (current.type === 'companion_declaration') {
      statements.push({ type: 'Declaration', kind: String(current.getFieldValue('KIND')) === 'const' ? 'const' : 'let', name: String(current.getFieldValue('NAME') ?? ''), value: current.getInputTargetBlock('VALUE') ? childExpression(current, 'VALUE') : undefined })
    } else if (current.type === 'companion_if_control') {
      const alternate = collectInputStatements(current, 'ELSE')
      statements.push({ type: 'IfStatement', condition: childExpression(current, 'CONDITION'), consequent: collectInputStatements(current, 'THEN'), ...(alternate.length ? { alternate } : {}) })
    } else if (current.type === 'companion_while_control') {
      statements.push({ type: 'WhileStatement', condition: childExpression(current, 'CONDITION'), body: collectInputStatements(current, 'BODY') })
    } else if (current.type === 'companion_for_of_control') {
      statements.push({ type: 'ForOfStatement', kind: String(current.getFieldValue('KIND')) === 'const' ? 'const' : 'let', name: String(current.getFieldValue('NAME') ?? ''), iterable: childExpression(current, 'ITERABLE'), body: collectInputStatements(current, 'BODY') })
    } else if (current.type === 'companion_for_control') {
      const name = String(current.getFieldValue('NAME') ?? 'index')
      statements.push({ type: 'ForStatement', init: { type: 'Declaration', kind: String(current.getFieldValue('KIND')) === 'const' ? 'const' : 'let', name, value: childExpression(current, 'START') }, test: { type: 'BinaryExpression', operator: String(current.getFieldValue('OP') ?? '<') as BinaryOperator, left: { type: 'LocalReference', name }, right: childExpression(current, 'END') }, update: { type: 'UpdateExpression', operator: String(current.getFieldValue('UPDATE') ?? '++') as '++' | '--', argument: { type: 'LocalReference', name }, prefix: false }, body: collectInputStatements(current, 'BODY') })
    } else if (current.type === 'companion_return') {
      statements.push({ type: 'Return', value: current.getInputTargetBlock('VALUE') ? childExpression(current, 'VALUE') : undefined })
    } else if (current.type === 'companion_break') {
      statements.push({ type: 'Break' })
    } else if (current.type === 'companion_continue') {
      statements.push({ type: 'Continue' })
    } else if (current.type === 'companion_expression_statement' || current.type === 'companion_statement') {
      const value = current.getInputTargetBlock('VALUE')
      statements.push(value ? blockToExpression(value) : defaultLiteral)
    }
    current = current.getNextBlock()
  }
  return statements.length > 0 ? statements : [defaultLiteral]
}

function collectInputStatements(block: Blockly.Block, input: string): StatementNode[] {
  const first = block.getInputTargetBlock(input)
  return first ? collectStatements(first) : []
}

function blockToExpression(block: Blockly.Block): ExpressionNode {
  switch (block.type) {
    case 'companion_variable':
      return { type: 'Variable', name: String(block.getFieldValue('NAME') ?? '') }
    case 'companion_local_reference':
      return { type: 'LocalReference', name: String(block.getFieldValue('NAME') ?? '') }
    case 'companion_arrow_expression':
      return { type: 'ArrowFunction', params: parseParameters(block), body: childExpression(block, 'VALUE') }
    case 'companion_arrow_block':
      return { type: 'ArrowFunction', params: parseParameters(block), body: collectInputStatements(block, 'BODY') }
    case 'companion_spread':
      return { type: 'Spread', argument: childExpression(block, 'VALUE') }
    case 'companion_array':
      return { type: 'Array', elements: [0, 1, 2, 3, 4, 5].flatMap((index) => { const child = block.getInputTargetBlock(`ITEM${index}`); return child ? [blockToExpression(child)] : [] }) }
    case 'companion_object':
      return { type: 'Object', properties: [0, 1, 2, 3].flatMap((index) => { const child = block.getInputTargetBlock(`VALUE${index}`); const key = String(block.getFieldValue(`KEY${index}`) ?? ''); return child && key ? [{ key, value: blockToExpression(child) }] : [] }) }
    case 'companion_string':
      return { type: 'Literal', value: unescapeStringField(String(block.getFieldValue('VALUE') ?? '')) }
    case 'companion_template_string':
      return blockToTemplateString(block)
    case 'companion_number':
      return { type: 'Literal', value: Number(block.getFieldValue('VALUE') ?? 0) }
    case 'companion_boolean':
      return { type: 'Literal', value: block.getFieldValue('VALUE') === 'true' }
    case 'companion_null':
      return { type: 'Literal', value: null }
    case 'companion_undefined':
      return { type: 'Literal', value: undefined }
    case 'companion_ternary':
      return {
        type: 'Ternary',
        condition: childExpression(block, 'CONDITION'),
        whenTrue: childExpression(block, 'TRUE'),
        whenFalse: childExpression(block, 'FALSE'),
      }
    case 'companion_unary':
      return {
        type: 'UnaryExpression',
        operator: String(block.getFieldValue('OP')) as UnaryOperator,
        argument: childExpression(block, 'ARG'),
      }
    case 'companion_binary':
      return {
        type: 'BinaryExpression',
        operator: String(block.getFieldValue('OP')) as BinaryOperator,
        left: childExpression(block, 'LEFT'),
        right: childExpression(block, 'RIGHT'),
      }
    case 'companion_index_access':
      return {
        type: 'IndexAccess',
        object: childExpression(block, 'OBJECT'),
        index: childExpression(block, 'INDEX'),
        ...(block.getFieldValue('OPTIONAL') === 'true' ? { optional: true } : {}),
      }
    case 'companion_property_access':
      return { type: 'PropertyAccess', object: childExpression(block, 'OBJECT'), property: String(block.getFieldValue('PROPERTY') ?? ''), ...(block.getFieldValue('OPTIONAL') === 'true' ? { optional: true } : {}) }
    case 'companion_function_custom':
      return { type: 'FunctionCall', name: String(block.getFieldValue('NAME') ?? ''), args: block.inputList.filter((input) => input.name.startsWith('ARG')).flatMap((input) => { const child = block.getInputTargetBlock(input.name); return child ? [blockToExpression(child)] : [] }) }
    default:
      if (block.type.startsWith('companion_function_')) return blockToFunctionCall(block)
      return defaultLiteral
  }
}

function blockToFunctionCall(block: Blockly.Block): ExpressionNode {
  const definition = functionDefinitions.find((candidate) => functionBlockType(candidate.name) === block.type)
  if (!definition) return defaultLiteral

  const args: ExpressionNode[] = []
  const inputCount = definition.maxArgs ?? countFunctionInputs(block)
  for (let index = 0; index < inputCount; index += 1) {
    const child = block.getInputTargetBlock(`ARG${index}`)
    if (child) {
      args.push(blockToExpression(child))
    } else if (index < definition.minArgs) {
      args.push(defaultLiteral)
    }
  }

  return {
    type: 'FunctionCall',
    name: definition.name,
    args,
  }
}

function childExpression(block: Blockly.Block, input: string): ExpressionNode {
  const child = block.getInputTargetBlock(input)
  return child ? blockToExpression(child) : defaultLiteral
}

function connectExpression(
  workspace: Blockly.WorkspaceSvg,
  parent: Blockly.Block,
  inputName: string,
  expression: ExpressionNode,
): Blockly.Block {
  const child = expressionToBlock(workspace, expression)
  const input = parent.getInput(inputName)
  if (!input?.connection || !child.outputConnection) {
    throw new Error(`Cannot connect ${child.type} to ${parent.type}.${inputName}`)
  }
  input.connection.connect(child.outputConnection)
  return child
}

function connectStatementList(workspace: Blockly.WorkspaceSvg, parent: Blockly.Block, inputName: string, statements: StatementNode[]): void {
  let previous: Blockly.BlockSvg | null = null
  statements.forEach((statement, index) => {
    const child = statementToBlock(workspace, statement, index === statements.length - 1)
    if (previous?.nextConnection && child.previousConnection) previous.nextConnection.connect(child.previousConnection)
    else if (!previous) {
      const connection = parent.getInput(inputName)?.connection
      if (!connection || !child.previousConnection) throw new Error(`Cannot connect statement to ${parent.type}.${inputName}`)
      connection.connect(child.previousConnection)
    }
    previous = child
  })
}

function statementToBlock(workspace: Blockly.WorkspaceSvg, statement: StatementNode, isLast = true): Blockly.BlockSvg {
  if (statement.type === 'Assignment') {
    const block = workspace.newBlock(statement.target ? 'companion_member_assignment' : 'companion_assignment') as Blockly.BlockSvg
    block.initSvg()
    if (statement.name) block.setFieldValue(statement.name, 'NAME')
    if (statement.target) connectExpression(workspace, block, 'TARGET', statement.target)
    connectExpression(workspace, block, 'VALUE', statement.value)
    return block
  }

  if (statement.type === 'Declaration') {
    const block = workspace.newBlock('companion_declaration') as Blockly.BlockSvg
    block.initSvg()
    block.setFieldValue(statement.kind, 'KIND')
    block.setFieldValue(statement.name, 'NAME')
    if (statement.value) connectExpression(workspace, block, 'VALUE', statement.value)
    return block
  }

  if (statement.type === 'IfStatement') {
    const block = workspace.newBlock('companion_if_control') as Blockly.BlockSvg
    block.initSvg(); connectExpression(workspace, block, 'CONDITION', statement.condition)
    connectStatementList(workspace, block, 'THEN', statement.consequent)
    if (statement.alternate) connectStatementList(workspace, block, 'ELSE', statement.alternate)
    return block
  }

  if (statement.type === 'WhileStatement') {
    const block = workspace.newBlock('companion_while_control') as Blockly.BlockSvg
    block.initSvg(); connectExpression(workspace, block, 'CONDITION', statement.condition); connectStatementList(workspace, block, 'BODY', statement.body)
    return block
  }

  if (statement.type === 'ForOfStatement') {
    const block = workspace.newBlock('companion_for_of_control') as Blockly.BlockSvg
    block.initSvg(); block.setFieldValue(statement.kind, 'KIND'); block.setFieldValue(statement.name, 'NAME'); connectExpression(workspace, block, 'ITERABLE', statement.iterable); connectStatementList(workspace, block, 'BODY', statement.body)
    return block
  }

  if (statement.type === 'ForStatement') {
    const simplified = asCountingLoop(statement)
    if (simplified) {
      const block = workspace.newBlock('companion_for_control') as Blockly.BlockSvg
      block.initSvg(); block.setFieldValue(simplified.kind, 'KIND'); block.setFieldValue(simplified.name, 'NAME'); block.setFieldValue(simplified.operator, 'OP'); block.setFieldValue(simplified.update, 'UPDATE'); connectExpression(workspace, block, 'START', simplified.start); connectExpression(workspace, block, 'END', simplified.end); connectStatementList(workspace, block, 'BODY', statement.body)
      return block
    }
    throw new Error('This for-loop shape is not yet available as blocks.')
  }

  if (statement.type === 'Return') {
    const block = workspace.newBlock('companion_return') as Blockly.BlockSvg
    block.initSvg(); if (statement.value) connectExpression(workspace, block, 'VALUE', statement.value)
    return block
  }
  if (statement.type === 'Break' || statement.type === 'Continue') {
    const block = workspace.newBlock(statement.type === 'Break' ? 'companion_break' : 'companion_continue') as Blockly.BlockSvg
    block.initSvg(); return block
  }

  const block = workspace.newBlock(isLast ? 'companion_statement' : 'companion_expression_statement') as Blockly.BlockSvg
  block.initSvg()
  connectExpression(workspace, block, 'VALUE', statement as ExpressionNode)
  return block
}

function asCountingLoop(statement: Extract<StatementNode, { type: 'ForStatement' }>): { kind: 'let' | 'const'; name: string; start: ExpressionNode; end: ExpressionNode; operator: '<' | '<=' | '>' | '>='; update: '++' | '--' } | null {
  if (statement.init?.type !== 'Declaration' || !statement.init.value || statement.test?.type !== 'BinaryExpression' || !['<', '<=', '>', '>='].includes(statement.test.operator) || statement.test.left.type !== 'LocalReference' || statement.test.left.name !== statement.init.name || statement.update?.type !== 'UpdateExpression' || statement.update.argument.name !== statement.init.name) return null
  return { kind: statement.init.kind, name: statement.init.name, start: statement.init.value, end: statement.test.right, operator: statement.test.operator as '<' | '<=' | '>' | '>=', update: statement.update.operator }
}

function expressionToBlock(workspace: Blockly.WorkspaceSvg, expression: ExpressionNode): Blockly.Block {
  const block = workspace.newBlock(blockTypeForExpression(expression))
  applyExpressionFields(block, expression)
  configureDynamicFunctionShape(block, expression)
  block.initSvg()

  switch (expression.type) {
    case 'Ternary':
      connectExpression(workspace, block, 'CONDITION', expression.condition)
      connectExpression(workspace, block, 'TRUE', expression.whenTrue)
      connectExpression(workspace, block, 'FALSE', expression.whenFalse)
      break
    case 'TemplateString':
      connectTemplateString(workspace, block, expression)
      break
    case 'FunctionCall':
      expression.args.forEach((arg, index) => {
        connectExpression(workspace, block, `ARG${index}`, arg)
      })
      break
    case 'IndexAccess':
      connectExpression(workspace, block, 'OBJECT', expression.object)
      connectExpression(workspace, block, 'INDEX', expression.index)
      break
    case 'PropertyAccess':
      connectExpression(workspace, block, 'OBJECT', expression.object)
      break
    case 'BinaryExpression':
      connectExpression(workspace, block, 'LEFT', expression.left)
      connectExpression(workspace, block, 'RIGHT', expression.right)
      break
    case 'UnaryExpression':
      connectExpression(workspace, block, 'ARG', expression.argument)
      break
    case 'ArrowFunction':
      if (Array.isArray(expression.body)) connectStatementList(workspace, block, 'BODY', expression.body)
      else connectExpression(workspace, block, 'VALUE', expression.body)
      break
    case 'Spread':
      connectExpression(workspace, block, 'VALUE', expression.argument)
      break
    case 'Array':
      expression.elements.forEach((element, index) => { if (index < 6) connectExpression(workspace, block, `ITEM${index}`, element) })
      break
    case 'Object':
      expression.properties.forEach(({ key, value }, index) => { if (index < 4) { block.setFieldValue(key, `KEY${index}`); connectExpression(workspace, block, `VALUE${index}`, value) } })
      break
    default:
      break
  }

  block.render()
  return block
}

function countFunctionInputs(block: Blockly.Block): number {
  return block.inputList.filter((input) => input.name.startsWith('ARG')).length
}

function configureDynamicFunctionShape(block: Blockly.Block, expression: ExpressionNode): void {
  if (expression.type === 'TemplateString') {
    const dynamicBlock = block as Blockly.Block & {
      itemCount_?: number
      updateShape_?: () => void
    }
    dynamicBlock.itemCount_ = Math.max(1, expression.parts.filter((part) => typeof part !== 'string').length + 1)
    dynamicBlock.updateShape_?.()
    return
  }

  if (expression.type !== 'FunctionCall') return
  if (!findFunctionDefinition(expression.name)) {
    const dynamicBlock = block as Blockly.Block & { itemCount_?: number; updateShape_?: () => void }
    dynamicBlock.itemCount_ = Math.max(1, expression.args.length + 1)
    dynamicBlock.updateShape_?.()
    return
  }
  const definition = findFunctionDefinition(expression.name)
  if (!definition?.variadic) return

  const dynamicBlock = block as Blockly.Block & {
    itemCount_?: number
    updateShape_?: () => void
  }
  dynamicBlock.itemCount_ = Math.max(definition.minArgs, expression.args.length + 1)
  dynamicBlock.updateShape_?.()
}

function blockTypeForExpression(expression: ExpressionNode): string {
  if (expression.type === 'Variable') return 'companion_variable'
  if (expression.type === 'LocalReference') return 'companion_local_reference'
  if (expression.type === 'TemplateString') return 'companion_template_string'
  if (expression.type === 'Ternary') return 'companion_ternary'
  if (expression.type === 'BinaryExpression') return 'companion_binary'
  if (expression.type === 'IndexAccess') return 'companion_index_access'
  if (expression.type === 'PropertyAccess') return 'companion_property_access'
  if (expression.type === 'UnaryExpression') return 'companion_unary'
  if (expression.type === 'ArrowFunction') return Array.isArray(expression.body) ? 'companion_arrow_block' : 'companion_arrow_expression'
  if (expression.type === 'Spread') return 'companion_spread'
  if (expression.type === 'Array') return 'companion_array'
  if (expression.type === 'Object') return 'companion_object'
  if (expression.type === 'FunctionCall') {
    return findFunctionDefinition(expression.name) ? functionBlockType(expression.name as FunctionName) : 'companion_function_custom'
  }
  if (expression.type === 'Literal') {
    if (typeof expression.value === 'string') return 'companion_string'
    if (typeof expression.value === 'number') return 'companion_number'
    if (typeof expression.value === 'boolean') return 'companion_boolean'
    if (expression.value === undefined) return 'companion_undefined'
    return 'companion_null'
  }
  return 'companion_null'
}

function applyExpressionFields(block: Blockly.Block, expression: ExpressionNode): void {
  switch (expression.type) {
    case 'Variable':
      block.setFieldValue(expression.name, 'NAME')
      break
    case 'LocalReference':
      block.setFieldValue(expression.name, 'NAME')
      break
    case 'Literal':
      if (typeof expression.value === 'string') block.setFieldValue(escapeStringField(expression.value), 'VALUE')
      if (typeof expression.value === 'number') block.setFieldValue(String(expression.value), 'VALUE')
      if (typeof expression.value === 'boolean') block.setFieldValue(String(expression.value), 'VALUE')
      break
    case 'BinaryExpression':
      block.setFieldValue(expression.operator, 'OP')
      break
    case 'UnaryExpression':
      block.setFieldValue(expression.operator, 'OP')
      break
    case 'PropertyAccess':
      block.setFieldValue(expression.property, 'PROPERTY')
      block.setFieldValue(expression.optional ? 'true' : 'false', 'OPTIONAL')
      break
    case 'IndexAccess':
      block.setFieldValue(expression.optional ? 'true' : 'false', 'OPTIONAL')
      break
    case 'FunctionCall':
      if (!findFunctionDefinition(expression.name)) block.setFieldValue(expression.name, 'NAME')
      break
    case 'ArrowFunction':
      block.setFieldValue(expression.params.join(', '), 'PARAMS')
      break
    default:
      break
  }
}

function parseParameters(block: Blockly.Block): string[] {
  return String(block.getFieldValue('PARAMS') ?? '').split(',').map((value) => value.trim()).filter((value) => /^[A-Za-z_$][\w$]*$/.test(value))
}

function blockToTemplateString(block: Blockly.Block): TemplateStringNode {
  const interpolationCount = countConnectedTemplateInputs(block)
  const parts: TemplateStringNode['parts'] = []

  for (let index = 0; index < interpolationCount; index += 1) {
    parts.push(unescapeStringField(String(block.getFieldValue(`TEXT${index}`) ?? '')))
    const child = block.getInputTargetBlock(`EXPR${index}`)
    if (child) {
      parts.push(blockToExpression(child))
    }
  }

  parts.push(unescapeStringField(String(block.getFieldValue(`TEXT${interpolationCount}`) ?? '')))
  return { type: 'TemplateString', parts: trimUnusedTemplateParts(parts) }
}

function trimUnusedTemplateParts(parts: TemplateStringNode['parts']): TemplateStringNode['parts'] {
  const trimmed = [...parts]
  while (trimmed.length > 1 && typeof trimmed[trimmed.length - 1] === 'string' && trimmed[trimmed.length - 1] === '') {
    trimmed.pop()
  }
  return trimmed.length > 0 ? trimmed : ['']
}

function countConnectedTemplateInputs(block: Blockly.Block): number {
  let highestConnected = -1
  block.inputList.forEach((input) => {
    if (!input.name.startsWith('EXPR') || !input.connection?.targetBlock()) return
    highestConnected = Math.max(highestConnected, Number(input.name.replace('EXPR', '')))
  })
  return highestConnected + 1
}

function connectTemplateString(workspace: Blockly.WorkspaceSvg, block: Blockly.Block, expression: TemplateStringNode): void {
  let textIndex = 0
  let expressionIndex = 0

  expression.parts.forEach((part) => {
    if (typeof part === 'string') {
      block.setFieldValue(escapeStringField(part), `TEXT${textIndex}`)
      textIndex += 1
      return
    }

    connectExpression(workspace, block, `EXPR${expressionIndex}`, part)
    expressionIndex += 1
  })
}

export function workspaceSave(workspace: Blockly.Workspace): object {
  return Blockly.serialization.workspaces.save(workspace)
}

export function workspaceLoad(workspace: Blockly.WorkspaceSvg, state: object): void {
  Blockly.Events.disable()
  try {
    Blockly.serialization.workspaces.load(state, workspace)
  } finally {
    Blockly.Events.enable()
  }
}

export function isExpressionConnection(connection: Blockly.Connection | null): boolean {
  return Boolean(connection?.getCheck()?.includes(expressionCheck))
}

function getBinaryLogicWarning(block: Blockly.Block): string | null {
  const operator = String(block.getFieldValue('OP') ?? '')
  const left = block.getInputTargetBlock('LEFT')
  const right = block.getInputTargetBlock('RIGHT')

  if (!left || !right) return null

  if (isEqualityOperator(operator) && (isLogicalBlock(left) || isLogicalBlock(right))) {
    return 'This does not compare against multiple choices. Compare each condition directly, for example value == "A" || value == "B".'
  }

  if (isLogicalOperator(operator) && ((isComparisonBlock(left) && isStandaloneChoiceBlock(right)) || (isComparisonBlock(right) && isStandaloneChoiceBlock(left)))) {
    return 'This leaves one side as a standalone value. Compare each condition directly, for example value == "A" || value == "B".'
  }

  if (isComparisonOperator(operator) && (isComparisonBlock(left) || isComparisonBlock(right))) {
    return 'Chained comparisons do not work like math notation. Use separate comparisons, for example 1 < value && value < 5.'
  }

  if (operator === '||' && isNotEqualComparisonBlock(left) && isNotEqualComparisonBlock(right)) {
    return 'Excluding multiple values with != usually needs &&, for example value != "A" && value != "B".'
  }

  return null
}

function isComparisonBlock(block: Blockly.Block): boolean {
  return block.type === 'companion_binary' && isComparisonOperator(String(block.getFieldValue('OP') ?? ''))
}

function isNotEqualComparisonBlock(block: Blockly.Block): boolean {
  return block.type === 'companion_binary' && ['!=', '!=='].includes(String(block.getFieldValue('OP') ?? ''))
}

function isLogicalBlock(block: Blockly.Block): boolean {
  return block.type === 'companion_binary' && isLogicalOperator(String(block.getFieldValue('OP') ?? ''))
}

function isStandaloneChoiceBlock(block: Blockly.Block): boolean {
  return ['companion_string', 'companion_number', 'companion_null', 'companion_template_string'].includes(block.type)
}

function isEqualityOperator(operator: string): boolean {
  return ['==', '!=', '===', '!=='].includes(operator)
}

function isComparisonOperator(operator: string): boolean {
  return ['==', '!=', '===', '!==', '>', '>=', '<', '<='].includes(operator)
}

function isLogicalOperator(operator: string): boolean {
  return operator === '||' || operator === '&&'
}
