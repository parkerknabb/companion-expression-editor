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
    expect(concat.getInputTargetBlock('ARG0')).toBe(text)
    expect(serializeProgram(workspaceToProgram(workspace))).toBe('concat("A")')
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
})
