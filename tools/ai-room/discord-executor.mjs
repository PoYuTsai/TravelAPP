import { createDevLoop } from './dev-loop.mjs'
import { dispatchCcRequest } from './cc-dispatch.mjs'
import { createLiveAmbientReply } from './ai-responder.mjs'
import { clearDiscordChannelMessages } from './discord-channel-cleaner.mjs'
import {
  formatDiscordActionResult,
  formatDiscordHealth,
  formatDiscordInventory,
} from './discord-format.mjs'
import { buildHealthReport } from './health.mjs'
import { createLifecycle } from './lifecycle.mjs'
import { buildSessionInventory } from './session-inventory.mjs'
import {
  readCurrentState,
  switchChatMode,
  switchFocus,
  switchMode,
  writeCurrentState,
} from './state-store.mjs'
import { createTmuxAdapter } from './tmux-adapter.mjs'

export async function executeDiscordDecision(decision, options = {}) {
  if (!decision.allowed) {
    return executeDeniedDecision(decision)
  }

  try {
    switch (decision.intent) {
      case 'sessions':
        return reply(await executeSessions(options))
      case 'focus_status':
        return reply(await executeFocusStatus(options))
      case 'focus_switch':
        return reply(await executeFocusSwitch(decision, options))
      case 'health_check':
        return reply(await executeHealth(options))
      case 'mode_status':
        return reply(await executeModeStatus(options))
      case 'mode_switch':
        return reply(await executeModeSwitch(decision, options))
      case 'chat_mode_status':
        return reply(await executeChatModeStatus(options))
      case 'chat_mode_switch':
        return reply(await executeChatModeSwitch(decision, options))
      case 'chat_clear':
        return reply(formatChatClearResult(await executeChatClear(decision, options)), {
          ephemeral: true,
        })
      case 'round':
      case 'clear':
      case 'interrupt':
      case 'rebind':
        return reply(await executeLifecycle(decision, options))
      case 'ambient_chat':
        return reply(await executeAmbientChat(decision, options))
      case 'two_agent_question':
        return reply(formatTwoAgentQuestion(firstArg(decision)))
      case 'session_peek':
        return reply(await executeSessionPeek(options))
      default:
        return reply(await executeAgentIntent(decision, options))
    }
  } catch (error) {
    return reply(`[Room/error] ${formatExecutionError(error)}`, {
      ...(decision.intent === 'chat_clear' && { ephemeral: true }),
    })
  }
}

async function executeChatClear(decision, options) {
  return clearDiscordChannelMessages({
    channel: options.discordChannel,
    actorId: decision.actor,
    count: parseChatClearCount(decision.args),
    confirm: hasChatClearConfirmation(decision.args),
    stateDir: options.stateDir,
    now: options.now,
  })
}

function executeDeniedDecision(decision) {
  if (decision.intent === 'ignore') {
    return {
      shouldReply: false,
      content: '',
      decision,
    }
  }
  return reply(`[Room/denied] ${decision.reason}`)
}

async function executeSessions(options) {
  const state = await readState(options)
  const tmux = getTmux(options)
  const liveSessions = await tmux.listSessions()
  const inventory = buildSessionInventory({
    focus: state.focus,
    liveSessions,
  })
  return formatDiscordInventory({ focus: state.focus, inventory })
}

async function executeFocusStatus(options) {
  const state = await readState(options)
  return [
    `[Room/focus] ${state.focus} (${state.project})`,
    `active: ${state.activeSession}`,
    `legacy: ${state.legacySession} (read-only by default)`,
    `mode: ${state.mode}`,
    `shipMode: ${state.shipMode}`,
    `health: ${state.sessionHealth}`,
    `next: ${state.nextAction}`,
  ].join('\n')
}

