import type { Hooks, Plugin, PluginModule } from "@opencode-ai/plugin"

type ServerEvent = Parameters<NonNullable<Hooks["event"]>>[0]["event"]

type AssistantMessage = {
  id: string
  role: "assistant"
  finish?: string
  providerID?: string
  modelID?: string
  error?: unknown
}

type TextPart = {
  type: "text"
  messageID: string
  text: string
}

const FINISH_REASON = "content-filter"
const CLI_MESSAGE = "Provider blocked the response with a content filter."

function payload(event: ServerEvent): unknown {
  if (event && typeof event === "object" && "payload" in event) return event.payload
  return event
}

function eventType(event: unknown): string | undefined {
  if (!event || typeof event !== "object") return
  const type = (event as { type?: unknown }).type
  return typeof type === "string" ? type : undefined
}

function isAssistantMessage(value: unknown): value is AssistantMessage {
  return Boolean(value && typeof value === "object" && (value as { role?: unknown }).role === "assistant")
}

function isTextPart(value: unknown): value is TextPart {
  if (!value || typeof value !== "object") return false
  const part = value as { type?: unknown; messageID?: unknown; text?: unknown }
  return part.type === "text" && typeof part.messageID === "string" && typeof part.text === "string"
}

function isFiltered(message: AssistantMessage) {
  return message.finish === FINISH_REASON
}

function messageLabel(message: AssistantMessage): string | undefined {
  if (!message.providerID || !message.modelID) return
  return `${message.providerID}/${message.modelID}`
}

function isRunCommand() {
  if (process.env.OPENCODE_PROCESS_ROLE === "worker") return false
  return process.argv.includes("run")
}

const server: Plugin = async () => {
  const notified = new Set<string>()
  const textByMessageID = new Map<string, string>()
  const shouldWriteCliNotice = isRunCommand()

  function notify(message: AssistantMessage) {
    if (!shouldWriteCliNotice) return
    if (notified.has(message.id)) return
    notified.add(message.id)
    process.exitCode = 1

    const label = messageLabel(message)
    process.stderr.write(`\n! ${CLI_MESSAGE}${label ? ` (${label})` : ""}\n`)
  }

  return {
    event: async ({ event }) => {
      const current = payload(event)
      const type = eventType(current)
      if (!type || !current || typeof current !== "object") return

      if (type === "message.part.updated") {
        const part = (current as { properties?: { part?: unknown } }).properties?.part
        if (isTextPart(part)) textByMessageID.set(part.messageID, part.text.trim())
        return
      }

      if (type !== "message.updated") return

      const message = (current as { properties?: { info?: unknown } }).properties?.info
      if (!isAssistantMessage(message)) return
      if (!isFiltered(message)) return
      if (message.error) return
      if (textByMessageID.get(message.id)?.trim()) return
      notify(message)
    },
  }
}

const plugin: PluginModule & { id: string } = {
  id: "opencode-content-filter",
  server,
}

export default plugin
