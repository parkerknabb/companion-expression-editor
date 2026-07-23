import * as Blockly from 'blockly/core'
import type { FunctionDefinition, FunctionName } from '../expression/model'
import { functionDefinitions, variadicInlineInputLimit } from '../expression/model'

export const expressionCheck = 'CompanionExpression'
export const statementCheck = 'CompanionStatement'

export function functionBlockType(name: FunctionName): string {
  return `companion_function_${name}`
}

export function defineCompanionBlocks(): void {
  functionDefinitions.filter((definition) => definition.variadic).forEach(defineVariadicFunctionBlock)
  defineCustomFunctionBlock()
  defineVariableBlock()
  defineTemplateStringBlock()

  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'companion_program',
      message0: 'expression %1',
      args0: [{ type: 'input_statement', name: 'STATEMENTS', check: statementCheck }],
      colour: 215,
      tooltip: 'Top-level Companion expression statements',
    },
    {
      type: 'companion_statement',
      message0: 'result %1',
      args0: [{ type: 'input_value', name: 'VALUE', check: expressionCheck }],
      previousStatement: statementCheck,
      colour: 215,
      tooltip: 'A statement. Companion uses the last statement as the expression value.',
    },
    {
      type: 'companion_expression_statement',
      message0: 'evaluate %1',
      args0: [{ type: 'input_value', name: 'VALUE', check: expressionCheck }],
      previousStatement: statementCheck,
      nextStatement: statementCheck,
      colour: 215,
      tooltip: 'An intermediate expression statement. Companion uses the last statement as the expression value.',
    },
    {
      type: 'companion_assignment',
      message0: 'set local %1 to %2',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'myval' },
        { type: 'input_value', name: 'VALUE', check: expressionCheck },
      ],
      previousStatement: statementCheck,
      nextStatement: statementCheck,
      colour: 215,
      tooltip: 'Create or update a local value for later statements.',
    },
    {
      type: 'companion_member_assignment',
      message0: 'set %1 to %2',
      args0: [{ type: 'input_value', name: 'TARGET', check: expressionCheck }, { type: 'input_value', name: 'VALUE', check: expressionCheck }],
      previousStatement: statementCheck, nextStatement: statementCheck, colour: 215,
      tooltip: 'Update an object property or array index.',
    },
    {
      type: 'companion_declaration',
      message0: '%1 local %2 to %3',
      args0: [
        { type: 'field_dropdown', name: 'KIND', options: [['let', 'let'], ['const', 'const']] },
        { type: 'field_input', name: 'NAME', text: 'item' },
        { type: 'input_value', name: 'VALUE', check: expressionCheck },
      ],
      previousStatement: statementCheck,
      nextStatement: statementCheck,
      colour: 215,
      tooltip: 'Declare a local value in the current scope.',
    },
    {
      type: 'companion_if_control',
      message0: 'if %1', args0: [{ type: 'input_value', name: 'CONDITION', check: expressionCheck }],
      message1: 'do %1', args1: [{ type: 'input_statement', name: 'THEN', check: statementCheck }],
      message2: 'else %1', args2: [{ type: 'input_statement', name: 'ELSE', check: statementCheck }],
      previousStatement: statementCheck, nextStatement: statementCheck, colour: 290,
      tooltip: 'Run one block of statements when the condition is true, otherwise run the else block.',
    },
    {
      type: 'companion_while_control',
      message0: 'while %1', args0: [{ type: 'input_value', name: 'CONDITION', check: expressionCheck }],
      message1: 'do %1', args1: [{ type: 'input_statement', name: 'BODY', check: statementCheck }],
      previousStatement: statementCheck, nextStatement: statementCheck, colour: 290,
      tooltip: 'Repeat while the condition is true. Companion stops expressions that exceed its execution budget.',
    },
    {
      type: 'companion_for_of_control',
      message0: 'for each %1 %2 of %3',
      args0: [
        { type: 'field_dropdown', name: 'KIND', options: [['let', 'let'], ['const', 'const']] },
        { type: 'field_input', name: 'NAME', text: 'item' },
        { type: 'input_value', name: 'ITERABLE', check: expressionCheck },
      ],
      message1: 'do %1', args1: [{ type: 'input_statement', name: 'BODY', check: statementCheck }],
      previousStatement: statementCheck, nextStatement: statementCheck, colour: 290,
      tooltip: 'Iterate over every value in an array or object iterable.',
    },
    {
      type: 'companion_for_control',
      message0: 'for %1 %2 from %3 while index %4 %5 then %6',
      args0: [
        { type: 'field_dropdown', name: 'KIND', options: [['let', 'let'], ['const', 'const']] },
        { type: 'field_input', name: 'NAME', text: 'index' },
        { type: 'input_value', name: 'START', check: expressionCheck },
        { type: 'field_dropdown', name: 'OP', options: [['<', '<'], ['≤', '<='], ['>', '>'], ['≥', '>=']] },
        { type: 'input_value', name: 'END', check: expressionCheck },
        { type: 'field_dropdown', name: 'UPDATE', options: [['++', '++'], ['--', '--']] },
      ],
      message1: 'do %1', args1: [{ type: 'input_statement', name: 'BODY', check: statementCheck }],
      previousStatement: statementCheck, nextStatement: statementCheck, colour: 290,
      tooltip: 'A counting loop with an explicit comparison and increment/decrement.',
    },
    { type: 'companion_return', message0: 'return %1', args0: [{ type: 'input_value', name: 'VALUE', check: expressionCheck }], previousStatement: statementCheck, nextStatement: statementCheck, colour: 290, tooltip: 'Return a value from an arrow-function body.' },
    { type: 'companion_break', message0: 'break loop', previousStatement: statementCheck, nextStatement: statementCheck, colour: 290 },
    { type: 'companion_continue', message0: 'continue loop', previousStatement: statementCheck, nextStatement: statementCheck, colour: 290 },
    {
      type: 'companion_local_reference',
      message0: 'local %1',
      args0: [{ type: 'field_input', name: 'NAME', text: 'myval' }],
      output: expressionCheck,
      colour: 170,
      tooltip: 'A local value created by an earlier assignment statement.',
    },
    {
      type: 'companion_arrow_expression',
      message0: 'function %1 ⇒ %2',
      args0: [{ type: 'field_input', name: 'PARAMS', text: 'item' }, { type: 'input_value', name: 'VALUE', check: expressionCheck }],
      output: expressionCheck, colour: 290,
      tooltip: 'An arrow callback. Enter comma-separated local parameter names.',
    },
    {
      type: 'companion_arrow_block',
      message0: 'function %1', args0: [{ type: 'field_input', name: 'PARAMS', text: 'item' }],
      message1: 'do %1', args1: [{ type: 'input_statement', name: 'BODY', check: statementCheck }],
      output: expressionCheck, colour: 290,
      tooltip: 'An arrow callback with statements. Use return to provide its value.',
    },
    { type: 'companion_spread', message0: 'spread ... %1', args0: [{ type: 'input_value', name: 'VALUE', check: expressionCheck }], output: expressionCheck, colour: 45 },
    { type: 'companion_array', message0: 'array [ %1 %2 %3 %4 %5 %6 ]', args0: [0, 1, 2, 3, 4, 5].map((index) => ({ type: 'input_value', name: `ITEM${index}`, check: expressionCheck })), inputsInline: false, output: expressionCheck, colour: 45 },
    { type: 'companion_object', message0: 'object %1: %2 %3: %4 %5: %6 %7: %8', args0: [
      { type: 'field_input', name: 'KEY0', text: 'key' }, { type: 'input_value', name: 'VALUE0', check: expressionCheck },
      { type: 'field_input', name: 'KEY1', text: 'key' }, { type: 'input_value', name: 'VALUE1', check: expressionCheck },
      { type: 'field_input', name: 'KEY2', text: 'key' }, { type: 'input_value', name: 'VALUE2', check: expressionCheck },
      { type: 'field_input', name: 'KEY3', text: 'key' }, { type: 'input_value', name: 'VALUE3', check: expressionCheck },
    ], inputsInline: false, output: expressionCheck, colour: 45 },
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
    { type: 'companion_undefined', message0: 'undefined', output: expressionCheck, colour: 45, tooltip: 'An undefined value.' },
    {
      type: 'companion_ternary',
      message0: 'if %1 then %2 else %3',
      args0: [
        { type: 'input_value', name: 'CONDITION', check: expressionCheck },
        { type: 'input_value', name: 'TRUE', check: expressionCheck },
        { type: 'input_value', name: 'FALSE', check: expressionCheck },
      ],
      inputsInline: true,
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
            ['??', '??'],
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
    {
      type: 'companion_index_access',
      message0: '%1 %2 item # %3',
      args0: [
        { type: 'input_value', name: 'OBJECT', check: expressionCheck },
        { type: 'field_dropdown', name: 'OPTIONAL', options: [['[', 'false'], ['?.[', 'true']] },
        { type: 'input_value', name: 'INDEX', check: expressionCheck },
      ],
      inputsInline: true,
      output: expressionCheck,
      colour: 260,
      tooltip: 'Bracket index access, such as split("a,b", ",")[0].',
    },
    {
      type: 'companion_property_access',
      message0: '%1 %2 property %3',
      args0: [
        { type: 'input_value', name: 'OBJECT', check: expressionCheck },
        { type: 'field_dropdown', name: 'OPTIONAL', options: [['.', 'false'], ['?.', 'true']] },
        { type: 'field_input', name: 'PROPERTY', text: 'length' },
      ],
      inputsInline: true, output: expressionCheck, colour: 260,
      tooltip: 'Read an object property. Choose ?. to safely handle null or undefined.',
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
        { kind: 'block', type: 'companion_assignment' },
        { kind: 'block', type: 'companion_declaration' },
        { kind: 'block', type: 'companion_if_control' },
        { kind: 'block', type: 'companion_while_control' },
        { kind: 'block', type: 'companion_for_of_control' },
        { kind: 'block', type: 'companion_for_control' },
        { kind: 'block', type: 'companion_return' },
        { kind: 'block', type: 'companion_break' },
        { kind: 'block', type: 'companion_continue' },
        { kind: 'block', type: 'companion_expression_statement' },
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
        { kind: 'block', type: 'companion_local_reference' },
        { kind: 'block', type: 'companion_arrow_expression' },
        { kind: 'block', type: 'companion_arrow_block' },
        { kind: 'block', type: 'companion_array' },
        { kind: 'block', type: 'companion_object' },
        { kind: 'block', type: 'companion_spread' },
        { kind: 'block', type: 'companion_template_string' },
        { kind: 'block', type: 'companion_string' },
        { kind: 'block', type: 'companion_number' },
        { kind: 'block', type: 'companion_boolean' },
        { kind: 'block', type: 'companion_null' },
        { kind: 'block', type: 'companion_undefined' },
      ],
    },
    {
      kind: 'category',
      name: 'Functions',
      colour: '120',
      contents: [{ kind: 'block', type: 'companion_function_custom' }, ...functionToolboxContents()],
    },
    {
      kind: 'category',
      name: 'Operators',
      colour: '260',
      contents: [
        { kind: 'block', type: 'companion_unary' },
        { kind: 'block', type: 'companion_binary' },
        { kind: 'block', type: 'companion_index_access' },
        { kind: 'block', type: 'companion_property_access' },
      ],
    },
  ],
}

