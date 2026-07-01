import { expect, test } from '@playwright/test'

test('imports an expression and restores it after refresh', async ({ page }) => {
  await page.goto('/')

  const expression = '$(custom:state) == "on" ? concat("A", $(internal:time_hms)) : "off"'
  const output = page.getByRole('textbox', { name: 'Expression' })

  await output.fill(expression)
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.getByRole('status')).toHaveText('Imported expression.')
  await expect(output).toHaveValue(expression)

  await page.reload()
  await expect(output).toHaveValue(expression)
})

test('imports variadic function calls', async ({ page }) => {
  await page.goto('/')

  const expression = 'concat("a", "b", "c", "d")'
  const output = page.getByRole('textbox', { name: 'Expression' })

  await output.fill(expression)
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.getByRole('status')).toHaveText('Imported expression.')
  await expect(output).toHaveValue(expression)
})

test('imports nested variables as native variables and serializes parseVariables automatically', async ({ page }) => {
  await page.goto('/')

  const output = page.getByRole('textbox', { name: 'Expression' })

  await output.fill('$(custom:$(custom:b))')
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.getByRole('status')).toHaveText('Imported expression.')
  await expect(output).toHaveValue('parseVariables("$(custom:$(custom:b))")')
})

test('rejects unsupported imports without clearing the workspace', async ({ page }) => {
  await page.goto('/')

  const output = page.getByRole('textbox', { name: 'Expression' })
  const original = await output.inputValue()

  await output.fill('Math.round($(internal:value))')
  await page.getByRole('button', { name: 'Import' }).click()

  await expect(page.getByRole('status')).toContainText('Unsupported function')
  await expect(output).toHaveValue('Math.round($(internal:value))')

  await page.reload()
  await expect(output).toHaveValue(original)
})