async function executeFocusSwitch(decision, options) {
  const [requestedFocus, ...flags] = decision.args ?? []
  if (!requestedFocus || requestedFocus === 'status') {
    return executeFocusStatus(options)
  }

  const current = await readState(options)
  if (!hasConfirmation(flags)) {
    return [
      '[Room/focus] confirmation required',
      `current: ${current.focus} (${current.activeSession})`,
      `requested: ${requestedFocus}`,
      `run: /focus ${requestedFocus} confirm`,
    ].join('\n')
  }

  const next = await switchFocus(requestedFocus, {
    stateDir: options.stateDir,
    actor: decision.actor,
    now: options.now,
  })
  return [
    `[Room/focus] switched to ${next.focus}`,
    `project: ${next.project}`,
    `active: ${next.activeSession}`,
    `legacy: ${next.legacySession} (read-only by default)`,
    'shared focus updated for both @cc and @codex',
  ].join('\n')
}

async function executeHealth(options) {
  const state = await readState(options)
  const tmux = getTmux(options)
  const liveSessions = await tmux.listSessions()
  const cwdBySession = await readKnownCwds(tmux, liveSessions)
  const report = buildHealthReport({
    focus: state.focus,
    liveSessions,
    cwdBySession,
    desktopBindConfirmed: state.desktopBindConfirmed === true,
  })

  await writeCurrentState(
    {
      ...state,
      sessionHealth: report.sessionHealth,
      blockers: report.blockers,
      nextAction: nextActionForHealth(report),
    },
    { stateDir: options.stateDir }
  )

  return formatDiscordHealth(report)
}

async function executeModeStatus(options) {
  const state = await readState(options)
  return [
    `[Room/mode] ${state.mode}`,
    `shipMode: ${state.shipMode}`,
    `focus: ${state.focus} -> ${state.activeSession}`,
    `next: ${state.nextAction}`,
  ].join('\n')
}

async function executeModeSwitch(decision, options) {
  const [requestedMode, ...flags] = decision.args ?? []
  if (!requestedMode || requestedMode === 'status') {
    return executeModeStatus(options)
  }

  if (requestedMode === 'autopilot_ship' && !hasConfirmation(flags)) {
    const state = await readState(options)
    return [
      '[Room/mode] confirmation required',
      `current: ${state.mode} / ${state.shipMode}`,
      'autopilot_ship allows reviewed work to proceed to commit/push inside the active focus.',
      'deploy, secrets, dc-* writes, and production changes are still hard gates.',
      'run: /mode autopilot_ship confirm',
    ].join('\n')
  }

  const next = await switchMode(requestedMode, {
    stateDir: options.stateDir,
    actor: decision.actor,
    now: options.now,
  })
  return [
    `[Room/mode] ${next.mode}`,
    `shipMode: ${next.shipMode}`,
    `focus: ${next.focus} -> ${next.activeSession}`,
    `next: ${next.nextAction}`,
  ].join('\n')
}

async function executeChatModeStatus(options) {
  const state = await readState(options)
  return [
    `[Room/chat-mode] ${state.chatMode ?? 'balanced'}`,
    chatModeDescription(state.chatMode ?? 'balanced'),
    'tag @cc 或 @codex 時仍會照分工；不 tag 才套用這個聊天模式。',
  ].join('\n')
}

async function executeChatModeSwitch(decision, options) {
  const [requestedChatMode] = decision.args ?? []
  if (!requestedChatMode || requestedChatMode === 'status') {
    return executeChatModeStatus(options)
  }

  const next = await switchChatMode(requestedChatMode, {
    stateDir: options.stateDir,
    actor: decision.actor,
    now: options.now,
  })
  return [
    `[Room/chat-mode] ${next.chatMode}`,
    chatModeDescription(next.chatMode),
    `next: ${next.nextAction}`,
  ].join('\n')
}

