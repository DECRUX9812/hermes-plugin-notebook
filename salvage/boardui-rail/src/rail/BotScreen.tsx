import { useState } from "react";
import {
  RiComputerLine,
  RiHandCoinLine,
  RiLoaderLine,
  RiStopCircleLine,
} from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { cx } from "@/utils/cx";

type ScreenState = "live" | "connecting" | "stopped";

const TERMINAL_LINES = [
  { tone: "text-lime-300", text: "$ hermes gateway status" },
  { tone: "text-lime-300", text: "● listening :9120 — 3 sessions attached" },
  { tone: "text-text-tertiary", text: "$ tail -f logs/gateway.log" },
  { tone: "text-text-tertiary", text: "12:04:11 session.attach rt-release" },
  { tone: "text-text-tertiary", text: "12:04:19 approval.request req-release-push" },
  { tone: "text-status-yellow-text", text: "12:04:19 waiting — git push --force" },
];

function FakeTerminal({ live }: { live: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border-button-default bg-background-full p-3 font-mono text-caption-1-regular">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-status-rose-background" />
        <span className="size-2 rounded-full bg-status-yellow-background" />
        <span className="size-2 rounded-full bg-status-lime-background" />
        <span className="ms-2 text-text-tertiary">bot — computer</span>
      </div>
      <div className="flex-1 space-y-1 overflow-hidden">
        {TERMINAL_LINES.map((line, index) => (
          <p key={index} className={cx("truncate", line.tone)}>
            {line.text}
          </p>
        ))}
        {live ? (
          <p className="text-text-secondary">
            <span className="animate-pulse motion-reduce:animate-none">▋</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function BotScreen() {
  const [state, setState] = useState<ScreenState>("live");

  return (
    <div className="flex h-full flex-col gap-3 px-1 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiComputerLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium text-text-primary">Bot screen</span>
          <Chip
            color={state === "live" ? "lime" : state === "connecting" ? "yellow" : "neutral"}
            variant="caption"
          >
            {state}
          </Chip>
        </div>
        <SegmentedControl
          aria-label="Screen state"
          selectedKeys={[state]}
          onSelectionChange={(keys) => setState([...keys][0] as ScreenState)}
        >
          <SegmentedControlItem id="live">Live</SegmentedControlItem>
          <SegmentedControlItem id="connecting">Connecting</SegmentedControlItem>
          <SegmentedControlItem id="stopped">Stopped</SegmentedControlItem>
        </SegmentedControl>
      </div>

      <div className="relative min-h-0 flex-1">
        {state === "stopped" ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-border-button-default bg-background-secondary-default p-6 text-center">
            <div>
              <RiStopCircleLine className="mx-auto size-8 text-foreground-icon-tertiary" aria-hidden />
              <p className="mt-2 text-body-medium text-text-primary">Screen stopped</p>
              <p className="mt-0.5 text-body-2-regular text-text-secondary">
                The bot's computer isn't streaming right now.
              </p>
              <Button size="small" variant="secondary" className="mt-3" leadingIcon={RiHandCoinLine}>
                Take over
              </Button>
            </div>
          </div>
        ) : state === "connecting" ? (
          <div className="grid h-full place-items-center rounded-xl border border-border-button-default bg-background-secondary-default p-6 text-center">
            <div>
              <RiLoaderLine
                className="mx-auto size-8 animate-spin text-foreground-icon-secondary motion-reduce:animate-none"
                aria-hidden
              />
              <p className="mt-2 text-body-medium text-text-primary">Checking the screen…</p>
              <p className="mt-0.5 text-body-2-regular text-text-secondary">
                Attaching to the bot's computer.
              </p>
            </div>
          </div>
        ) : (
          <>
            <FakeTerminal live />
            <div className="absolute bottom-2 end-2 flex gap-2">
              <Button size="small" variant="secondary" leadingIcon={RiHandCoinLine}>
                Take over
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
