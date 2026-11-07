import { useState } from "react";
import {
  RiAlarmLine,
  RiArrowDownSLine,
  RiHistoryLine,
  RiTimeLine,
} from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { cx } from "@/utils/cx";
import type { HistoryItem, Session } from "../fixtures";

const DECISION_TONE: Record<HistoryItem["decision"], { color: "lime" | "rose" | "neutral"; label: string }> = {
  approved: { color: "lime", label: "approved" },
  denied: { color: "rose", label: "denied" },
  expired: { color: "neutral", label: "expired" },
};

/** Muse-style flat collapsible group: bold header + chevron, content underneath. */
function Group({
  icon: Icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: typeof RiTimeLine;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="py-1.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-1.5 text-start outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        <Icon className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{title}</span>
        <RiArrowDownSLine
          className={cx(
            "size-4 shrink-0 text-foreground-icon-tertiary transition-transform duration-200 motion-reduce:transition-none",
            open && "-rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? <div className="px-1 pb-1 pt-1">{children}</div> : null}
    </section>
  );
}

export function ScheduledGroup({ session }: { session: Session }) {
  if (!session.jobs.length) return null;
  return (
    <Group icon={RiAlarmLine} title={`${session.jobs.length} scheduled tasks`}>
      <ul className="space-y-1.5 ps-1">
        {session.jobs.map((job) => (
          <li key={job.name} className="flex items-center gap-2">
            <RiTimeLine className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-body-2-regular text-text-primary">{job.name}</span>
            <span className="shrink-0 text-caption-1-regular text-text-tertiary">{job.schedule}</span>
          </li>
        ))}
      </ul>
    </Group>
  );
}

export function HistoryGroup({ items }: { items: HistoryItem[] }) {
  if (!items.length) return null;
  return (
    <Group icon={RiHistoryLine} title="Approval history">
      <ul className="space-y-2 ps-1">
        {items.map((item) => {
          const tone = DECISION_TONE[item.decision];
          return (
            <li key={`${item.command}-${item.time}`} className="flex items-center gap-2">
              <Chip color={tone.color} variant="caption" className="w-16 justify-center">
                {tone.label}
              </Chip>
              <code className="min-w-0 flex-1 truncate font-mono text-caption-1-regular text-text-secondary">
                {item.command}
              </code>
              <span className="shrink-0 text-caption-1-regular text-text-tertiary tabular-nums">
                {item.time}
              </span>
            </li>
          );
        })}
      </ul>
    </Group>
  );
}
