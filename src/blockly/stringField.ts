export function escapeStringField(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')
    .replaceAll('\b', '\\b')
    .replaceAll('\f', '\\f')
    .replaceAll('"', '\\"')
}

export function unescapeStringField(value: string): string {
  let output = ''
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const next = value[index + 1]

    if (char !== '\\' || next === undefined) {
      output += char
      continue
    }

    index += 1
    switch (next) {
      case 'n':
        output += '\n'
        break
      case 'r':
        output += '\r'
        break
      case 't':
        output += '\t'
        break
      case 'b':
        output += '\b'
        break
      case 'f':
        output += '\f'
        break
      case '"':
        output += '"'
        break
      case '\\':
        output += '\\'
        break
      default:
        output += `\\${next}`
        break
    }
  }

  return output
}
