export type ClaudeSlashCommand = {
  name: string;
  desc: string;
  aliases?: string[];
};

export type ClaudeModel = {
  name: string;
  desc: string;
  aliases?: string[];
};

export const CLAUDE_MODELS: ClaudeModel[] = [
  { name: "default", desc: "Recommended default model" },
  { name: "opus", desc: "Latest Claude Opus" },
  { name: "sonnet", desc: "Latest Claude Sonnet" },
  { name: "haiku", desc: "Latest Claude Haiku" },
  { name: "opusplan", desc: "Opus for planning, Sonnet for execution" },
  { name: "claude-opus-4-8", desc: "Opus 4.8 — latest" },
  { name: "claude-opus-4-7", desc: "Opus 4.7" },
  { name: "claude-opus-4-6", desc: "Opus 4.6" },
  { name: "claude-sonnet-4-6", desc: "Sonnet 4.6" },
  { name: "claude-haiku-4-5", desc: "Haiku 4.5 — fastest" },
  { name: "claude-fable-5", desc: "Fable 5" },
];

export const CLAUDE_SLASH_COMMANDS: ClaudeSlashCommand[] = [
  { name: "/clear", desc: "New conversation", aliases: ["/reset", "/new"] },
  { name: "/compact", desc: "Compact conversation with optional focus" },
  { name: "/resume", desc: "Resume a session or open picker" },
  { name: "/branch", desc: "Fork current conversation" },
  { name: "/rename", desc: "Rename current session" },
  { name: "/exit", desc: "Exit the CLI" },
  { name: "/model", desc: "Select/change AI model" },
  { name: "/effort", desc: "Set effort level (low/medium/high/max)" },
  { name: "/config", desc: "Open Settings interface" },
  { name: "/fast", desc: "Toggle fast mode" },
  { name: "/theme", desc: "Change color theme" },
  { name: "/plan", desc: "Enter plan mode" },
  { name: "/diff", desc: "View uncommitted changes" },
  { name: "/rewind", desc: "Rewind conversation/code to prior point" },
  { name: "/review", desc: "Review a pull request" },
  { name: "/context", desc: "Visualize context usage" },
  { name: "/cost", desc: "Show token usage stats" },
  { name: "/usage", desc: "Show plan limits/rate limits" },
  { name: "/help", desc: "Show help" },
  { name: "/doctor", desc: "Diagnose installation" },
  { name: "/init", desc: "Initialize CLAUDE.md" },
  { name: "/memory", desc: "Edit memory files" },
  { name: "/permissions", desc: "Manage tool permissions" },
  { name: "/skills", desc: "List available skills" },
  { name: "/mcp", desc: "Manage MCP server connections" },
  { name: "/hooks", desc: "View hook configurations" },
  { name: "/simplify", desc: "Code review for quality/efficiency" },
  { name: "/loop", desc: "Run a prompt repeatedly" },
  { name: "/schedule", desc: "Create/manage scheduled tasks" },
  { name: "/security-review", desc: "Security review of pending changes" },
];
