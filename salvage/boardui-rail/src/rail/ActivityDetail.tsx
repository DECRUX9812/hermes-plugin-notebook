import { useEffect, useRef, useState } from "react";
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiCloseLine,
  RiDatabase2Line,
  RiErrorWarningLine,
  RiFileTextLine,
  RiGlobalLine,
  RiLoaderLine,
  RiMore2Line,
  RiSearchLine,
  RiShieldCheckLine,
  RiTerminalLine,
} from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { ScrollFade, useScrollFade } from "@/components/foundations/scroll-fade/scroll-fade";
import { cx } from "@/utils/cx";
import type { Artifact, PendingApproval, Subagent, Task, TraceStep } from "../fixtures";

type Decision = "allowed" | "denied";

const PILL: Record<Task["status"], { color: "lime" | "blue" | "yellow" | "rose" | "neutral"; label: string }> = {
  succeeded: { color: "lime", label: "Complete" },
  running: { color: "blue", label: "Running" },
  waiting: { color: "yellow", label: "Waiting" },
  failed: { color: "rose", label: "Needs attention" },
};

function pillFor(task: Task, decision?: Decision) {
  if (decision === "allowed") return { color: "blue" as const, label: "Running" };
  if (decision === "denied") return { color: "neutral" as const, label: "Declined" };
  return PILL[task.status];
}

const STEP_STATUS: Record<Subagent["status"], { color: "lime" | "blue" | "rose"; label: string }> = {
  succeeded: { color: "lime", label: "done" },
  running: { color: "blue", label: "running" },
  failed: { color: "rose", label: "failed" },
};

function stepIcon(step: TraceStep) {
  if (step.status === "failed") return { Icon: RiErrorWarningLine, tone: "text-foreground-icon-error" };
  if (step.status === "running")
    return { Icon: RiLoaderLine, tone: "text-foreground-icon-secondary animate-spin motion-reduce:animate-none" };
  if (/browser|fetch/i.test(step.tool)) return { Icon: RiGlobalLine, tone: "text-foreground-icon-tertiary" };
  if (/search|web/i.test(step.tool)) return { Icon: RiSearchLine, tone: "text-foreground-icon-tertiary" };
  if (/memory|token|db/i.test(step.tool)) return { Icon: RiDatabase2Line, tone: "text-foreground-icon-tertiary" };
  if (/read|write|edit|file|doc/i.test(step.tool)) return { Icon: RiFileTextLine, tone: "text-foreground-icon-tertiary" };
  if (/terminal|shell|git|npm|kubectl/i.test(step.tool)) return { Icon: RiTerminalLine, tone: "text-foreground-icon-tertiary" };
  return { Icon: RiCheckLine, tone: "text-foreground-icon-tertiary" };
}

function Timeline({ task, decision }: { task: Task; decision?: Decision }) {
  const endLabel =
    decision === "allowed"
      ? "Approval allowed — continuing"
      : decision === "denied"
        ? "Approval denied — stopped"
        : task.status === "succeeded"
          ? "Completed"
          : task.status === "waiting"
            ? "Waiting for approval"
            : task.status === "failed"
              ? "Failed"
              : "Working…";

  return (
    <ol className="mt-2">
      <li className="flex items-center gap-2.5 py-1">
        <span className="grid size-5 shrink-0 place-items-center">
          <span className="size-1.5 rounded-full bg-foreground-icon-quaternary" aria-hidden />
        </span>
        <span className="text-body-2-regular text-text-tertiary">Started</span>
      </li>
      {task.steps.map((step) => {
        const { Icon, tone } = stepIcon(step);
        return (
          <li key={step.id} className="flex items-center gap-2.5 py-1">
            <span className="grid size-5 shrink-0 place-items-center">
              <Icon className={cx("size-4", tone)} aria-hidden />
            </span>
            <span
              className={cx(
                "min-w-0 flex-1 truncate text-body-2-regular",
                step.status === "failed" ? "text-status-yellow-text" : "text-text-secondary",
              )}
            >
              {step.note ?? `${step.tool} · ${step.target}`}
            </span>
            <span className="shrink-0 text-caption-1-regular text-text-tertiary tabular-nums">
              {step.at}
            </span>
          </li>
        );
      })}
      <li className="py-1 ps-0.5">
        <span
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption-1-semibold",
            decision === "allowed" && "bg-accent-100 text-accent-700",
            decision === "denied" && "bg-status-rose-background text-status-rose-text",
            !decision && task.status === "succeeded" && "bg-background-tertiary-default text-text-secondary",
            !decision && task.status === "waiting" && "bg-status-yellow-background text-status-yellow-text",
            !decision && task.status === "failed" && "bg-status-rose-background text-status-rose-text",
            !decision && task.status === "running" && "bg-accent-100 text-accent-700",
          )}
        >
          {endLabel}
        </span>
      </li>
    </ol>
  );
}

