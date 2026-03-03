# session-sync

[![CI](https://github.com/npow/session-sync/actions/workflows/ci.yml/badge.svg)](https://github.com/npow/session-sync/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/session-sync)](https://www.npmjs.com/package/session-sync)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/node-22+-blue.svg)](https://nodejs.org/)

Switch from Claude Code to Codex or any AI coding agent without losing your session.

## The problem

You're mid-task in Claude Code and want to continue in Codex or another agent. Your tool calls, conversation, and working context are trapped in Claude Code's format — the other agent has no idea what you've been doing. You start over, re-explain the codebase, and rediscover what was already tried.

## Quick start

```bash
npm install -g session-sync
cd your-project
session-sync init
```

That's it. From now on, every Claude Code tool call is automatically translated and written into each detected agent's native sessions directory. When you want to switch:

```bash
session-sync status
# → codex --continue abc123def456
```

## Install

```bash
npm install -g session-sync
```

Requires Node.js 22+.

## Usage

### Initialize in a project

```bash
cd your-project
session-sync init
```

Detects installed agents (Codex, Amp, Gemini CLI), registers the PostToolUse and Stop hooks in `.claude/settings.json`, and writes `.session-sync/config.json`.

### Check active sessions

```bash
session-sync status
```

```
Session abc12345 (main @ a1b2c3d)
  codex  →  codex --continue rollout-deadbeef  (47 records)
  amp    →  amp --session amp-session-cafebabe  (47 records)
```

### List all synced sessions

```bash
session-sync list
session-sync list --json
```

### Pause and resume

```bash
session-sync pause    # hooks stay registered but do nothing
session-sync resume   # re-enable sync
```

### Clean up old sessions

```bash
session-sync clean --older-than 30
session-sync clean --older-than 7 --dry-run
```

## How it works

`session-sync` installs two Claude Code hooks:

- **PostToolUse** — fires after every tool call (Bash, Read, Edit, etc.), translates the tool exchange to each target agent's format, and appends it to that agent's session file in real time
- **Stop** — sweeps the transcript for text-only turns (assistant reasoning, user messages) that PostToolUse doesn't see, and appends them before the session ends

Translation uses [@npow/interchange-core](https://www.npmjs.com/package/@npow/interchange-core) to convert between Claude Code's format and the Codex rollout JSONL / OpenAI chat JSONL formats used by Codex, Amp, and Gemini CLI.

The hook exits 0 in all cases and never writes to stdout/stderr — it never blocks Claude Code.

## Development

```bash
git clone https://github.com/npow/session-sync.git
cd session-sync
npm install
npm test
npm run build
```

## License

[Apache 2.0](LICENSE)
