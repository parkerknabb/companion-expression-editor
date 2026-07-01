import * as Blockly from 'blockly/core'
import type { FunctionDefinition, FunctionName } from '../expression/model'
import { functionDefinitions } from '../expression/model'

export const expressionCheck = 'CompanionExpression'
export const statementCheck = 'CompanionStatement'

export function functionBlockType(name: FunctionName): string {
  return `companion_function_${name}`
}

export function defineCompanionBlocks(): void {
  functionDefinitions.filter((definition) => definition.variadic).forEach(defineVariadicFunctionBlock)

  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'companion_program',
      message0: 'Companion expression %1',
      args0: [{ type: 'input_statement', name: 'STATEMENTS', check: statementCheck }],
      colour: 215,
      tooltip: 'Top-level Companion expression statements',
    },
    {
      type: 'companion_statement',
      message0: 'return %1',
      args0: [{ type: 'input_value', name: 'VALUE', check: expressionCheck }],
      previousStatement: statementCheck,
      nextStatement: statementCheck,
      colour: 215,
      tooltip: 'A statement. Companion uses the last statement as the expression value.',
    },
    {
      type: 'companion_variable',
      message0: 'variable $ ( %1 )',
      args0: [{ type: 'field_input', name: 'NAME', text: 'internal:time_hms' }],
      output: expressionCheck,
      colour: 170,
      tooltip: 'A Companion variable reference',
    },
    {
      type: 'companion_string',
      message0: 'text %1',
      args0: [{ type: 'field_input', name: 'VALUE', text: 'Hello' }],
      output: expressionCheck,
      colour: 45,
      tooltip: 'A text literal',
    },
    {
      type: 'companion_number',
      message0: 'number %1',
      args0: [{ type: 'field_number', name: 'VALUE', value: 0 }],
      output: expressionCheck,
      colour: 45,
      tooltip: 'A number literal',
    },
    {
      type: 'companion_boolean',
      message0: 'boolean %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'VALUE',
          options: [
            ['true', 'true'],
            ['false', 'false'],
          ],
        },
      ],
      output: expressionCheck,
      colour: 45,
      tooltip: 'A boolean literal',
    },
    {
      type: 'companion_null',
      message0: 'null',
      output: expressionCheck,
      colour: 45,
      tooltip: 'A null literal',
    },
    {
      type: 'companion_ternary',
      message0: 'if %1 then %2 else %3',
      args0: [
        { type: 'input_value', name: 'CONDITION', check: expressionCheck },
        { type: 'input_value', name: 'TRUE', check: expressionCheck },
        { type: 'input_value', name: 'FALSE', check: expressionCheck },
      ],
      output: expressionCheck,
      colour: 290,
      tooltip: 'A ternary expression: condition ? true value : false value',
    },
    {
      type: 'companion_unary',
      message0: '%1 %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['!', '!'],
            ['-', '-'],
            ['+', '+'],
            ['~', '~'],
          ],
        },
        { type: 'input_value', name: 'ARG', check: expressionCheck },
      ],
      inputsInline: true,
      output: expressionCheck,
      colour: 260,
      tooltip: 'A unary expression',
    },
    {
      type: 'companion_binary',
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'LEFT', check: expressionCheck },
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['+', '+'],
            ['-', '-'],
            ['*', '*'],
            ['/', '/'],
            ['%', '%'],
            ['**', '**'],
            ['==', '=='],
            ['!=', '!='],
            ['===', '==='],
            ['!==', '!=='],
            ['>', '>'],
            ['>=', '>='],
            ['<', '<'],
            ['<=', '<='],
            ['&&', '&&'],
            ['||', '||'],
            ['&', '&'],
            ['|', '|'],
            ['^', '^'],
            ['<<', '<<'],
            ['>>', '>>'],
          ],
        },
        { type: 'input_value', name: 'RIGHT', check: expressionCheck },
      ],
      inputsInline: true,
      output: expressionCheck,
      colour: 260,
      tooltip: 'A binary expression',
    },
    ...functionDefinitions.filter((definition) => !definition.variadic).map(functionDefinitionToBlock),
  ])
}