function defineVariableBlock(): void {
  Blockly.Blocks.companion_variable = {
    init() {
      this.appendDummyInput()
        .appendField('variable $ (')
        .appendField(new Blockly.FieldTextInput('internal:time_hms', normalizeVariableFieldInput), 'NAME')
        .appendField(')')
      this.setOutput(true, expressionCheck)
      this.setColour(170)
      this.setTooltip('A Companion variable reference')
    },
  }
}

export function normalizeVariableFieldInput(value: string): string {
  return unwrapSimpleVariableReference(value.trim()) ?? value
}

function unwrapSimpleVariableReference(value: string): string | null {
  if (!value.startsWith('$(') || !value.endsWith(')')) return null

  const name = value.slice(2, -1)
  if (!name || name.includes('$(')) return null
  return name
}

function defineTemplateStringBlock(): void {
  type DynamicTemplateBlock = Blockly.Block & {
    itemCount_: number
    updateShape_: () => void
  }

  Blockly.Blocks.companion_template_string = {
    init(this: DynamicTemplateBlock) {
      this.itemCount_ = 1
      this.setOutput(true, expressionCheck)
      this.setColour(45)
      this.setInputsInline(false)
      this.setTooltip('A backtick template string with ${...} expression interpolation.')
      this.updateShape_ = () => updateTemplateShape(this)
      this.updateShape_()
    },

    onchange(this: DynamicTemplateBlock) {
      if (!this.workspace || this.isInFlyout) return

      const desiredCount = getDesiredTemplateInputCount(this)
      if (desiredCount !== this.itemCount_) {
        this.itemCount_ = desiredCount
        this.updateShape_()
      }
    },

    saveExtraState(this: DynamicTemplateBlock) {
      return { itemCount: this.itemCount_ }
    },

    loadExtraState(this: DynamicTemplateBlock, state: { itemCount?: number }) {
      this.itemCount_ = Math.max(1, Number(state.itemCount ?? 1))
      this.updateShape_()
    },
  }
}

