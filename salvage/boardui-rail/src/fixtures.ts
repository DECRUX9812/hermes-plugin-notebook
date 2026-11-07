export type StepStatus = "running" | "succeeded" | "failed" | "cancelled";

export interface TraceStep {
  id: string;
  tool: string;
  target: string;
  /** Human result line, e.g. "Completed tail -n audit.log". */
  note?: string;
  at: string;
  status: StepStatus;
}

export interface PendingApproval {
  command: string;
  description: string;
  choices: string[];
}

export interface Artifact {
  title: string;
  body?: string;
  file?: { name: string; meta: string };
}

export interface Task {
  id: string;
  title: string;
  outcome: string;
  /** Prose shown under "Summary" in the detail view. */
  detail: string;
  status: "running" | "waiting" | "succeeded" | "failed";
  duration: string;
  steps: TraceStep[];
  approval?: PendingApproval;
  subagents?: Subagent[];
  artifacts?: Artifact[];
}

export interface Subagent {
  id: string;
  goal: string;
  role: string;
  status: "running" | "succeeded" | "failed";
  duration: string;
  summary: string;
  steps: { tool: string; target: string; status: "ok" | "error" }[];
}

export interface HistoryItem {
  command: string;
  decision: "approved" | "denied" | "expired";
  time: string;
}

export interface CronJob {
  name: string;
  schedule: string;
}

export interface Session {
  id: string;
  title: string;
  tasks: Task[];
  history: HistoryItem[];
  jobs: CronJob[];
}

export type BotMood = "working" | "waiting" | "idle";

export interface Bot {
  id: string;
  name: string;
  initials: string;
  color: "blue" | "lime" | "pink";
  mood: BotMood;
  statusLine: string;
  sessions: Session[];
}