async function executeSessionPeek(options) {
  const state = await readState(options)
  const tmux = getTmux(options)
  const liveSessions = await tmux.listSessions()

  if (!liveSessions.includes(state.activeSession)) {
    return [
      `[Room/peek] ${state.activeSession}`,
      `看不到。active rc session 目前不存在或 tmux 沒列出來。`,
      `focus: ${state.focus} (${state.project})`,
      'read-only: no tmux write',
      '可以先跑 /sessions 或 /health 看是哪個環節斷掉。',
    ].join('\n')
  }

  const captured = await tmux.capturePane(state.activeSession)
  return formatSessionPeek({ state, captured })
}

async function executeLifecycle(decision, options) {
  const tmux = getTmux(options)
  const lifecycle = createLifecycle({
    tmux,
    stateDir: options.stateDir,
    now: options.now,
  })
  const args = decision.args ?? []
  let result

  if (decision.intent === 'round') {
    result = await lifecycle.round({ dryRun: !hasConfirmation(args) })
  } else if (decision.intent === 'clear') {
    result = await lifecycle.clear({
      dryRun: !hasConfirmation(args),
      force: args.includes('force') || args.includes('--force'),
    })
  } else if (decision.intent === 'interrupt') {
    result = await lifecycle.interrupt({ confirm: hasConfirmation(args) })
  } else {
    result = await lifecycle.rebind()
  }

  return formatDiscordActionResult({
    label: `CC/${result.session ?? 'room'}`,
    result,
  })
}

async function executeAmbientChat(decision, options) {
  const state = await readState(options)
  const body = firstArg(decision)
  createDevLoop({
    focus: state.focus,
    activeSession: state.activeSession,
    request: body,
    maxAgentTurns: decision.maxAgentTurns ?? 2,
    shipMode: state.shipMode,
  })

  const liveReply = await createLiveAmbientReply(
    { state, body },
    { env: options.env, fetch: options.fetch }
  )
  if (liveReply) return liveReply

  if (state.chatMode === 'casual') {
    return formatLocalChatSupport({ body })
  }
  if (state.chatMode === 'work') {
    return formatRoundtableChat({ state, body })
  }

  if (isCasualChat(body)) {
    return formatCasualChat({ body })
  }
  if (isEmotionalSmallTalk(body)) {
    return formatEmotionalSmallTalk({ body })
  }

  return formatRoundtableChat({ state, body })
}

async function executeAgentIntent(decision, options) {
  const state = await readState(options)

  if (decision.targetAgent === 'codex') {
    return formatCodexIntent(decision, state)
  }

  if (decision.targetAgent === 'cc' && decision.intent === 'status') {
    return formatCcStatus(state)
  }

  if (decision.targetAgent === 'cc' || decision.requiresWrite) {
    if (decision.targetAgent === 'cc' && hasDispatchConfirmation(firstArg(decision))) {
      const result = await dispatchCcRequest(
        {
          actor: decision.actor,
          body: stripDispatchConfirmation(firstArg(decision)),
        },
        options
      )
      return formatDispatchResult(result)
    }

    const loop = createDevLoop({
      focus: state.focus,
      activeSession: state.activeSession,
      request: requestForLoop(decision),
      maxAgentTurns: decision.maxAgentTurns ?? 3,
      shipMode: state.shipMode,
    })
    return formatDevLoop(loop)
  }

  return `[Room/intent] ${decision.intent} -> ${decision.targetAgent}`
}

function formatCodexIntent(decision, state) {
  const intent = decision.intent === 'review' ? 'review' : 'plan'
  const body = firstArg(decision)
  const headline =
    intent === 'review'
      ? '我負責 review 範圍、邏輯、邊界、測試與驗證，再決定要不要讓 @cc 繼續。'
      : '我負責幫你收斂目標、整理規格、拆出下一個可以執行的小步驟。'

  return [
    `[Codex/${intent}] 焦點: ${state.focus} -> ${state.activeSession}`,
    headline,
    body ? `需求: ${body}` : '需求: 目前 focus context',
    '不會寫入 tmux',
  ].join('\n')
}

