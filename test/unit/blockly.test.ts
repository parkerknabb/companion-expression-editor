import * as Blockly from 'blockly/core'
import { describe, expect, it } from 'vitest'
import { defineCompanionBlocks, functionBlockType, normalizeVariableFieldInput } from '../../src/blockly/blocks'
import { escapeStringField } from '../../src/blockly/stringField'
import { updateBlockWarnings, workspaceToProgram } from '../../src/blockly/workspace'
import { serializeProgram } from '../../src/expression/serialize'

defineCompanionBlocks()

describe('Blockly variadic function blocks', () => {
  it('strips wrapper syntax from simple pasted variable references only', () => {
    expect(normalizeVariableFieldInput('$(custom:a)')).toBe('custom:a')
    expect(normalizeVariableFieldInput(' $(internal:time_hms) ')).toBe('internal:time_hms')
    expect(normalizeVariableFieldInput('$(custom:$(custom:b))')).toBe('$(custom:$(custom:b))')
  })

  it('serializes simple pasted variable references from the variable block', () => {
    const workspace = new Blockly.Workspace()
    const statement = workspace.newBlock('companion_statement')
    const variable = workspace.newBlock('companion_variable')

    variable.setFieldValue('$(custom:a)', 'NAME')
    statement.getInput('VALUE')?.connection?.connect(variable.outputConnection!)

    expect(variable.getFieldValue('NAME')).toBe('custom:a')
    expect(serializeProgram(workspaceToProgram(workspace))).toBe('$(custom:a)')
  })

  it('does not strip nested variable references pasted into the variable block', () => {
    const workspace = new Blockly.Workspace()
    const variable = workspace.newBlock('companion_variable')

    variable.setFieldValue('$(custom:$(custom:b))', 'NAME')

    expect(variable.getFieldValue('NAME')).toBe('$(custom:$(custom:b))')
  })

  it('keeps connected children when growing concat inputs', () => {
    const workspace = new Blockly.Workspace()
    const statement = workspace.newBlock('companion_statement')
    const concat = workspace.newBlock(functionBlockType('concat')) as Blockly.Block & {
      onchange: () => void
      itemCount_: number
    }
    const text = workspace.newBlock('companion_string')

    text.setFieldValue('A', 'VALUE')
    const statementConnection = statement.getInput('VALUE')?.connection
    const concatOutput = concat.outputConnection
    const concatArgConnection = concat.getInput('ARG0')?.connection
    const textOutput = text.outputConnection

    if (!statementConnection || !concatOutput || !concatArgConnection || !textOutput) {
      throw new Error('Expected Blockly test connections to exist.')
    }

    statementConnection.connect(concatOutput)
    concatArgConnection.connect(textOutput)

    concat.onchange()

    expect(concat.itemCount_).toBe(2)
    expect(concat.getInputsInline()).toBe(true)
    expect(concat.getInputTargetBlock('ARG0')).toBe(text)
    expect(serializeProgram(workspaceToProgram(workspace))).toBe('concat("A")')
  })

  it('keeps small variadic blocks inline and wraps longer ones vertically', () => {
    const workspace = new Blockly.Workspace()
    const concat = workspace.newBlock(functionBlockType('concat')) as Blockly.Block & {
      itemCount_: number
      updateShape_: () => void
    }

    expect(concat.getInputsInline()).toBe(true)

    concat.itemCount_ = 4
    concat.updateShape_()

    expect(concat.getInputsInline()).toBe(false)
  })

  it('shows escaped control characters in imported string blocks', () => {
    expect(escapeStringField('Line\nTwo\tTabbed')).toBe('Line\\nTwo\\tTabbed')
  })

  it('interprets escape sequences typed into string blocks', () => {
    const workspace = new Blockly.Workspace()
    const statement = workspace.newBlock('companion_statement')
    const text = workspace.newBlock('companion_string')
    const statementConnection = statement.getInput('VALUE')?.connection
    const textOutput = text.outputConnection

    if (!statementConnection || !textOutput) {
      throw new Error('Expected Blockly test connections to exist.')
    }

    text.setFieldValue('Line\\nTwo', 'VALUE')
    statementConnection.connect(textOutput)

    expect(serializeProgram(workspaceToProgram(workspace))).toBe('"Line\\nTwo"')
  })

  it('serializes rectangular if statement blocks as real control flow', () => {
    const workspace = new Blockly.Workspace()
    const ifBlock = workspace.newBlock('companion_if_control')
    const condition = workspace.newBlock('companion_boolean')
    const trueResult = workspace.newBlock('companion_statement')
    const falseResult = workspace.newBlock('companion_statement')
    const whenTrue = workspace.newBlock('companion_string')
    const whenFalse = workspace.newBlock('companion_string')

    condition.setFieldValue('true', 'VALUE')
    whenTrue.setFieldValue('On', 'VALUE')
    whenFalse.setFieldValue('Off', 'VALUE')

    const conditionConnection = ifBlock.getInput('CONDITION')?.connection
    const trueBranchConnection = ifBlock.getInput('THEN')?.connection
    const falseBranchConnection = ifBlock.getInput('ELSE')?.connection
    const trueValueConnection = trueResult.getInput('VALUE')?.connection
    const falseValueConnection = falseResult.getInput('VALUE')?.connection

    if (
      !conditionConnection ||
      !trueBranchConnection ||
      !falseBranchConnection ||
      !trueValueConnection ||
      !falseValueConnection ||
      !condition.outputConnection ||
      !trueResult.previousConnection ||
      !falseResult.previousConnection ||
      !whenTrue.outputConnection ||
      !whenFalse.outputConnection
    ) {
      throw new Error('Expected Blockly test connections to exist.')
    }

    conditionConnection.connect(condition.outputConnection)
    trueBranchConnection.connect(trueResult.previousConnection)
    falseBranchConnection.connect(falseResult.previousConnection)
    trueValueConnection.connect(whenTrue.outputConnection)
    falseValueConnection.connect(whenFalse.outputConnection)

    expect(serializeProgram(workspaceToProgram(workspace))).toBe('if (true) { "On"; } else { "Off"; }')
  })

  it('serializes local assignment and reference blocks', () => {
    const workspace = new Blockly.Workspace()
    const assignment = workspace.newBlock('companion_assignment')
    const value = workspace.newBlock('companion_binary')
    const left = workspace.newBlock('companion_variable')
    const right = workspace.newBlock('companion_variable')
    const result = workspace.newBlock('companion_statement')
    const local = workspace.newBlock('companion_local_reference')

    assignment.setFieldValue('myval', 'NAME')
    left.setFieldValue('custom:a', 'NAME')
    right.setFieldValue('custom:b', 'NAME')
    local.setFieldValue('myval', 'NAME')

    assignment.getInput('VALUE')?.connection?.connect(value.outputConnection!)
    value.getInput('LEFT')?.connection?.connect(left.outputConnection!)
    value.getInput('RIGHT')?.connection?.connect(right.outputConnection!)
    assignment.nextConnection?.connect(result.previousConnection!)
    result.getInput('VALUE')?.connection?.connect(local.outputConnection!)

    expect(serializeProgram(workspaceToProgram(workspace))).toBe('myval = $(custom:a) + $(custom:b);\nmyval')
  })

  it('serializes template string blocks with interpolation', () => {
    const workspace = new Blockly.Workspace()
    const statement = workspace.newBlock('companion_statement')
    const template = workspace.newBlock('companion_template_string') as Blockly.Block & {
      onchange: () => void
    }
    const variable = workspace.newBlock('companion_variable')

    variable.setFieldValue('custom:a', 'NAME')
    template.setFieldValue('dB', 'TEXT1')
    statement.getInput('VALUE')?.connection?.connect(template.outputConnection!)
    template.getInput('EXPR0')?.connection?.connect(variable.outputConnection!)
    template.onchange()

    expect(serializeProgram(workspaceToProgram(workspace))).toBe('`${$(custom:a)}dB`')
  })

  it('serializes index access blocks', () => {
    const workspace = new Blockly.Workspace()
    const statement = workspace.newBlock('companion_statement')
    const indexAccess = workspace.newBlock('companion_index_access')
    const split = workspace.newBlock(functionBlockType('split'))
    const value = workspace.newBlock('companion_variable')
    const separator = workspace.newBlock('companion_string')
    const index = workspace.newBlock('companion_number')

    value.setFieldValue('custom:csv', 'NAME')
    separator.setFieldValue(',', 'VALUE')
    index.setFieldValue('2', 'VALUE')

    statement.getInput('VALUE')?.connection?.connect(indexAccess.outputConnection!)
    indexAccess.getInput('OBJECT')?.connection?.connect(split.outputConnection!)
    indexAccess.getInput('INDEX')?.connection?.connect(index.outputConnection!)
    split.getInput('ARG0')?.connection?.connect(value.outputConnection!)
    split.getInput('ARG1')?.connection?.connect(separator.outputConnection!)

    expect(serializeProgram(workspaceToProgram(workspace))).toBe('split($(custom:csv), ",")[2]')
  })

  it('serializes Companion 5.0 for-of and if control statements', () => {
    const workspace = new Blockly.Workspace()
    const loop = workspace.newBlock('companion_for_of_control')
    const iterable = workspace.newBlock('companion_variable')
    const ifBlock = workspace.newBlock('companion_if_control')
    const condition = workspace.newBlock('companion_boolean')
    const assignment = workspace.newBlock('companion_assignment')
    const item = workspace.newBlock('companion_local_reference')

    loop.setFieldValue('let', 'KIND')
    loop.setFieldValue('item', 'NAME')
    iterable.setFieldValue('custom:items', 'NAME')
    condition.setFieldValue('true', 'VALUE')
    assignment.setFieldValue('selected', 'NAME')
    item.setFieldValue('item', 'NAME')
    loop.getInput('ITERABLE')?.connection?.connect(iterable.outputConnection!)
    loop.getInput('BODY')?.connection?.connect(ifBlock.previousConnection!)
    ifBlock.getInput('CONDITION')?.connection?.connect(condition.outputConnection!)
    ifBlock.getInput('THEN')?.connection?.connect(assignment.previousConnection!)
    assignment.getInput('VALUE')?.connection?.connect(item.outputConnection!)

    expect(serializeProgram(workspaceToProgram(workspace))).toBe('for (let item of $(custom:items)) { if (true) { selected = item; } }')
  })

  it('serializes arrow callbacks as collection helper arguments', () => {
    const workspace = new Blockly.Workspace()
    const statement = workspace.newBlock('companion_statement')
    const map = workspace.newBlock(functionBlockType('arrayMap'))
    const values = workspace.newBlock('companion_variable')
    const callback = workspace.newBlock('companion_arrow_expression')
    const item = workspace.newBlock('companion_local_reference')

    values.setFieldValue('custom:values', 'NAME')
    callback.setFieldValue('item', 'PARAMS')
    item.setFieldValue('item', 'NAME')
    statement.getInput('VALUE')?.connection?.connect(map.outputConnection!)
    map.getInput('ARG0')?.connection?.connect(values.outputConnection!)
    map.getInput('ARG1')?.connection?.connect(callback.outputConnection!)
    callback.getInput('VALUE')?.connection?.connect(item.outputConnection!)

    expect(serializeProgram(workspaceToProgram(workspace))).toBe('arrayMap($(custom:values), item => item)')
  })


  it('warns when comparing against logical string choices', () => {
    const workspace = new Blockly.Workspace()
    const compare = workspace.newBlock('companion_binary')
    const variable = workspace.newBlock('companion_variable')
    const choices = workspace.newBlock('companion_binary')
    const choiceA = workspace.newBlock('companion_string')
    const choiceB = workspace.newBlock('companion_string')

    compare.setFieldValue('==', 'OP')
    choices.setFieldValue('||', 'OP')
    variable.setFieldValue('atem:pgm1_input', 'NAME')
    choiceA.setFieldValue('CAM 1', 'VALUE')
    choiceB.setFieldValue('Black', 'VALUE')
    compare.getInput('LEFT')?.connection?.connect(variable.outputConnection!)
    compare.getInput('RIGHT')?.connection?.connect(choices.outputConnection!)
    choices.getInput('LEFT')?.connection?.connect(choiceA.outputConnection!)
    choices.getInput('RIGHT')?.connection?.connect(choiceB.outputConnection!)

    expect(capturedWarningFor(workspace, compare)).toContain('Compare each condition directly')
  })

  it('does not warn for repeated direct comparisons', () => {
    const workspace = new Blockly.Workspace()
    const either = workspace.newBlock('companion_binary')
    const leftCompare = workspace.newBlock('companion_binary')
    const rightCompare = workspace.newBlock('companion_binary')

    either.setFieldValue('||', 'OP')
    leftCompare.setFieldValue('==', 'OP')
    rightCompare.setFieldValue('==', 'OP')
    either.getInput('LEFT')?.connection?.connect(leftCompare.outputConnection!)
    either.getInput('RIGHT')?.connection?.connect(rightCompare.outputConnection!)

    expect(updateBlockWarnings(workspace)).toBe(0)
  })

  it('warns for chained comparisons', () => {
    const workspace = new Blockly.Workspace()
    const outer = workspace.newBlock('companion_binary')
    const inner = workspace.newBlock('companion_binary')
    const high = workspace.newBlock('companion_number')

    outer.setFieldValue('<', 'OP')
    inner.setFieldValue('<', 'OP')
    high.setFieldValue('5', 'VALUE')
    outer.getInput('LEFT')?.connection?.connect(inner.outputConnection!)
    outer.getInput('RIGHT')?.connection?.connect(high.outputConnection!)

    expect(capturedWarningFor(workspace, outer)).toContain('Chained comparisons')
  })

  it('warns for excluding multiple values with OR', () => {
    const workspace = new Blockly.Workspace()
    const either = workspace.newBlock('companion_binary')
    const leftCompare = workspace.newBlock('companion_binary')
    const rightCompare = workspace.newBlock('companion_binary')

    either.setFieldValue('||', 'OP')
    leftCompare.setFieldValue('!=', 'OP')
    rightCompare.setFieldValue('!=', 'OP')
    either.getInput('LEFT')?.connection?.connect(leftCompare.outputConnection!)
    either.getInput('RIGHT')?.connection?.connect(rightCompare.outputConnection!)

    expect(capturedWarningFor(workspace, either)).toContain('usually needs &&')
  })
})

function capturedWarningFor(workspace: Blockly.Workspace, block: Blockly.Block): string | null {
  let warning: string | null = null
  const originalSetWarningText = block.setWarningText.bind(block)
  block.setWarningText = ((text: string | null) => {
    warning = text
  }) as Blockly.Block['setWarningText']

  try {
    updateBlockWarnings(workspace)
  } finally {
    block.setWarningText = originalSetWarningText
  }

  return warning
}
