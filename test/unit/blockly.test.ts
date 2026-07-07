import * as Blockly from 'blockly/core'
import { describe, expect, it } from 'vitest'
import { defineCompanionBlocks, functionBlockType, normalizeVariableFieldInput } from '../../src/blockly/blocks'
import { escapeStringField } from '../../src/blockly/stringField'
import { workspaceToProgram } from '../../src/blockly/workspace'
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

  it('serializes rectangular if statement blocks as ternaries', () => {
    const workspace = new Blockly.Workspace()
    const ifBlock = workspace.newBlock('companion_if_statement')
    const condition = workspace.newBlock('companion_boolean')
    const trueResult = workspace.newBlock('companion_statement')
    const falseResult = workspace.newBlock('companion_statement')
    const whenTrue = workspace.newBlock('companion_string')
    const whenFalse = workspace.newBlock('companion_string')

    condition.setFieldValue('true', 'VALUE')
    whenTrue.setFieldValue('On', 'VALUE')
    whenFalse.setFieldValue('Off', 'VALUE')

    const conditionConnection = ifBlock.getInput('CONDITION')?.connection
    const trueBranchConnection = ifBlock.getInput('TRUE')?.connection
    const falseBranchConnection = ifBlock.getInput('FALSE')?.connection
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

    expect(serializeProgram(workspaceToProgram(workspace))).toBe('true ? "On" : "Off"')
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
})