function formatCcStatus(state) {
  return [
    `[CC/status] 焦點: ${state.focus} -> ${state.activeSession}`,
    `專案: ${state.project}`,
    '我目前待命；只有你加上 --confirm 時，我才會把任務送進 active rc tmux session。',
    '不會寫入 tmux',
  ].join('\n')
}

function chatModeDescription(chatMode) {
  if (chatMode === 'casual') {
    return 'casual: 寒暄、閒聊、心情、事件分享會優先得到陪伴與支持，不會自動轉成任務。'
  }
  if (chatMode === 'work') {
    return 'work: 未 tag 訊息會優先進入 Codex + Claude Code 工作圓桌，用來收斂規格、風險與下一步。'
  }
  return 'balanced: 系統會在閒聊支持與工作圓桌之間自動判斷。'
}

function formatLocalChatSupport({ body }) {
  const text = String(body ?? '').trim()
  const hasEvent = /[，,。]|今天|剛剛|出去|小孩|開心|累|煩|難過|分享|發生/.test(text)

  if (hasEvent) {
    return [
      '[Codex] 聽起來你今天有真的在生活裡跑了一段，累跟開心可以同時存在。先不用急著整理成結論，我在這邊接住你說的。',
      '[CC] 收到，這種分享不用轉成任務。我先陪你輕鬆聊，真的要動工、切 session 或丟給我執行時，你再叫我就好。',
    ].join('\n')
  }

  return [
    '[Codex] 我在。聽起來你現在比較想輕鬆講幾句，不用轉成任務也沒關係。',
    '[CC] 我也在旁邊待命。先聊天、放鬆、整理一下心情都可以；要開工再 tag 我。',
  ].join('\n')
}

function formatSessionPeek({ state, captured }) {
  const lines = recentPaneLines(captured)
  return [
    `[Room/peek] ${state.activeSession}`,
    '看得到。這是 active rc session 的 read-only 畫面摘要，不會寫入 tmux。',
    `focus: ${state.focus} (${state.project})`,
    'recent pane:',
    ...(lines.length ? lines : ['(目前 pane 沒有可讀文字)']),
  ].join('\n')
}

