import { useEffect, useMemo, useState } from "react";
import {
  RiArrowDownSLine,
  RiComputerLine,
  RiFilterLine,
  RiPencilLine,
  RiPulseLine,
  RiSearchLine,
} from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { StatusDot } from "@/components/base/badges/status-dot";
import { Button } from "@/components/base/buttons/button";
import {
  Dropdown,
  DropdownDivider,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from "@/components/base/dropdown/dropdown";
import { ModalTrigger } from "@/components/base/modal/modal";
import { SearchField } from "@/components/base/search-field/search-field";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { AgentThinking } from "@/components/application/agent-thinking/agent-thinking";
import { ScrollFade, useScrollFade } from "@/components/foundations/scroll-fade/scroll-fade";
import { cx } from "@/utils/cx";
import type { Bot, Session, Task } from "../fixtures";
import { ActivityDetail } from "./ActivityDetail";
import { BotScreen } from "./BotScreen";
import { EditProfileDialog } from "./EditProfileDialog";
import { HistoryGroup, ScheduledGroup } from "./Sections";
import { TaskRow } from "./TaskRow";

const HALO: Record<Bot["mood"], string> = {
  waiting: "from-status-yellow-background",
  working: "from-accent-200",
  idle: "from-background-tertiary-default",
};

const DOT: Record<Bot["mood"], "yellow" | "green" | "indigo"> = {
  waiting: "yellow",
  working: "green",
  idle: "indigo",
};

type Filter = "all" | Task["status"];

const FILTER_LABEL: Record<Filter, string> = {
  all: "All activity",
  running: "Running",
  waiting: "Waiting",
  succeeded: "Done",
  failed: "Needs attention",
};

function BotSwitcher({
  bots,
  active,
  waitingOf,
  onSelect,
  onSelectSession,
}: {
  bots: Bot[];
  active: Bot;
  waitingOf: (bot: Bot) => number;
  onSelect: (id: string) => void;
  onSelectSession: (botId: string, sessionId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const needle = query.trim().toLowerCase();

  const matchedBots = needle ? bots.filter((b) => b.name.toLowerCase().includes(needle)) : bots;
  const matchedSessions = needle
    ? bots.flatMap((bot) =>
        bot.sessions
          .filter((s) => s.title.toLowerCase().includes(needle))
          .map((s) => ({ bot, session: s })),
      )
    : [];

  return (
    <Dropdown
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownTrigger
        aria-label="Switch bot"
        className="flex cursor-pointer items-center gap-2 rounded-full py-1 pe-2.5 ps-1 outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        <Avatar color={active.color} initials={active.initials} size="sm" />
        <span className="text-body-medium text-text-primary">{active.name}</span>
        {waitingOf(active) ? (
          <Chip color="yellow" variant="caption">{waitingOf(active)}</Chip>
        ) : null}
        <RiArrowDownSLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
      </DropdownTrigger>
      <DropdownPopover aria-label="Bots and sessions" className="min-w-60">
        <div className="px-1 pb-1">
          <SearchField
            aria-label="Find a bot or session"
            placeholder="Find a bot or session…"
            size="small"
            value={query}
            onChange={setQuery}
          />
        </div>
        {matchedBots.map((bot) => (
          <DropdownItem
            key={bot.id}
            selected={bot.id === active.id}
            onSelect={() => {
              onSelect(bot.id);
              setOpen(false);
            }}
          >
            <Avatar color={bot.color} initials={bot.initials} size="xs" />
            <span className="flex-1 text-body-medium text-text-primary">{bot.name}</span>
            <StatusDot color={waitingOf(bot) ? "yellow" : DOT[bot.mood]} className="size-2.5" />
            {waitingOf(bot) ? <Chip color="yellow" variant="caption">{waitingOf(bot)}</Chip> : null}
          </DropdownItem>
        ))}
        {matchedSessions.length ? (
          <>
            <DropdownDivider />
            {matchedSessions.map(({ bot, session }) => (
              <DropdownItem
                key={session.id}
                onSelect={() => {
                  onSelectSession(bot.id, session.id);
                  setOpen(false);
                }}
              >
                <RiSearchLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-body-regular text-text-primary">{session.title}</span>
                <span className="shrink-0 text-caption-1-regular text-text-tertiary">{bot.name}</span>
              </DropdownItem>
            ))}
          </>
        ) : null}
      </DropdownPopover>
    </Dropdown>
  );
}

function AvatarButton({ bot, mood }: { bot: Bot; mood: Bot["mood"] }) {
  const working = mood !== "idle";
  return (
    <ModalTrigger>
      <button
        type="button"
        aria-label="Edit profile"
        className={cx(
          "relative block rounded-full bg-gradient-to-b to-transparent p-1 outline-none transition-transform",
          HALO[mood],
          "hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-border-focus-ring",
        )}
      >
        <Avatar
          color={bot.color}
          initials={bot.initials}
          className="size-[76px] text-title-2-semibold"
        />
        <span
          aria-hidden
          className="absolute -bottom-0.5 -end-0.5 grid size-7 place-items-center rounded-full border border-border-button-default bg-background-primary-default text-foreground-icon-secondary shadow-sm"
        >
          <RiPencilLine className="size-3.5" />
        </span>
        {working ? <span aria-hidden className="halo-ring" /> : null}
      </button>
      <EditProfileDialog bot={bot} />
    </ModalTrigger>
  );
}

function SessionStrip({
  sessions,
  activeId,
  onSelect,
}: {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div aria-label="Sessions" className="flex gap-1.5 overflow-x-auto px-1 pb-1" role="listbox">
      {sessions.map((session) => {
        const selected = session.id === activeId;
        return (
          <button
            key={session.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(session.id)}
            className={cx(
              "shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-body-2-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              selected
                ? "bg-accent-100 text-accent-800"
                : "bg-background-secondary-default text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary",
            )}
          >
            {session.title}
          </button>
        );
      })}
      <button
        type="button"
        className="shrink-0 cursor-pointer rounded-full px-2.5 py-1.5 text-body-2-regular text-text-tertiary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        See all
      </button>
    </div>
  );
}

export function Rail({
  bots,
  activeBot,
  activeSession,
  decisions,
  onDecide,
  onSelectBot,
  onSelectSession,
  onSelectBotSession,
}: {
  bots: Bot[];
  activeBot: Bot;
  activeSession: Session;
  decisions: Record<string, "allowed" | "denied">;
  onDecide: (taskId: string, decision: "allowed" | "denied") => void;
  onSelectBot: (id: string) => void;
  onSelectSession: (id: string) => void;
  onSelectBotSession: (botId: string, sessionId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [openTask, setOpenTask] = useState<Task | null>(null);

  // Session switch must not leak a previous session's open detail.
  useEffect(() => setOpenTask(null), [activeSession.id]);
  const { progress, onScroll } = useScrollFade();
  const waiting = activeSession.tasks.filter((t) => t.approval && !decisions[t.id]).length;

  const waitingOf = (bot: Bot) =>
    bot.sessions.reduce(
      (n, s) => n + s.tasks.filter((t) => t.approval && !decisions[t.id]).length,
      0,
    );

  // Once every pending approval is answered, the "waiting" mood clears.
  const mood = activeBot.mood === "waiting" && waiting === 0 ? "idle" : activeBot.mood;
  const statusLine =
    activeBot.mood === "waiting"
      ? waiting
        ? `${waiting} approval${waiting === 1 ? "" : "s"} waiting`
        : "All approvals answered"
      : activeBot.statusLine;

  const tasks = useMemo(
    () => activeSession.tasks.filter((t) => filter === "all" || t.status === filter),
    [activeSession, filter],
  );
  const anyRunning = activeSession.tasks.some((t) => t.status === "running");

  // Answered approvals join the session's history feed as fresh entries.
  const historyItems = useMemo(() => {
    const fresh = activeSession.tasks
      .filter((t) => t.approval && decisions[t.id])
      .map((t) => ({
        command: t.approval!.command,
        decision: decisions[t.id] === "allowed" ? ("approved" as const) : ("denied" as const),
        time: "just now",
      }));
    return [...fresh, ...activeSession.history];
  }, [activeSession, decisions]);

  return (
    <aside className="flex h-full w-full flex-col bg-background-primary-default" aria-label="Bot context rail">
      {/* Roster row */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <BotSwitcher bots={bots} active={activeBot} waitingOf={waitingOf} onSelect={onSelectBot} onSelectSession={onSelectBotSession} />
        <ThemeToggle collapsed size="small" />
      </div>

      {/* Avatar + live status */}
      <div className="flex flex-col items-center px-3 pb-2 pt-4 text-center">
        <AvatarButton bot={activeBot} mood={mood} />
        <h2 className="mt-3 text-title-3-semibold text-text-primary">{activeBot.name}</h2>
        <p aria-live="polite" className="mt-1 flex items-center gap-1.5 text-body-2-regular text-text-secondary">
          <StatusDot color={DOT[mood]} className="size-2.5" />
          {statusLine}
          {mood === "waiting" ? (
            <span aria-hidden className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-1.5 rounded-full bg-current" />
            </span>
          ) : null}
        </p>
      </div>

      {/* Sessions */}
      <SessionStrip sessions={activeBot.sessions} activeId={activeSession.id} onSelect={onSelectSession} />

      {/* Tabs */}
      <Tabs key={activeSession.id} aria-label="Bot context" defaultSelectedKey="activity" className="flex min-h-0 flex-1 flex-col px-3">
        <TabList aria-label="Context panes" className="border-b border-separator-border">
          <Tab id="activity" icon={RiPulseLine} count={activeSession.tasks.length}>
            Activity
          </Tab>
          <Tab id="bot" icon={RiComputerLine}>
            Bot
          </Tab>
        </TabList>

        <TabPanel id="activity" className="flex min-h-0 flex-1 flex-col outline-none">
          <div className="relative min-h-0 flex-1">
            <ScrollFade progress={progress} />
            <div className="h-full overflow-y-auto overscroll-contain pe-1" onScroll={onScroll}>
              <ScheduledGroup session={activeSession} />

              {/* Feed controls */}
              <div className="flex items-center justify-between py-2">
                <span className="text-caption-1-semibold uppercase tracking-wide text-text-tertiary">Today</span>
                <Dropdown isOpen={filterOpen} onOpenChange={setFilterOpen}>
                  <DropdownTrigger
                    aria-label="Filter activity"
                    className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-body-2-medium text-text-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                  >
                    <RiFilterLine className="size-3.5" aria-hidden />
                    {FILTER_LABEL[filter]}
                    <RiArrowDownSLine className="size-3.5 text-foreground-icon-tertiary" aria-hidden />
                  </DropdownTrigger>
                  <DropdownPopover aria-label="Activity filter">
                    {(["all", "running", "waiting", "failed"] as const).map((value) => (
                      <DropdownItem
                        key={value}
                        selected={filter === value}
                        onSelect={() => {
                          setFilter(value);
                          setFilterOpen(false);
                        }}
                      >
                        {FILTER_LABEL[value]}
                      </DropdownItem>
                    ))}
                  </DropdownPopover>
                </Dropdown>
              </div>

              <ul className="divide-y divide-separator-border">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} onOpen={setOpenTask} />
                ))}
              </ul>
              {anyRunning ? (
                <div className="px-1 py-2">
                  <AgentThinking variant="wave" label="Working" showTimer={false} />
                </div>
              ) : null}
              <HistoryGroup items={historyItems} />
              <div className="flex justify-center py-3">
                <Button variant="ghost" size="xs">
                  Load older
                </Button>
              </div>
            </div>
            {openTask ? (
              <ActivityDetail
                task={openTask}
                decision={decisions[openTask.id]}
                onDecide={onDecide}
                onClose={() => setOpenTask(null)}
              />
            ) : null}
          </div>
          {waiting ? (
            <p className="border-t border-separator-border px-1 py-2 text-caption-1-regular text-status-yellow-text">
              {waiting} approval{waiting === 1 ? "" : "s"} waiting — answer in the task above
            </p>
          ) : null}
        </TabPanel>

        <TabPanel id="bot" className="min-h-0 flex-1 outline-none">
          <BotScreen />
        </TabPanel>
      </Tabs>
    </aside>
  );
}