export const BOTS: Bot[] = [
  {
    id: "research",
    name: "Research",
    initials: "R",
    color: "blue",
    mood: "waiting",
    statusLine: "1 approval waiting",
    sessions: [
      {
        id: "sess-release",
        title: "Release check",
        tasks: [
          {
            id: "t-rollout",
            title: "Watch the rollout metrics",
            outcome: "Watching rollout…",
            detail:
              "I'm tailing the canary rollout and the fleet dashboard. Error budget is flat and the new pods are healthy; I'll keep watching until you say stop.",
            status: "running",
            duration: "live",
            steps: [
              { id: "s0a", tool: "web_search", target: "hermes gateway canary rollout", note: "Searched canary rollout reports", at: "now", status: "succeeded" },
              { id: "s0b", tool: "browser_open", target: "grafana.internal/d/fleet", note: "Opened fleet dashboard", at: "now", status: "succeeded" },
              { id: "s0c", tool: "terminal", target: "watch kubectl get pods", note: "Watching pods — all healthy", at: "now", status: "running" },
            ],
          },
          {
            id: "t-launch",
            title: "Update the launch kit",
            outcome: "Launch kit now uses Hook 3 everywhere, synced to ~/Code.",
            detail:
              "I updated the launch kit so every asset leads with Hook 3, then synced the files back into your tree and verified nothing else was touched.",
            status: "succeeded",
            duration: "4m 12s",
            steps: [
              { id: "s1", tool: "read_file", target: "docs/launch-kit.md", note: "Read the current launch kit", at: "3m ago", status: "succeeded" },
              { id: "s2", tool: "edit_file", target: "docs/launch-kit.md", note: "Rewrote the kit around Hook 3", at: "2m ago", status: "succeeded" },
              { id: "s3", tool: "terminal", target: "git status --short", note: "Verified only kit files changed", at: "2m ago", status: "succeeded" },
            ],
            subagents: [
              {
                id: "sa-1",
                goal: "Summarize the Anthropic post and apply its implications",
                role: "leaf",
                status: "succeeded",
                duration: "2m 2s",
                summary:
                  "Read the post and the residency page. The post was blocked, so the summary uses the residency page.",
                steps: [
                  { tool: "read_file", target: "docs/anthropic-post.md", status: "ok" },
                  { tool: "browser_open", target: "anthropic.com/news", status: "error" },
                  { tool: "read_file", target: "docs/residency.md", status: "ok" },
                ],
              },
            ],
            artifacts: [
              {
                title: "Launch kit — Hook 3",
                body: "Hero line, three proof bullets and the install block all lead with Hook 3 now.",
                file: { name: "launch-kit.md", meta: "docs/ · 2.1 KB" },
              },
            ],
          },
          {
            id: "t-release",
            title: "Check the release",
            outcome: "Release checks passed — waiting on the push approval.",
            detail:
              "Tests and build are green on the release branch. The only step left is the force-push, which rewrites remote history — so I asked before touching it.",
            status: "waiting",
            duration: "1m 40s",
            steps: [
              { id: "s4", tool: "terminal", target: "npm test -- --run", note: "Ran the test suite — all green", at: "2m ago", status: "succeeded" },
              { id: "s5", tool: "terminal", target: "npm run build", note: "Built the release bundle", at: "1m ago", status: "succeeded" },
            ],
            approval: {
              command: "git push --force origin release/2.4",
              description: "Force-push the release branch after the tag moved",
              choices: ["once", "deny"],
            },
          },
          {
            id: "t-notes",
            title: "Publish the release notes",
            outcome: "Couldn't reach the registry — check npm auth, then retry.",
            detail:
              "The publish call failed at the registry boundary, before anything was uploaded. The package is untouched; once npm auth is refreshed the same command can run again.",
            status: "failed",
            duration: "48s",
            steps: [
              { id: "s6", tool: "terminal", target: "npm publish --access public", note: "Publish rejected — registry unreachable", at: "1m ago", status: "failed" },
            ],
          },
        ],
        history: [
          { command: "npm publish --access public", decision: "approved", time: "54m ago" },
          { command: "rm -rf dist/ && npm run build", decision: "approved", time: "1h ago" },
          { command: "curl -X POST internal/hook", decision: "denied", time: "2h ago" },
        ],
        jobs: [
          { name: "Nightly dependency audit", schedule: "03:00 daily" },
          { name: "Weekly changelog draft", schedule: "Mon 09:00" },
        ],
      },
      {
        id: "sess-audit",
        title: "Nightly audit",
        tasks: [
          {
            id: "t-audit",
            title: "Audit the nightly log",
            outcome: "Audit found two denied events and one stale token.",
            detail:
              "The nightly audit found two denied events and one stale token. The denied events were already blocked; the stale token is the thing to rotate.",
            status: "succeeded",
            duration: "6m 08s",
            steps: [
              { id: "s7", tool: "terminal", target: "tail -f audit.log", note: "Tailed the nightly audit log", at: "40m ago", status: "succeeded" },
              { id: "s8", tool: "read_file", target: "logs/gateway.log", note: "Cross-checked against gateway log", at: "38m ago", status: "succeeded" },
            ],
            subagents: [
              {
                id: "sa-2",
                goal: "Scan tokens for staleness",
                role: "leaf",
                status: "succeeded",
                duration: "1m 10s",
                summary: "Checked every token's last-seen time; one is 41 days stale.",
                steps: [
                  { tool: "read_file", target: "tokens/registry.json", status: "ok" },
                  { tool: "terminal", target: "token-age --all", status: "ok" },
                ],
              },
            ],
          },
        ],
        history: [{ command: "rm /var/tmp/audit.lock", decision: "approved", time: "41m ago" }],
        jobs: [],
      },
    ],
  },
  {
    id: "ops",
    name: "Ops",
    initials: "O",
    color: "pink",
    mood: "idle",
    statusLine: "Idle — no running tasks",
    sessions: [
      {
        id: "sess-deploy",
        title: "Deploy window",
        tasks: [
          {
            id: "t-deploy",
            title: "Roll the gateway to 0.21.5",
            outcome: "Gateway rolled; zero dropped connections across the fleet.",
            detail:
              "The gateway rolled to 0.21.5 with zero dropped connections. Rollout status stayed green the whole way through.",
            status: "succeeded",
            duration: "11m 24s",
            steps: [
              { id: "s9", tool: "terminal", target: "kubectl rollout status gw", note: "Watched rollout — stayed green", at: "1h ago", status: "succeeded" },
            ],
          },
        ],
        history: [],
        jobs: [{ name: "Fleet heartbeat digest", schedule: "every 6h" }],
      },
    ],
  },
];
