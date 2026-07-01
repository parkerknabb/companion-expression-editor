import { describe, expect, it } from 'vitest'
import { parseExpressionProgram } from '../../src/expression/parse'
import { serializeProgram } from '../../src/expression/serialize'

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
})
