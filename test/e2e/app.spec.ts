import { expect, test } from '@playwright/test'

test('imports an expression and restores it after refresh', async ({ page }) => {
  await page.goto('/')

  const expression = '$(custom:state) == "on" ? concat("A", $(internal:time_hms)) : "off"'
  const formattedExpression = [
    '$(custom:state) == "on"',
    '  ? concat("A", $(internal:time_hms))',
    '  : "off"',
  ].join('\n')
  const output = page.getByRole('textbox', { name: 'Expression' })

  await output.fill(expression)
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.locator('#statusMessage')).toHaveText('Imported expression.')
  await expect(output).toHaveValue(formattedExpression)

  await page.reload()
  await expect(output).toHaveValue(formattedExpression)
})

test('auto-imports pasted expressions', async ({ page, browserName }) => {
  await page.goto('/')

  const expression = '$(custom:state) == "on" ? concat("A", $(internal:time_hms)) : "off"'
  const formattedExpression = [
    '$(custom:state) == "on"',
    '  ? concat("A", $(internal:time_hms))',
    '  : "off"',
  ].join('\n')
  const output = page.getByRole('textbox', { name: 'Expression' })

  if (browserName === 'chromium') {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  }
  await page.evaluate((text) => navigator.clipboard.writeText(text), expression)
  await output.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')

  await expect(page.locator('#statusMessage')).toHaveText('Imported expression.')
  await expect(output).toHaveValue(formattedExpression)
})

test('toggles expression output between pretty and compact formatting', async ({ page }) => {
  await page.goto('/')

  const expression = '$(custom:state) == "on" ? concat("A", $(internal:time_hms)) : "off"'
  const formattedExpression = [
    '$(custom:state) == "on"',
    '  ? concat("A", $(internal:time_hms))',
    '  : "off"',
  ].join('\n')
  const output = page.getByRole('textbox', { name: 'Expression' })
  const prettyToggle = page.getByLabel('Pretty print')

  await output.fill(expression)
  await page.getByRole('button', { name: 'Import' }).click()
  await expect(output).toHaveValue(formattedExpression)

  await prettyToggle.uncheck()
  await expect(page.locator('#statusMessage')).toHaveText('Compact output enabled.')
  await expect(output).toHaveValue(expression)

  await page.reload()
  await expect(prettyToggle).not.toBeChecked()
  await expect(output).toHaveValue(expression)
})

test('imports variadic function calls', async ({ page }) => {
  await page.goto('/')

  const expression = 'concat("a", "b", "c", "d")'
  const formattedExpression = [
    'concat(',
    '    "a",',
    '    "b",',
    '    "c",',
    '    "d"',
    '  )',
  ].join('\n')
  const output = page.getByRole('textbox', { name: 'Expression' })

  await output.fill(expression)
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.locator('#statusMessage')).toHaveText('Imported expression.')
  await expect(output).toHaveValue(formattedExpression)
})

test('requires parseVariables for nested variables', async ({ page }) => {
  await page.goto('/')

  const output = page.getByRole('textbox', { name: 'Expression' })

  await output.fill('$(custom:$(custom:b))')
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.locator('#statusMessage')).toContainText('Nested variable references must use parseVariables')
  await expect(output).toHaveValue('$(custom:$(custom:b))')
})

test('imports template strings and local assignments', async ({ page }) => {
  await page.goto('/')

  const output = page.getByRole('textbox', { name: 'Expression' })

  await output.fill('myval = $(custom:a) + $(custom:b)\n`${myval}dB`')
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.locator('#statusMessage')).toHaveText('Imported expression.')
  await expect(output).toHaveValue('myval = $(custom:a) + $(custom:b);\n`${myval}dB`')
})

test('imports json helpers and split index access', async ({ page }) => {
  await page.goto('/')

  const output = page.getByRole('textbox', { name: 'Expression' })
  const expression = 'jsonpath(jsonparse($(custom:payload)), "$.items[0].name");\nsplit($(custom:csv), ",")[2]'

  await output.fill(expression)
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.locator('#statusMessage')).toHaveText('Imported expression.')
  await expect(output).toHaveValue(expression)
})

test('imports Companion 5.0 control flow as Blockly statements', async ({ page }) => {
  await page.goto('/')

  const output = page.getByRole('textbox', { name: 'Expression' })
  const expression = 'let total = 0;\nfor (let item of $(custom:items)) {\n  if (item?.enabled ?? false) {\n    total = total + 1;\n  }\n}\ntotal'

  await output.fill(expression)
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.locator('#statusMessage')).toHaveText('Imported expression.')
  await expect(page.getByText('for each')).toBeVisible()
  await expect(output).toHaveValue(/for \(let item of \$\(custom:items\)\)/)
  await expect(output).toHaveValue(/item\?\.enabled \?\? false/)
})

test('shows escaped control characters in imported text blocks', async ({ page }) => {
  await page.goto('/')

  const output = page.getByRole('textbox', { name: 'Expression' })

  await output.fill('"Line\\nTwo"')
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.locator('#statusMessage')).toHaveText('Imported expression.')
  await expect(page.getByText('Line\\nTwo')).toBeVisible()
  await expect(output).toHaveValue('"Line\\nTwo"')
})

test('rejects unsupported imports without clearing the workspace', async ({ page }) => {
  await page.goto('/')

  const output = page.getByRole('textbox', { name: 'Expression' })
  const original = await output.inputValue()

  await output.fill('Math.round($(internal:value))')
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.locator('#statusMessage')).toContainText('Unsupported function')
  await expect(output).toHaveValue('Math.round($(internal:value))')

  await page.reload()
  await expect(output).toHaveValue(original)
})

test('rejects shorthand logical comparisons', async ({ page }) => {
  await page.goto('/')

  const output = page.getByRole('textbox', { name: 'Expression' })

  await output.fill('$(atem:pgm1_input) == ("CAM 1" || "Black")')
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.locator('#statusMessage')).toContainText('Compare each condition directly')
  await expect(output).toHaveValue('$(atem:pgm1_input) == ("CAM 1" || "Black")')
})