export const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Structure',
      colour: '215',
      contents: [
        { kind: 'block', type: 'companion_program' },
        { kind: 'block', type: 'companion_statement' },
        { kind: 'block', type: 'companion_ternary' },
      ],
    },
    {
      kind: 'category',
      name: 'Values',
      colour: '45',
      contents: [
        { kind: 'block', type: 'companion_variable' },
        { kind: 'block', type: 'companion_string' },
        { kind: 'block', type: 'companion_number' },
        { kind: 'block', type: 'companion_boolean' },
        { kind: 'block', type: 'companion_null' },
      ],
    },
    {
      kind: 'category',
      name: 'Functions',
      colour: '120',
      contents: functionToolboxContents(),
    },
    {
      kind: 'category',
      name: 'Operators',
      colour: '260',
      contents: [
        { kind: 'block', type: 'companion_unary' },
        { kind: 'block', type: 'companion_binary' },
      ],
    },
  ],
}

function functionDefinitionToBlock(definition: FunctionDefinition): object {
  const maxArgs = definition.maxArgs ?? definition.minArgs
  const args0 = definition.argLabels.map((_, index) => ({
    type: 'input_value',
    name: `ARG${index}`,
    check: expressionCheck,
    align: 'RIGHT',
  }))

  return {
    type: functionBlockType(definition.name),
    message0:
      maxArgs === 0
        ? `${definition.label}()`
        : `${definition.label} ${definition.argLabels.map((label, index) => `${label} %${index + 1}`).join(' ')}`,
    args0,
    output: expressionCheck,
    colour: 120,
    tooltip: `${definition.label}(${definition.argLabels.join(', ')})`,
  }
}

function defineVariadicFunctionBlock(definition: FunctionDefinition): void {
  type DynamicFunctionBlock = Blockly.Block & {
    itemCount_: number
    updateShape_: () => void
  }

  Blockly.Blocks[functionBlockType(definition.name)] = {
    init(this: DynamicFunctionBlock) {
      this.itemCount_ = definition.minArgs
      this.setOutput(true, expressionCheck)
      this.setColour(120)
      this.setInputsInline(false)
      this.setTooltip(`${definition.label}(${definition.argLabels.join(', ')}, ...)`)
      this.updateShape_ = () => updateVariadicShape(this, definition)
      this.updateShape_()
    },

    onchange(this: DynamicFunctionBlock) {
      if (!this.workspace || this.isInFlyout) return

      const desiredCount = getDesiredVariadicInputCount(this, definition.minArgs)
      if (desiredCount !== this.itemCount_) {
        this.itemCount_ = desiredCount
        this.updateShape_()
      }
    },

    saveExtraState(this: DynamicFunctionBlock) {
      return { itemCount: this.itemCount_ }
    },

    loadExtraState(this: DynamicFunctionBlock, state: { itemCount?: number }) {
      this.itemCount_ = Math.max(definition.minArgs, Number(state.itemCount ?? definition.minArgs))
      this.updateShape_()
    },
  }
}

function updateVariadicShape(block: Blockly.Block & { itemCount_: number }, definition: FunctionDefinition): void {
  if (!block.getInput('FUNCTION_LABEL')) {
    block.appendDummyInput('FUNCTION_LABEL').appendField(definition.label)
  }

  for (let index = 0; index < block.itemCount_; index += 1) {
    const existingInput = block.getInput(`ARG${index}`)
    if (existingInput) {
      clearInputFields(existingInput)
      existingInput.setAlign(Blockly.inputs.Align.LEFT)
      continue
    }

    block.appendValueInput(`ARG${index}`).setCheck(expressionCheck).setAlign(Blockly.inputs.Align.LEFT)
  }

  block.moveInputBefore('FUNCTION_LABEL', block.getInput('ARG0') ? 'ARG0' : null)

  for (let index = block.itemCount_; block.getInput(`ARG${index}`); index += 1) {
    block.removeInput(`ARG${index}`)
  }
}

function clearInputFields(input: Blockly.Input): void {
  input.fieldRow.forEach((field) => field.dispose())
  input.fieldRow.length = 0
}

function getDesiredVariadicInputCount(block: Blockly.Block & { itemCount_: number }, minArgs: number): number {
  let highestFilled = -1
  for (let index = 0; index < block.itemCount_; index += 1) {
    if (block.getInputTargetBlock(`ARG${index}`)) highestFilled = index
  }

  return Math.max(minArgs, highestFilled + 2)
}

function functionToolboxContents(): object[] {
  const categories = ['General', 'Numeric', 'String', 'Variable', 'Bool', 'Time']
  return categories.map((category) => ({
    kind: 'category',
    name: category,
    colour: '120',
    contents: functionDefinitions
      .filter((definition) => definition.category === category)
      .map((definition) => ({ kind: 'block', type: functionBlockType(definition.name) })),
  }))
}
