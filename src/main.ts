import * as Blockly from 'blockly/core'
import 'blockly/blocks'
import * as En from 'blockly/msg/en'
import { defineCompanionBlocks, toolbox } from './blockly/blocks'
import {
  ensureDefaultWorkspace,
  loadProgramIntoWorkspace,
  workspaceLoad,
  workspaceSave,
  workspaceToProgram,
} from './blockly/workspace'
import { parseExpressionProgram } from './expression/parse'
import { serializeProgram } from './expression/serialize'
import './style.css'

const storageKey = 'companion-expression-editor.workspace.v1'

defineCompanionBlocks()
Blockly.setLocale(blocklyLocale(En))

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('App root is missing.')

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <h1>Companion Expression Editor</h1>
        <p>Build Bitfocus Companion button expressions visually, then copy the expression.</p>
      </div>
      <button class="copy-button" id="copyExpression" type="button">Copy</button>
    </header>

    <section class="workspace-section" aria-label="Expression builder">
      <div id="blocklyDiv" class="blockly-area"></div>
      <aside class="side-panel">
        <label class="panel-label" for="expressionOutput">Expression</label>
        <textarea id="expressionOutput" class="expression-output" spellcheck="false"></textarea>

        <div class="button-row">
          <button id="importExpression" type="button">Import</button>
          <button id="resetWorkspace" type="button">Reset</button>
        </div>

        <p id="statusMessage" class="status" role="status"></p>
      </aside>
    </section>
  </main>
`

const blocklyDiv = requiredElement<HTMLDivElement>('#blocklyDiv')
const expressionOutput = requiredElement<HTMLTextAreaElement>('#expressionOutput')
const importExpression = requiredElement<HTMLButtonElement>('#importExpression')
const copyExpression = requiredElement<HTMLButtonElement>('#copyExpression')
const resetWorkspace = requiredElement<HTMLButtonElement>('#resetWorkspace')
const statusMessage = requiredElement<HTMLParagraphElement>('#statusMessage')

const workspace = Blockly.inject(blocklyDiv, {
  toolbox,
  renderer: 'zelos',
  trashcan: true,
  zoom: {
    controls: true,
    wheel: true,
    startScale: 0.9,
    maxScale: 1.4,
    minScale: 0.5,
    scaleSpeed: 1.1,
  },
  move: {
    scrollbars: true,
    drag: true,
    wheel: true,
  },
})

restoreWorkspace()
ensureDefaultWorkspace(workspace)
syncExpression()

workspace.addChangeListener((event) => {
  if (event.isUiEvent) return
  syncExpression()
  saveWorkspace()
})

importExpression.addEventListener('click', () => {
  try {
    const program = parseExpressionProgram(expressionOutput.value)
    loadProgramIntoWorkspace(workspace, program)
    syncExpression('Imported expression.')
    saveWorkspace()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import expression.'
    setStatus(message, 'error')
  }
})

copyExpression.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(expressionOutput.value)
    setStatus('Expression copied.', 'ok')
  } catch {
    expressionOutput.select()
    setStatus('Clipboard access was unavailable; expression text is selected.', 'warn')
  }
})

resetWorkspace.addEventListener('click', () => {
  localStorage.removeItem(storageKey)
  workspace.clear()
  ensureDefaultWorkspace(workspace)
  syncExpression('Workspace reset.')
  saveWorkspace()
})

window.addEventListener('resize', () => Blockly.svgResize(workspace))

function syncExpression(status = 'Workspace saved locally.'): void {
  try {
    const program = workspaceToProgram(workspace)
    expressionOutput.value = serializeProgram(program)
    setStatus(status, 'ok')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate expression.'
    setStatus(message, 'error')
  }
}

function saveWorkspace(): void {
  localStorage.setItem(storageKey, JSON.stringify(workspaceSave(workspace)))
}

function restoreWorkspace(): void {
  const saved = localStorage.getItem(storageKey)
  if (!saved) return
  try {
    workspaceLoad(workspace, JSON.parse(saved) as object)
  } catch {
    localStorage.removeItem(storageKey)
  }
}

function setStatus(message: string, tone: 'ok' | 'warn' | 'error'): void {
  statusMessage.textContent = message
  statusMessage.dataset.tone = tone
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing element ${selector}`)
  return element
}

function blocklyLocale(locale: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(locale).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}
