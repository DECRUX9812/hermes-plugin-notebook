import {
  RiArrowRightSLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiLoaderLine,
  RiTimeLine,
} from "@remixicon/react";
import { AgentThinking } from "@/components/application/agent-thinking/agent-thinking";
import { cx } from "@/utils/cx";
import type { Task } from "../fixtures";

const GLYPH: Record<Task["status"], { Icon: typeof RiCheckLine; tone: string }> = {
  succeeded: { Icon: RiCheckLine, tone: "bg-background-tertiary-default text-foreground-icon-secondary" },
  running: { Icon: RiLoaderLine, tone: "bg-accent-100 text-accent-700" },
  waiting: { Icon: RiTimeLine, tone: "bg-status-yellow-background text-status-yellow-text" },
  failed: { Icon: RiErrorWarningLine, tone: "bg-status-yellow-background text-status-yellow-text" },
};

/** Flat activity row — title / one-line outcome / time. Click opens the detail sheet. */
export function TaskRow({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const { Icon, tone } = GLYPH[task.status];
  const running = task.status === "running";

  return (
    <li className="min-w-0" data-status={task.status}>
      <button
        type="button"
        data-task-id={task.id}
        onClick={() => onOpen(task)}
        className="group flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-2.5 text-start outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        <span className={cx("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", tone)}>
          <Icon
            className={cx("size-3.5", running && "animate-spin motion-reduce:animate-none")}
            aria-hidden
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body-medium text-text-primary">{task.title}</span>
          {running ? (
            <span className="mt-0.5 block">
              <AgentThinking variant="wave" label={task.outcome} shimmer showTimer={false} />
            </span>
          ) : (
            <span
              className={cx(
                "mt-0.5 block truncate text-body-2-regular",
                task.status === "failed" ? "text-status-yellow-text" : "text-text-secondary",
              )}
            >
              {task.outcome}
            </span>
          )}
          <span className="mt-0.5 block text-caption-1-regular text-text-tertiary tabular-nums">
            {task.duration}
          </span>
        </span>
        <RiArrowRightSLine
          className="mt-1 size-4 shrink-0 text-foreground-icon-quaternary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          aria-hidden
        />
      </button>
    </li>
  );
}