function recentPaneLines(captured) {
  return String(captured ?? '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
    .slice(-8)
}

function formatTwoAgentQuestion(body) {
  const question = String(body ?? '').trim()
  return [
    question ? `[Room/roundtable] 你的問題: ${question}` : '[Room/roundtable] 兩位角色觀點',
    '[Codex] 我的優勢是幫你把問題放慢、拆清楚、抓風險、收斂規格，適合做架構判斷、需求釐清、review、測試邊界和決策整理。我的缺點是如果要直接操作長流程實作，我會比較適合先把路線寫清楚，再交給 @cc 跑。',
    '[CC] 我的優勢是把已經收斂好的規格變成具體實作、跑 lint/test/build、修 bug、整理執行結果。我的缺點是如果需求還很發散，我可能會太快進入動手，所以最好先讓 Codex 幫你收斂。',
    '分工建議: 你先跟 Codex 討論方向與驗收標準；要動工時用 /cc 或 @cc 指派。完成後再叫 Codex review。需要真的寫入 active rc session 時，再加 --confirm。',
  ].join('\n')
}

function formatRoundtableChat({ state, body }) {
  const request = body || '目前沒有具體問題，我們先以當前 focus 給你兩種觀點。'

  return [
    `[Room/roundtable] 焦點: ${state.focus} (${state.project})`,
    `你的問題: ${request}`,
    '兩種觀點如下；這輪不會寫入 tmux。',
    '[Codex] Codex 視角: 我會先看目標是否清楚、範圍會不會失焦、有哪些風險或驗證點需要先講明。我的建議是先把問題收斂成一個可決策的小題目，再決定要不要交給 @cc。',
    '[CC] Claude Code 視角: 我會從落地順序看下一步能不能安全執行、需要讀哪些檔、要跑哪些最小驗證。沒有 --confirm 時，我只會給執行建議，不會把任何內容送進 tmux。',
  ].join('\n')
}

function formatCasualChat({ body }) {
  if (/晚安|睡|休息/i.test(body)) {
    return [
      '[Codex] 晚安，今天辛苦了。腦袋可以先放下，明天我們再慢慢接回來。',
      '[CC] 晚安，我也先待命。明天要接著做的時候叫我就好。',
    ].join('\n')
  }

  if (/晚上好/i.test(body)) {
    return [
      '[Codex] 晚上好，今天辛苦了。先把呼吸放慢一點，我在這邊陪你收尾。',
      '[CC] 晚上好，我也在。今晚不用急著開工，需要我時再叫我就好。',
    ].join('\n')
  }

  if (/早安|午安|嗨|哈囉|hello|hi|hey/i.test(body)) {
    return [
      '[Codex] 嗨，我在。今天可以先從最需要收斂的那件事開始。',
      '[CC] 我也在。你丟方向，我幫你把下一步整理成可執行的動作。',
    ].join('\n')
  }

  if (/謝謝|感謝|辛苦/i.test(body)) {
    return [
      '[Codex] 不客氣，今天這樣推進得很穩。',
      '[CC] 收到，辛苦了。需要我接下一段時再叫我。',
    ].join('\n')
  }

  return [
    '[Codex] 收到，我在這邊。',
    '[CC] 收到，我也待命。',
  ].join('\n')
}

function formatEmotionalSmallTalk({ body }) {
  if (/累|疲|煩|亂|低落|卡|壓力|焦慮|不想動|想閒聊/i.test(body)) {
    return [
      '[Codex] 我在。今天辛苦了，先不用急著產出，能把狀態說出來就已經是在照顧自己了。',
      '[CC] 我也在旁邊待命。今晚可以不用推進任務，我們慢慢聊，等你想動再動。',
    ].join('\n')
  }

  return [
    '[Codex] 我在，先陪你把情緒放一下。',
    '[CC] 我也在，不急著做事，先陪你聊。',
  ].join('\n')
}

function isCasualChat(body) {
  const text = String(body ?? '').trim()
  if (!text || text.length > 30) return false
  return /^(各位|大家|你們|兩位)?\s*(晚安|晚上好|早安|午安|嗨|哈囉|hello|hi|hey|謝謝|感謝|辛苦了|辛苦|先休息|我先休息|睡了|晚點聊)[。！!～~\s]*$/i.test(text)
}

function isEmotionalSmallTalk(body) {
  const text = String(body ?? '').trim()
  if (!text || text.length > 80) return false
  return /(累|疲|煩|心情|低落|焦慮|壓力|有點亂|腦袋亂|不想動|想閒聊|陪我聊|聊一下|今天.*辛苦)/i.test(text)
}

function formatDevLoop(loop) {
  const lines = [`[Room/dev-loop] ${loop.state}`, `focus: ${loop.focus}`]
  if (loop.activeSession) lines.push(`active: ${loop.activeSession}`)
  if (loop.blockers?.length) {
    for (const blocker of loop.blockers) lines.push(`BLOCKER: ${blocker}`)
  }
  for (const step of loop.steps) {
    const target = step.targetSession ? ` -> ${step.targetSession}` : ''
    lines.push(`${step.actor}: ${step.action}${target}`)
  }
  if (loop.steps.some((step) => step.requiresWrite)) {
    lines.push('tmux write pending Eric confirmation')
  } else {
    lines.push('no tmux write')
  }
  return lines.join('\n')
}

function formatDispatchResult(result) {
  const lines = [`[CC/${result.session}] ${result.action}`]
  lines.push(`status: ${result.allowed ? 'sent' : 'blocked'}`)
  if (result.lockMode) lines.push(`lock: ${result.lockMode}`)
  if (result.reason) lines.push(`reason: ${result.reason}`)
  if (result.warning) lines.push(`warning: ${result.warning}`)
  for (const warning of result.warnings ?? []) {
    lines.push(`warning: ${warning}`)
  }
  return lines.join('\n')
}

function formatChatClearResult(result) {
  const lines = ['[Room/chat-clear]']
  if (result.dryRun) lines.push('mode: dry-run')
  if (result.allowed === false) lines.push('status: blocked')
  lines.push(`requested: ${result.requested}`)
  lines.push(`deleted: ${result.deleted}`)
  lines.push(`skippedPinned: ${result.skippedPinned}`)
  lines.push(`skippedTooOld: ${result.skippedTooOld}`)
  if (result.confirmationRequired) lines.push('confirmation required')
  if (result.nextCommand) lines.push(`run: ${result.nextCommand}`)
  if (result.reason) lines.push(`reason: ${result.reason}`)
  return lines.join('\n')
}

function requestForLoop(decision) {
  const body = firstArg(decision)
  if (decision.intent === 'implement_review_fix') {
    return `@cc @codex review ${body}`.trim()
  }
  if (decision.intent === 'discuss') {
    return `@cc @codex ${body}`.trim()
  }
  if (decision.targetAgent === 'cc') {
    return `@cc ${body}`.trim()
  }
  return body
}

async function readKnownCwds(tmux, liveSessions) {
  const cwdBySession = {}
  for (const session of liveSessions) {
    try {
      cwdBySession[session] = await tmux.getCurrentPath(session)
    } catch {
      // Inventory/health explains unknown sessions and missing cwd details.
    }
  }
  return cwdBySession
}

function nextActionForHealth(report) {
  if (report.blockers.length) {
    return 'resolve health blockers before writing to the active session'
  }
  if (report.sessionHealth === 'tmux_only') {
    return 'confirm desktop Claude Code bind before long autonomous work'
  }
  return 'ready for private-room rc-only work'
}

function hasConfirmation(args) {
  return (args ?? []).some((arg) =>
    ['confirm', '--confirm', 'confirmed'].includes(String(arg).toLowerCase())
  )
}

function hasChatClearConfirmation(args) {
  return (args ?? []).some((arg) =>
    ['confirm', '--confirm', 'confirmed', 'confirm:true'].includes(String(arg).toLowerCase())
  )
}

function parseChatClearCount(args) {
  for (const arg of args ?? []) {
    const match = String(arg).match(/^(?:count:)?(\d+)$/i)
    if (match) return Number.parseInt(match[1], 10)
  }
  return 100
}

function hasDispatchConfirmation(body) {
  return /(?:^|\s)--confirm(?:\s|$)|confirm send|確認送出/i.test(
    String(body ?? '')
  )
}

function stripDispatchConfirmation(body) {
  return String(body ?? '')
    .replace(/(?:^|\s)--confirm(?:\s|$)/i, ' ')
    .replace(/confirm send/gi, ' ')
    .replace(/確認送出/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstArg(decision) {
  return String(decision.args?.[0] ?? '').trim()
}

function getTmux(options) {
  return options.tmux ?? createTmuxAdapter({ mode: options.tmuxMode })
}

function readState(options) {
  return readCurrentState({ stateDir: options.stateDir })
}

function reply(content, extra = {}) {
  return {
    shouldReply: true,
    content,
    ...extra,
  }
}

function formatExecutionError(error) {
  const message = error instanceof Error ? error.message : String(error)
  if (/missing permissions/i.test(message)) {
    return [
      '缺少 Discord「管理訊息」權限。',
      '到頻道設定 > 權限，把 AI Engineering Room bot 或它的身分組加進來，開啟「管理訊息」。',
      '這只影響 /chat-clear 刪除頻道訊息，不會放寬 tmux 或 dc-* 寫入權限。',
    ].join('\n')
  }
  return message
}
