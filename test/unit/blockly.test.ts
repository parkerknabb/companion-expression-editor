import * as Blockly from 'blockly/core'
import { describe, expect, it } from 'vitest'
import { defineCompanionBlocks, functionBlockType } from '../../src/blockly/blocks'
import { escapeStringField } from '../../src/blockly/stringField'
import { workspaceToProgram } from '../../src/blockly/workspace'
import { serializeProgram } from '../../src/expression/serialize'

defineCompanionBlocks()

describe('Blockly variadic function blocks', () => {
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
})