function ApprovalCard({
  approval,
  decision,
  onDecide,
}: {
  approval: PendingApproval;
  decision?: Decision;
  onDecide: (decision: Decision) => void;
}) {
  return (
    <div className="mt-2 rounded-xl border border-border-button-default bg-background-secondary-default p-3">
      <div className="flex items-center gap-2">
        <RiShieldCheckLine className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
        <span className="text-caption-1-semibold text-text-secondary">
          {decision ? "Approval answered" : "Approval needed"}
        </span>
        <Chip color={decision === "allowed" ? "lime" : decision === "denied" ? "rose" : "yellow"} variant="caption" className="ms-auto">
          {decision ?? "waiting"}
        </Chip>
      </div>
      <code className="mt-2 block truncate rounded-md bg-background-tertiary-default px-2 py-1.5 font-mono text-caption-1-regular text-text-primary">
        {approval.command}
      </code>
      <p className="mt-1.5 text-body-2-regular text-text-secondary">{approval.description}</p>
      {decision ? (
        <p className="mt-2.5 text-caption-1-regular text-text-tertiary">
          {decision === "allowed"
            ? "You allowed this just now — the task is continuing."
            : "You denied this just now — the task was stopped."}
        </p>
      ) : (
        <div className="mt-2.5 flex items-center gap-2">
          <Button size="small" onClick={() => onDecide("allowed")}>Allow once</Button>
          <Button size="small" variant="secondary" onClick={() => onDecide("denied")}>
            Deny
          </Button>
          <span className="ms-auto text-caption-1-regular text-text-tertiary">answers in place</span>
        </div>
      )}
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <div className="rounded-xl border border-border-button-default bg-background-secondary-default p-3">
      <p className="text-body-medium text-text-primary">{artifact.title}</p>
      {artifact.body ? <p className="mt-1 text-body-2-regular text-text-secondary">{artifact.body}</p> : null}
      {artifact.file ? (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-lg bg-background-tertiary-default px-2.5 py-2">
          <RiFileTextLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">
            {artifact.file.name}
          </span>
          <span className="shrink-0 text-caption-1-regular text-text-tertiary">{artifact.file.meta}</span>
          <RiMore2Line className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}

/** Subagent card that expands in place to reveal its summary and steps. */
function SubagentCard({ agent }: { agent: Subagent }) {
  const [open, setOpen] = useState(false);
  const tone = STEP_STATUS[agent.status];
  return (
    <div className="rounded-xl border border-border-button-default">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-start outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{agent.goal}</span>
        <Chip color={tone.color} variant="caption">
          {tone.label}
        </Chip>
        <RiArrowDownSLine
          className={cx(
            "size-4 shrink-0 text-foreground-icon-tertiary transition-transform duration-200 motion-reduce:transition-none",
            open && "-rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-separator-border px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-caption-1-regular text-text-tertiary">
            <span>{agent.role}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{agent.duration}</span>
          </div>
          <p className="mt-1.5 text-body-2-regular text-text-secondary">{agent.summary}</p>
          <ul className="mt-2 space-y-1 border-s-2 border-separator-border ps-2.5">
            {agent.steps.map((step) => (
              <li key={`${step.tool}-${step.target}`} className="flex items-center gap-1.5 text-caption-1-regular">
                {step.status === "error" ? (
                  <RiCloseLine className="size-3.5 shrink-0 text-foreground-icon-error" aria-hidden />
                ) : (
                  <RiCheckLine className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
                )}
                <span className="shrink-0 text-text-tertiary">{step.tool}</span>
                <span className="truncate font-mono text-text-tertiary">· {step.target}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Muse-style task detail — slides over the feed, X or Escape returns to the list. */
export function ActivityDetail({
  task,
  decision,
  onDecide,
  onClose,
}: {
  task: Task;
  decision?: Decision;
  onDecide: (taskId: string, decision: Decision) => void;
  onClose: () => void;
}) {
  const { progress, onScroll } = useScrollFade();
  const closeRef = useRef<HTMLButtonElement>(null);
  const pill = pillFor(task, decision);

  // Focus lands inside the sheet; Escape closes; focus returns to the row.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document
        .querySelector<HTMLButtonElement>(`[data-task-id="${task.id}"]`)
        ?.focus();
    };
  }, [task.id, onClose]);

  return (
    <div
      role="region"
      aria-label="Task detail"
      className="detail-sheet absolute inset-0 z-10 flex flex-col bg-background-primary-default"
    >
      <div className="flex items-center gap-2 px-1 pt-2">
        <Chip color={pill.color} variant="bold">
          {pill.label}
        </Chip>
        <span className="text-caption-1-regular text-text-tertiary tabular-nums">{task.duration}</span>
        <button
          type="button"
          ref={closeRef}
          aria-label="Close task detail"
          onClick={onClose}
          className="ms-auto grid size-7 cursor-pointer place-items-center rounded-full text-foreground-icon-tertiary outline-none transition-colors hover:bg-background-secondary-hover hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <RiCloseLine className="size-4.5" aria-hidden />
        </button>
      </div>
      <h3 className="px-1 pt-2 text-title-3-semibold text-text-primary">{task.title}</h3>

      <div className="relative mt-1 min-h-0 flex-1">
        <ScrollFade progress={progress} />
        <div className="h-full overflow-y-auto overscroll-contain px-1 pb-3" onScroll={onScroll}>
          <h4 className="pt-2 text-caption-1-semibold uppercase tracking-wide text-text-tertiary">
            Summary
          </h4>
          <p className="mt-1.5 text-body-2-regular text-text-secondary">{task.detail}</p>

          {task.approval ? (
            <ApprovalCard
              approval={task.approval}
              decision={decision}
              onDecide={(next) => onDecide(task.id, next)}
            />
          ) : null}

          {task.artifacts?.length ? (
            <div className="mt-2.5 space-y-2">
              {task.artifacts.map((artifact) => (
                <ArtifactCard key={artifact.title} artifact={artifact} />
              ))}
            </div>
          ) : null}

          {task.subagents?.length ? (
            <>
              <h4 className="pt-4 text-caption-1-semibold uppercase tracking-wide text-text-tertiary">
                Subagents
              </h4>
              <div className="mt-2 space-y-2">
                {task.subagents.map((agent) => (
                  <SubagentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </>
          ) : null}

          <h4 className="pt-4 text-caption-1-semibold uppercase tracking-wide text-text-tertiary">
            Activity
          </h4>
          <Timeline task={task} decision={decision} />
        </div>
      </div>
    </div>
  );
}
