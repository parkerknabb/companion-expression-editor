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
  isExpressionConnection,
  updateBlockWarnings,
} from './blockly/workspace'
import { parseExpressionProgram } from './expression/parse'
import { formatProgram, serializeProgram } from './expression/serialize'
import './style.css'

const storageKey = 'companion-expression-editor.workspace.v1'
const formatStorageKey = 'companion-expression-editor.pretty-output.v1'

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
    </header>

    <section class="workspace-section" aria-label="Expression builder">
      <div id="blocklyDiv" class="blockly-area"></div>
      <aside class="side-panel">
        <div class="expression-header">
          <label class="panel-label" for="expressionOutput">Expression</label>
          <label class="format-toggle">
            <input id="prettyOutput" type="checkbox" checked />
            <span>Pretty print</span>
          </label>
          <button class="copy-button" id="copyExpression" type="button">Copy</button>
        </div>
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
const prettyOutput = requiredElement<HTMLInputElement>('#prettyOutput')
const importExpression = requiredElement<HTMLButtonElement>('#importExpression')
const copyExpression = requiredElement<HTMLButtonElement>('#copyExpression')
const resetWorkspace = requiredElement<HTMLButtonElement>('#resetWorkspace')
const statusMessage = requiredElement<HTMLParagraphElement>('#statusMessage')
let latestWorkspacePointer: Blockly.utils.Coordinate | null = null

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

window.addEventListener('pointermove', (event) => {
  latestWorkspacePointer = eventToWorkspaceCoordinate(workspace, event)
})

restoreFormatPreference()
restoreWorkspace()
ensureDefaultWorkspace(workspace)
syncExpression()

workspace.addChangeListener((event) => {
  if (connectExpressionBlockUnderDropArea(workspace, event)) {
    syncExpression()
    saveWorkspace()
    return
  }

  if (event.isUiEvent) return
  syncExpression()
  saveWorkspace()
})

importExpression.addEventListener('click', () => {
  importExpressionText()
})

prettyOutput.addEventListener('change', () => {
  localStorage.setItem(formatStorageKey, String(prettyOutput.checked))
  syncExpression(prettyOutput.checked ? 'Pretty output enabled.' : 'Compact output enabled.')
})

expressionOutput.addEventListener('paste', (event) => {
  const pastedText = event.clipboardData?.getData('text')
  if (!pastedText) return

  event.preventDefault()
  expressionOutput.value = pastedText
  importExpressionText()
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
    expressionOutput.value = prettyOutput.checked ? formatProgram(program) : serializeProgram(program)
    const warningCount = updateBlockWarnings(workspace)
    setStatus(warningCount > 0 ? `${warningCount} block warning${warningCount === 1 ? '' : 's'} found.` : status, warningCount > 0 ? 'warn' : 'ok')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate expression.'
    setStatus(message, 'error')
  }
}

function importExpressionText(): void {
  try {
    const program = parseExpressionProgram(expressionOutput.value)
    loadProgramIntoWorkspace(workspace, program)
    syncExpression('Imported expression.')
    saveWorkspace()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import expression.'
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

function restoreFormatPreference(): void {
  prettyOutput.checked = localStorage.getItem(formatStorageKey) !== 'false'
}

type BlockDragEvent = Blockly.Events.Abstract & {
  blockId?: string
  isStart?: boolean
}

function connectExpressionBlockUnderDropArea(workspace: Blockly.WorkspaceSvg, event: Blockly.Events.Abstract): boolean {
  if (event.type !== Blockly.Events.BLOCK_DRAG) return false

  const dragEvent = event as BlockDragEvent
  if (dragEvent.isStart !== false || !dragEvent.blockId) return false

  const block = workspace.getBlockById(dragEvent.blockId) as Blockly.BlockSvg | null
  if (!block || !block.outputConnection || block.outputConnection.targetConnection || !latestWorkspacePointer) {
    return false
  }

  const targetConnection = findExpressionInputNearPointer(workspace, block, latestWorkspacePointer)
  if (!targetConnection) return false

  targetConnection.connect(block.outputConnection)
  block.render()
  return true
}

function findExpressionInputNearPointer(
  workspace: Blockly.WorkspaceSvg,
  draggedBlock: Blockly.BlockSvg,
  pointer: Blockly.utils.Coordinate,
): Blockly.Connection | null {
  const draggedIds = new Set(draggedBlock.getDescendants(false).map((block) => block.id))
  const checker = draggedBlock.outputConnection?.getConnectionChecker()
  let closestConnection: Blockly.Connection | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  const searchRadius = 56 / workspace.scale

  if (!draggedBlock.outputConnection || !checker) return null

  workspace.getAllBlocks(false).forEach((block) => {
    if (draggedIds.has(block.id)) return

    block.inputList.forEach((input) => {
      const connection = input.connection
      if (!connection || connection.type !== Blockly.INPUT_VALUE || connection.targetConnection) return
      if (!isExpressionConnection(connection)) return
      if (!checker.canConnect(draggedBlock.outputConnection, connection, false)) return

      const distance = Blockly.utils.Coordinate.distance(pointer, new Blockly.utils.Coordinate(connection.x, connection.y))
      if (distance > searchRadius) return

      if (distance < closestDistance) {
        closestConnection = connection
        closestDistance = distance
      }
    })
  })

  return closestConnection
}

function eventToWorkspaceCoordinate(
  workspace: Blockly.WorkspaceSvg,
  event: PointerEvent,
): Blockly.utils.Coordinate | null {
  const svgPoint = Blockly.browserEvents.mouseToSvg(
    event as MouseEvent,
    workspace.getParentSvg(),
    workspace.getInverseScreenCTM(),
  )
  const canvasPosition = workspace.getSvgXY(workspace.getCanvas())
  return new Blockly.utils.Coordinate(
    (svgPoint.x - canvasPosition.x) / workspace.scale,
    (svgPoint.y - canvasPosition.y) / workspace.scale,
  )
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
