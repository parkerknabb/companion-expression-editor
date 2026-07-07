import * as Blockly from 'blockly/core'
import type { BinaryOperator, ExpressionNode, FunctionName, ProgramNode, StatementNode, TemplateStringNode, UnaryOperator } from '../expression/model'
import { findFunctionDefinition, functionDefinitions } from '../expression/model'
import { expressionCheck, functionBlockType } from './blocks'
import { escapeStringField, unescapeStringField } from './stringField'

const defaultLiteral: ExpressionNode = { type: 'Literal', value: '' }

export function workspaceToProgram(workspace: Blockly.Workspace): ProgramNode {
  const programBlock =
    workspace.getTopBlocks(false).find((block) => block.type === 'companion_program') ??
    workspace.getTopBlocks(false).find((block) => block.type === 'companion_assignment' || block.type === 'companion_expression_statement' || block.type === 'companion_statement' || block.type === 'companion_if_statement')

  if (!programBlock) return { type: 'Program', statements: [defaultLiteral] }

  if (programBlock.type === 'companion_assignment' || programBlock.type === 'companion_expression_statement' || programBlock.type === 'companion_statement' || programBlock.type === 'companion_if_statement') {
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
    const programBlock = workspace.newBlock('companion_program')
    programBlock.initSvg()
    programBlock.render()

    let previous: Blockly.Block | null = null
    program.statements.forEach((statement, index) => {
      const statementBlock = expressionToStatementBlock(workspace, statement, index === program.statements.length - 1)
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

export function ensureDefaultWorkspace(workspace: Blockly.WorkspaceSvg): void {
  if (workspace.getAllBlocks(false).length === 0) {
    loadProgramIntoWorkspace(workspace, {
      type: 'Program',
      statements: [{ type: 'Variable', name: 'internal:time_hms' }],
    })
  }
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
    } else if (current.type === 'companion_expression_statement' || current.type === 'companion_statement') {
      const value = current.getInputTargetBlock('VALUE')
      statements.push(value ? blockToExpression(value) : defaultLiteral)
    } else if (current.type === 'companion_if_statement') {
      statements.push(ifStatementToExpression(current))
    }
    current = current.getNextBlock()
  }
  return statements.length > 0 ? statements : [defaultLiteral]
}

function blockToExpression(block: Blockly.Block): ExpressionNode {
  switch (block.type) {
    case 'companion_variable':
      return { type: 'Variable', name: String(block.getFieldValue('NAME') ?? '') }
    case 'companion_local_reference':
      return { type: 'LocalReference', name: String(block.getFieldValue('NAME') ?? '') }
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
    case 'companion_ternary':
      return {
        type: 'Ternary',
        condition: childExpression(block, 'CONDITION'),
        whenTrue: childExpression(block, 'TRUE'),
        whenFalse: childExpression(block, 'FALSE'),
      }
    case 'companion_if_statement':
      return ifStatementToExpression(block)
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
      }
    default:
      if (block.type.startsWith('companion_function_')) return blockToFunctionCall(block)
      return defaultLiteral
  }
}

function ifStatementToExpression(block: Blockly.Block): ExpressionNode {
  return {
    type: 'Ternary',
    condition: childExpression(block, 'CONDITION'),
    whenTrue: childStatementExpression(block, 'TRUE'),
    whenFalse: childStatementExpression(block, 'FALSE'),
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

function childStatementExpression(block: Blockly.Block, input: string): ExpressionNode {
  const child = block.getInputTargetBlock(input)
  return child ? statementBlockToExpression(child) : defaultLiteral
}

function statementBlockToExpression(block: Blockly.Block): ExpressionNode {
  if (block.type === 'companion_expression_statement' || block.type === 'companion_statement') {
    const value = block.getInputTargetBlock('VALUE')
    return value ? blockToExpression(value) : defaultLiteral
  }

  if (block.type === 'companion_if_statement') {
    return ifStatementToExpression(block)
  }

  return blockToExpression(block)
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

function connectStatement(
  workspace: Blockly.WorkspaceSvg,
  parent: Blockly.Block,
  inputName: string,
  expression: ExpressionNode,
): Blockly.BlockSvg {
  const child = expressionToStatementBlock(workspace, expression, true)
  const input = parent.getInput(inputName)
  if (!input?.connection || !child.previousConnection) {
    throw new Error(`Cannot connect ${child.type} to ${parent.type}.${inputName}`)
  }
  input.connection.connect(child.previousConnection)
  return child
}

function expressionToStatementBlock(workspace: Blockly.WorkspaceSvg, statement: StatementNode, isLast = true): Blockly.BlockSvg {
  if (statement.type === 'Assignment') {
    const block = workspace.newBlock('companion_assignment') as Blockly.BlockSvg
    block.initSvg()
    block.setFieldValue(statement.name, 'NAME')
    connectExpression(workspace, block, 'VALUE', statement.value)
    return block
  }

  if (statement.type === 'Ternary' && isLast) {
    const block = workspace.newBlock('companion_if_statement') as Blockly.BlockSvg
    block.initSvg()
    connectExpression(workspace, block, 'CONDITION', statement.condition)
    connectStatement(workspace, block, 'TRUE', statement.whenTrue)
    connectStatement(workspace, block, 'FALSE', statement.whenFalse)
    return block
  }

  const block = workspace.newBlock(isLast ? 'companion_statement' : 'companion_expression_statement') as Blockly.BlockSvg
  block.initSvg()
  connectExpression(workspace, block, 'VALUE', statement)
  return block
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
    case 'BinaryExpression':
      connectExpression(workspace, block, 'LEFT', expression.left)
      connectExpression(workspace, block, 'RIGHT', expression.right)
      break
    case 'UnaryExpression':
      connectExpression(workspace, block, 'ARG', expression.argument)
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
  if (expression.type === 'UnaryExpression') return 'companion_unary'
  if (expression.type === 'FunctionCall') {
    return functionBlockType(expression.name)
  }
  if (typeof expression.value === 'string') return 'companion_string'
  if (typeof expression.value === 'number') return 'companion_number'
  if (typeof expression.value === 'boolean') return 'companion_boolean'
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
    case 'FunctionCall':
      if (!findFunctionDefinition(expression.name as FunctionName)) {
        throw new Error(`Unsupported function block ${expression.name}`)
      }
      break
    default:
      break
  }
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
