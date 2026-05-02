/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import type { Message, Part } from "@opencode-ai/sdk/v2"

type AssistantMessage = Extract<Message, { role: "assistant" }>

const FINISH_REASON = "content-filter"
const TOAST_MESSAGE = "Provider blocked the response with a content filter."

function visibleText(parts: readonly Part[]): string {
  return parts
    .filter((part): part is Extract<Part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim()
}

function isFiltered(message: Message): message is AssistantMessage {
  return message.role === "assistant" && message.finish === FINISH_REASON
}

function messageLabel(message: AssistantMessage): string {
  return `${message.providerID}/${message.modelID}`
}

const tui: TuiPlugin = async (api) => {
  const notified = new Set<string>()

  function notify(message: AssistantMessage) {
    if (notified.has(message.id)) return
    notified.add(message.id)
    api.ui.toast({
      variant: "error",
      title: "Content filter",
      message: `${TOAST_MESSAGE} (${messageLabel(message)})`,
      duration: 10000,
    })
  }

  function inspect(message: Message) {
    if (!isFiltered(message)) return
    const parts = api.state.part(message.id)
    if (visibleText(parts)) return
    notify(message)
  }

  function inspectSession(sessionID: string) {
    for (const message of api.state.session.messages(sessionID)) inspect(message)
  }

  const offMessage = api.event.on("message.updated", (event) => {
    inspect(event.properties.info)
  })

  const offPart = api.event.on("message.part.updated", (event) => {
    inspectSession(event.properties.sessionID)
  })

  const offSessionError = api.event.on("session.error", (event) => {
    if (!event.properties.sessionID) return
    inspectSession(event.properties.sessionID)
  })

  api.lifecycle.onDispose(() => {
    offMessage()
    offPart()
    offSessionError()
  })

  if (api.route.current.name === "session") inspectSession(api.route.current.params.sessionID)
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-content-filter",
  tui,
}

export default plugin