function updateTemplateShape(block: Blockly.Block & { itemCount_: number }): void {
  if (!block.getInput('TEMPLATE_LABEL')) {
    block.appendDummyInput('TEMPLATE_LABEL').appendField('template')
  }

  for (let index = 0; index < block.itemCount_; index += 1) {
    if (!block.getInput(`TEXT${index}`)) {
      block.appendDummyInput(`TEXT${index}`).appendField('text').appendField(new Blockly.FieldTextInput(''), `TEXT${index}`)
    }
    if (!block.getInput(`EXPR${index}`)) {
      block.appendValueInput(`EXPR${index}`).setCheck(expressionCheck).appendField('${')
    }
    if (!block.getInput(`CLOSE${index}`)) {
      block.appendDummyInput(`CLOSE${index}`).appendField('}')
    }
  }

  if (!block.getInput(`TEXT${block.itemCount_}`)) {
    block.appendDummyInput(`TEXT${block.itemCount_}`)
      .appendField('text')
      .appendField(new Blockly.FieldTextInput(''), `TEXT${block.itemCount_}`)
  }

  for (let index = block.itemCount_ + 1; block.getInput(`TEXT${index}`); index += 1) {
    block.removeInput(`TEXT${index}`)
  }
  for (let index = block.itemCount_; block.getInput(`EXPR${index}`); index += 1) {
    if (index >= block.itemCount_) block.removeInput(`EXPR${index}`)
    if (block.getInput(`CLOSE${index}`)) block.removeInput(`CLOSE${index}`)
  }
}

