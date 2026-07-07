import { describe, expect, it } from 'vitest'
import { parseExpressionProgram } from '../../src/expression/parse'
import { formatProgram, serializeProgram } from '../../src/expression/serialize'

describe('expression parsing and serialization', () => {
  it('round-trips Companion variables', () => {
    const program = parseExpressionProgram('$(internal:time_hms)')

    expect(serializeProgram(program)).toBe('$(internal:time_hms)')
  })

  it('round-trips nested ternaries and concat', () => {
    const program = parseExpressionProgram('$(custom:state) == "on" ? concat("A", $(internal:time_hms)) : "off"')

    expect(serializeProgram(program)).toBe('$(custom:state) == "on" ? concat("A", $(internal:time_hms)) : "off"')
  })

  it('round-trips toFixed and binary expressions', () => {
    const program = parseExpressionProgram('toFixed($(internal:cpu) / 100, 2)')

    expect(serializeProgram(program)).toBe('toFixed($(internal:cpu) / 100, 2)')
  })

  it('round-trips high-value numeric and string helpers', () => {
    const program = parseExpressionProgram('round(abs($(custom:level))) + strlen(trim(" hi "))')

    expect(serializeProgram(program)).toBe('round(abs($(custom:level))) + strlen(trim(" hi "))')
  })

  it('round-trips unary operators and extra binary operators', () => {
    const program = parseExpressionProgram('!$(custom:enabled) || ($(custom:mask) & 4) == 4')

    expect(serializeProgram(program)).toBe('!$(custom:enabled) || ($(custom:mask) & 4) == 4')
  })

  it('rejects shorthand comparisons against logical string choices', () => {
    expect(() => parseExpressionProgram('$(atem:pgm1_input) == ("CAM 1" || "Black")')).toThrow(
      'Compare each condition directly',
    )
    expect(() => parseExpressionProgram('$(atem:pgm1_input) == "CAM 1" || "Black"')).toThrow(
      'Compare each condition directly',
    )
  })

  it('accepts repeated direct comparisons for multiple choices', () => {
    const program = parseExpressionProgram('$(atem:pgm1_input) == "CAM 1" || $(atem:pgm1_input) == "Black"')

    expect(serializeProgram(program)).toBe('$(atem:pgm1_input) == "CAM 1" || $(atem:pgm1_input) == "Black"')
  })

  it('serializes nested variable references with parseVariables automatically', () => {
    const program = parseExpressionProgram('$(custom:$(custom:b))')

    expect(serializeProgram(program)).toBe('parseVariables("$(custom:$(custom:b))")')
  })

  it('imports parseVariables around a single variable reference as a native variable', () => {
    const program = parseExpressionProgram('parseVariables("$(custom:$(custom:b))")')

    expect(program.statements[0]).toEqual({ type: 'Variable', name: 'custom:$(custom:b)' })
    expect(serializeProgram(program)).toBe('parseVariables("$(custom:$(custom:b))")')
  })

  it('round-trips time helpers', () => {
    const program = parseExpressionProgram('secondsToTimestamp(timeDiff($(internal:time_hms), "18:00:00"))')

    expect(serializeProgram(program)).toBe(
      'secondsToTimestamp(timeDiff($(internal:time_hms), "18:00:00"))',
    )
  })

  it('keeps multi-line statements separated by semicolons', () => {
    const program = parseExpressionProgram('concat("prefix", $(custom:name));\n$(custom:enabled) ? "yes" : "no"')

    expect(serializeProgram(program)).toBe('concat("prefix", $(custom:name));\n$(custom:enabled) ? "yes" : "no"')
  })

  it('rejects unsupported functions with a specific error', () => {
    expect(() => parseExpressionProgram('Math.round($(internal:value))')).toThrow('Unsupported function "anonymous".')
  })

  it('round-trips variadic concat, min, and max calls', () => {
    const program = parseExpressionProgram('concat("a", "b", "c", "d");\nmax(1, 2, 3, 4) + min(5, 6, 7, 8)')

    expect(serializeProgram(program)).toBe('concat("a", "b", "c", "d");\nmax(1, 2, 3, 4) + min(5, 6, 7, 8)')
  })

  it('round-trips jsonparse and jsonpath helpers', () => {
    const program = parseExpressionProgram('jsonpath(jsonparse($(custom:payload)), "$.items[0].name")')

    expect(serializeProgram(program)).toBe('jsonpath(jsonparse($(custom:payload)), "$.items[0].name")')
  })

  it('round-trips split index access syntax', () => {
    const program = parseExpressionProgram('split($(custom:csv), ",")[2]')

    expect(program.statements[0]).toEqual({
      type: 'IndexAccess',
      object: {
        type: 'FunctionCall',
        name: 'split',
        args: [
          { type: 'Variable', name: 'custom:csv' },
          { type: 'Literal', value: ',' },
        ],
      },
      index: { type: 'Literal', value: 2 },
    })
    expect(serializeProgram(program)).toBe('split($(custom:csv), ",")[2]')
  })

  it('parses template strings with Companion variable interpolation', () => {
    const program = parseExpressionProgram('`${$(custom:a)}dB`')

    expect(program.statements[0]).toEqual({
      type: 'TemplateString',
      parts: ['', { type: 'Variable', name: 'custom:a' }, 'dB'],
    })
    expect(serializeProgram(program)).toBe('`${$(custom:a)}dB`')
  })

  it('parses newline-separated local assignments and references', () => {
    const program = parseExpressionProgram('myval = $(custom:a) + $(custom:b)\nmyval / 2')

    expect(program.statements).toEqual([
      {
        type: 'Assignment',
        name: 'myval',
        value: {
          type: 'BinaryExpression',
          operator: '+',
          left: { type: 'Variable', name: 'custom:a' },
          right: { type: 'Variable', name: 'custom:b' },
        },
      },
      {
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'LocalReference', name: 'myval' },
        right: { type: 'Literal', value: 2 },
      },
    ])
    expect(serializeProgram(program)).toBe('myval = $(custom:a) + $(custom:b);\nmyval / 2')
  })

  it('formats ternaries while keeping small variadic calls inline', () => {
    const program = parseExpressionProgram(
      '$(custom:isDialsOnGuests) == "true" ? concat("GST 1\\n", concat(toFixed($(x32:fader_ch_09), 1), " dB")) : concat("LAV 1\\n", $(custom:audio_lav_button_held) == "true" ? concat($(sennheiser-ewdx-12:tx1_batteryGauge), "%") : concat(toFixed($(x32:fader_ch_01), 1), " dB"))',
    )

    expect(formatProgram(program)).toBe(
      [
        '$(custom:isDialsOnGuests) == "true"',
        '  ? concat("GST 1\\n", concat(toFixed($(x32:fader_ch_09), 1), " dB"))',
        '  : concat("LAV 1\\n", $(custom:audio_lav_button_held) == "true" ? concat($(sennheiser-ewdx-12:tx1_batteryGauge), "%") : concat(toFixed($(x32:fader_ch_01), 1), " dB"))',
      ].join('\n'),
    )
  })

  it('formats variadic functions inline up to three args and vertically after that', () => {
    const program = parseExpressionProgram('concat("a", "b", "c");\nmax(1, 2, 3, 4)')

    expect(formatProgram(program)).toBe(
      [
        'concat("a", "b", "c");',
        'max(',
        '    1,',
        '    2,',
        '    3,',
        '    4',
        '  )',
      ].join('\n'),
    )
  })
})
