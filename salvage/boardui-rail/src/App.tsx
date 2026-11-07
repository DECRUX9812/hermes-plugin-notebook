import { useMemo, useState } from "react";
import { RiAttachment2, RiCommandLine, RiSendPlaneLine } from "@remixicon/react";
import { DirectionProvider } from "@/components/foundations/direction/direction";
import { cx } from "@/utils/cx";
import { BOTS } from "./fixtures";
import { Rail } from "./rail/Rail";

const CHAT = [
  { from: "user", text: "Check the release is ready to ship" },
  {
    from: "bot",
    text: "Tests and build are green. The only thing left is the force-push — I've asked before touching it.",
  },
  { from: "user", text: "Also keep an eye on the rollout metrics" },
  { from: "bot", text: "On it — watching the fleet dashboard now." },
];

function ChatContext({ botName }: { botName: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-hidden p-6">
        {CHAT.map((message, index) => (
          <div key={index} className={cx("flex", message.from === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cx(
                "max-w-md rounded-2xl px-4 py-2.5 text-body-regular",
                message.from === "user"
                  ? "bg-accent-600 text-white"
                  : "bg-background-secondary-default text-text-primary",
              )}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>
      <div className="px-6 pb-5">
        <div className="flex items-center gap-2 rounded-full border border-border-button-default bg-background-primary-default px-4 py-2.5">
          <RiAttachment2 className="size-4 text-foreground-icon-tertiary" aria-hidden />
          <span className="flex-1 text-body-regular text-text-placeholder">Message {botName}…</span>
          <RiCommandLine className="size-4 text-foreground-icon-quaternary" aria-hidden />
          <RiSendPlaneLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [botId, setBotId] = useState(BOTS[0].id);
  const [sessionByBot, setSessionByBot] = useState<Record<string, string>>(() =>
    Object.fromEntries(BOTS.map((bot) => [bot.id, bot.sessions[0]?.id ?? ""])),
  );
  /** taskId -> the decision the user just made on its approval. */
  const [decisions, setDecisions] = useState<Record<string, "allowed" | "denied">>({});

  const activeBot = useMemo(() => BOTS.find((bot) => bot.id === botId) ?? BOTS[0], [botId]);
  const activeSession = useMemo(
    () =>
      activeBot.sessions.find((session) => session.id === sessionByBot[botId]) ??
      activeBot.sessions[0],
    [activeBot, sessionByBot, botId],
  );

  const selectBot = (id: string) => setBotId(id);
  const selectSession = (id: string) =>
    setSessionByBot((current) => ({ ...current, [botId]: id }));
  const selectBotSession = (nextBot: string, nextSession: string) => {
    setBotId(nextBot);
    setSessionByBot((current) => ({ ...current, [nextBot]: nextSession }));
  };

  return (
    <DirectionProvider locale="en-US">
      <div className="flex h-dvh flex-col bg-background-full text-text-primary">
        {/* Window bar */}
        <header className="flex items-center gap-3 border-b border-separator-border bg-background-primary-default px-4 py-2">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-status-rose-background" />
            <span className="size-2.5 rounded-full bg-status-yellow-background" />
            <span className="size-2.5 rounded-full bg-status-lime-background" />
          </div>
          <span className="text-body-2-medium text-text-secondary">Hermes · Bot Mode</span>
          <span className="ms-auto text-caption-1-regular text-text-tertiary">
            bot-context 0.2.1 rail preview
          </span>
        </header>

        <div className="flex min-h-0 flex-1">
          <ChatContext botName={activeBot.name} />
          <div className="w-[400px] shrink-0 border-s border-separator-border bg-background-primary-default max-lg:w-[340px] max-md:hidden">
            <Rail
              bots={BOTS}
              activeBot={activeBot}
              activeSession={activeSession}
              decisions={decisions}
              onDecide={(taskId, decision) =>
                setDecisions((current) => ({ ...current, [taskId]: decision }))
              }
              onSelectBot={selectBot}
              onSelectSession={selectSession}
              onSelectBotSession={selectBotSession}
            />
          </div>
        </div>
      </div>
    </DirectionProvider>
  );
}