function getDesiredTemplateInputCount(block: Blockly.Block & { itemCount_: number }): number {
  let highestFilled = -1
  for (let index = 0; index < block.itemCount_; index += 1) {
    if (block.getInputTargetBlock(`EXPR${index}`)) highestFilled = index
  }

  return Math.max(1, highestFilled + 2)
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
    inputsInline: true,
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

function defineCustomFunctionBlock(): void {
  type DynamicCustomBlock = Blockly.Block & { itemCount_: number; updateShape_: () => void }
  Blockly.Blocks.companion_function_custom = {
    init(this: DynamicCustomBlock) {
      this.itemCount_ = 1
      this.setOutput(true, expressionCheck)
      this.setColour(120)
      this.setTooltip('Call an arrow function declared in this expression.')
      this.updateShape_ = () => updateCustomFunctionShape(this)
      this.updateShape_()
    },
    onchange(this: DynamicCustomBlock) {
      if (!this.workspace || this.isInFlyout) return
      const desired = getDesiredVariadicInputCount(this, 1)
      if (desired !== this.itemCount_) { this.itemCount_ = desired; this.updateShape_() }
    },
    saveExtraState(this: DynamicCustomBlock) { return { itemCount: this.itemCount_ } },
    loadExtraState(this: DynamicCustomBlock, state: { itemCount?: number }) { this.itemCount_ = Math.max(1, Number(state.itemCount ?? 1)); this.updateShape_() },
  }
}

function updateCustomFunctionShape(block: Blockly.Block & { itemCount_: number }): void {
  block.setInputsInline(block.itemCount_ <= variadicInlineInputLimit)
  if (!block.getInput('FUNCTION_LABEL')) block.appendDummyInput('FUNCTION_LABEL').appendField('call').appendField(new Blockly.FieldTextInput('myFunction'), 'NAME')
  for (let index = 0; index < block.itemCount_; index += 1) {
    if (!block.getInput(`ARG${index}`)) block.appendValueInput(`ARG${index}`).setCheck(expressionCheck).setAlign(Blockly.inputs.Align.LEFT)
  }
  block.moveInputBefore('FUNCTION_LABEL', 'ARG0')
  for (let index = block.itemCount_; block.getInput(`ARG${index}`); index += 1) block.removeInput(`ARG${index}`)
}

function updateVariadicShape(block: Blockly.Block & { itemCount_: number }, definition: FunctionDefinition): void {
  block.setInputsInline(block.itemCount_ <= variadicInlineInputLimit)

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
