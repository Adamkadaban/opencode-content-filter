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

  const offCommand = api.command.register(() => [
    {
      title: "Content Filter Status",
      value: "plugin.content-filter.status",
      description: "Show the latest content-filtered assistant response",
      category: "Session",
      slash: { name: "content-filter", aliases: ["filter-status"] },
      enabled: api.route.current.name === "session",
      onSelect: () => {
        const route = api.route.current
        if (route.name !== "session") {
          api.ui.toast({ message: "No active session", variant: "error" })
          return
        }

        const filtered = api.state.session
          .messages(route.params.sessionID)
          .filter(isFiltered)
          .reverse()

        if (!filtered.length) {
          api.ui.toast({ message: "No content-filtered responses in this session", variant: "info" })
          return
        }

        const latest = filtered[0]
        api.ui.dialog.replace(
          () =>
            api.ui.DialogAlert({
              title: "Content filter",
              message: `${TOAST_MESSAGE}\n\nModel: ${messageLabel(latest)}\nMessage: ${latest.id}`,
              onConfirm: () => api.ui.dialog.clear(),
            }),
          () => {},
        )
      },
    },
  ])

  api.lifecycle.onDispose(() => {
    offMessage()
    offPart()
    offSessionError()
    offCommand()
  })

  if (api.route.current.name === "session") inspectSession(api.route.current.params.sessionID)
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-content-filter",
  tui,
}

export default plugin
