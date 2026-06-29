# hybrid-ai-skills

A Hybrid AI workflow plugin with four role-based skills that optimize token cost through clear
role separation: Architect plans, Builder implements, Reviewer verifies, and Delegate offloads
non-complex work to a secondary model pool to preserve main-model quota.

Supports both Claude Code and Codex plugin discovery.

---

## Skills

| Skill | Purpose |
|---|---|
| `architect` | Clarifies request, writes a Builder-ready `SPEC.md` (or phase files). Plans only. |
| `build` | Reads SPEC, runs preflight, implements code, writes `BUILDER_LOG.md`. |
| `review` | Reads `BUILDER_LOG.md` + SPEC + git diff, verifies against acceptance criteria. |
| `delegate` | Offloads bulk reads, single-file coding, test gen to secondary model pool (Antigravity). |

---

## Installation

### Claude Code

```text
/plugin marketplace add https://github.com/LittleKai/hybrid-ai-skills
/plugin install hybrid-ai-skills
```

### Codex

This repo includes:

- `.codex-plugin/plugin.json` for the plugin manifest.
- `.agents/plugins/marketplace.json` for Codex marketplace discovery.

Current Codex builds can also discover skills copied directly into either of
these user skill directories:

- `%USERPROFILE%\.agents\skills\hybrid-ai-skills`
- `%USERPROFILE%\.codex\skills`

After copying or installing skills, restart Codex and use `/skills` to invoke the skill.

> Note: Some Codex Desktop versions reject local marketplace entries whose plugin source path
> is `./`. If `/plugins` does not show this plugin, use the local marketplace wrapper documented
> in [`CODEX_LOCAL_PLUGIN_SETUP.md`](CODEX_LOCAL_PLUGIN_SETUP.md).

Add the GitHub repository as a Codex marketplace:

```text
codex plugin marketplace add LittleKai/hybrid-ai-skills
```

To update the marketplace later:

```text
codex plugin marketplace upgrade hybrid-ai-skills-marketplace
```

### Global local install

Copies current local skill files into the common global locations for Claude Code, Codex,
OpenCode, and Antigravity. Also optionally injects the delegate block into agent config files.

```powershell
# Install skills to all discovery dirs
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1

# Also append delegate block to ~/.claude/CLAUDE.md
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1 -InstallClaudemd

# Also append delegate block to ~/.codex/AGENTS.md and ~/.agents/AGENTS.md
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1 -InstallAgentsmd

# Also configure opencode-antigravity-auth plugin in opencode.json
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1 -InstallOpenCodePlugin

# Preview targets without writing
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1 -DryRun
```

The script verifies installed `SKILL.md` files by SHA-256 hash. Restart the agent app or open
a new session after installing so skill caches reload.

---

## Workflow

Codex note: after installing or updating a plugin or copying skill files, fully restart Codex
and start a new thread. Invoke installed skills from `/skills`, then choose
`architect`, `build`, or `review`.

```text
Terminal 1 - Architect / Reviewer
|-- /skills architect         -> reads CLAUDE.md -> writes .hybrid-ai/SPEC.md
`-- /skills review (phase N?) -> reads .hybrid-ai/BUILDER_LOG.md + SPEC + diff

Terminal 2 - Builder model
`-- /skills build (phase N?)  -> reads SPEC -> implements code -> writes .hybrid-ai/BUILDER_LOG.md

Either terminal - Delegate (offload quota-heavy subtasks)
`-- /delegate "task"          -> routes to Antigravity Opus 4.6 → Flash fallback
```

### Step-by-step

**Step 1 - Terminal 1: Architect plans**

```text
/skills architect
```

The Architect clarifies the project and request before writing a SPEC,
auto-archives any existing SPEC to `.hybrid-ai/archive/` before overwriting, and
spot-checks the SPEC against the codebase (via CodeGraph/rg when available) to
catch references to files/APIs that don't exist. SPECs also include a
No-Placeholder Contract so Builder knows whether the phase must ship working
behavior or is intentionally scaffold-only.

The SPEC is written for a **weaker, non-Claude Builder model** (for example,
Gemini Pro 3.1) that has no access to the planning conversation and explores
the codebase poorly. To make a weaker model produce Claude-quality output, the
Architect inlines a **Context Pack** (exact paths, code excerpts, identifiers,
and the project conventions restated inline), writes small self-contained steps
with exact location anchors and per-step "Do NOT" guardrails, and supplies
worked code for the hard/error-prone parts while leaving mechanical wiring for
the Builder.

**Step 2 - Terminal 2: Builder implements**

```text
# New terminal, same project folder, your preferred Builder model
/skills build
# Or, for phase-based SPECs:
/skills build phase 6
```

The Builder runs a focused preflight verification before implementation when
feasible, then writes `.hybrid-ai/BUILDER_LOG.md` when complete, listing files touched,
baseline/final verification, placeholder scan results, deviations, and open
questions.

**Step 3 - Terminal 1: Reviewer verifies (optional)**

```text
/skills review
# Or, for phase-based:
/skills review phase 6
```

---

## Delegate skill

The `delegate` skill offloads non-complex subtasks (bulk file reads, grep summarization,
single-file coding, test generation) to a secondary model pool via `opencode run`, preserving
main-model quota for architectural decisions.

### Model routing

| Flag | Pool | Models (left-to-right fallback) |
|---|---|---|
| `--type=code` (default) | `GCLI_MODELS_CODE` | Opus 4.6 `:max` → Flash `:high` on quota |
| `--type=lookup` | `GCLI_MODELS_LOOKUP` | Flash `:high` directly |

### Usage

```bash
# Code task (default) — routed to Opus 4.6, Flash fallback
node scripts/delegate.mjs "implement parseConfig in src/config.ts"
node scripts/delegate.mjs --type=code "write unit tests for auth.ts"

# Lookup task — routed directly to Flash
node scripts/delegate.mjs --type=lookup "list every export in src/foo.ts"

# Pipe stdin into the prompt
cat build.log | node scripts/delegate.mjs --type=lookup --stdin "summarize the errors"

# Via slash command in Claude Code (after global install)
/delegate "task description"
```

### Setup

**1. Install the `opencode-antigravity-auth` plugin (bundled as submodule):**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1 -InstallOpenCodePlugin
```

This initializes `deps/opencode-antigravity-auth/`, runs `npm install` inside it, and
registers it in `~/.config/opencode/opencode.json`.

**2. Set env vars in your shell profile:**

```sh
DELEGATE_RUNNER=opencode
GCLI_MODELS_CODE=google/antigravity-claude-opus-4-6-thinking:max,google/antigravity-gemini-3.5-flash:high
GCLI_MODELS_LOOKUP=google/antigravity-gemini-3.5-flash:high

# Optional: set agent name so log files are named delegate-claude.log / delegate-codex.log
DELEGATE_AGENT=claude    # set in Claude Code profile
DELEGATE_AGENT=codex     # set in Codex profile
```

Model spec format: `model:variant` — variant (`:max`, `:high`, `:low`) is passed as
`--variant` to `opencode run`. Multiple models are tried left-to-right; quota exhaustion
triggers the next model automatically.

**3. Inject delegate block into agent config (optional, one-time):**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1 -InstallClaudemd -InstallAgentsmd
```

### Logging

All runs write to `logs/delegate-{agent}.log` inside the **target project directory** (gitignored).
Separate files per agent: `delegate-claude.log`, `delegate-codex.log`, `delegate-default.log`.

```powershell
# Tail in real time
Get-Content logs\delegate-claude.log -Wait

# Enable verbose DEBUG lines
$env:DELEGATE_DEBUG = "1"
node scripts/delegate.mjs "task"

# Override log path
$env:DELEGATE_LOG_FILE = "C:\custom\path.log"
```

Log format: `[2026-06-29T10:23:45.123Z] [delegate:INFO] [claude] trying model: ...`

---

## Artifact location

All workflow artifacts live in a `.hybrid-ai/` folder at the **root of the target project**:

```text
.hybrid-ai/
|-- SPEC.md
|-- SPEC-phase-N.md
|-- BUILDER_LOG.md
|-- REVIEW_LOG.md
|-- builder-questions.md
|-- notepads/
|-- plans/
|-- evidence/
|-- rules/
`-- archive/
```

See [`docs/COORDINATION.md`](docs/COORDINATION.md) for the file-ownership convention.

All three skills always use this exact path. They do **not** auto-discover a `.hybrid-ai/`
in a subdirectory or sub-project — a monorepo may contain similarly named files, and acting on
the wrong one would corrupt the handoff. If the project root is ambiguous, the skill asks first.

## SPEC conventions

The Architect chooses between two layouts based on project complexity:

**Monolithic** — single `.hybrid-ai/SPEC.md`. Best for short or single-phase work.

**Phase-based** — `.hybrid-ai/SPEC.md` as index, plus `.hybrid-ai/SPEC-phase-N.md` for each
phase. Each phase file is self-contained (own Goal/Steps/Verify). Index lists phases with brief
goals. Use when the project has multiple sequential phases.

The Builder and Reviewer accept an optional `phase N` argument and read the corresponding file.
With no argument, they default to `.hybrid-ai/SPEC.md`.

## Archive policy

When the Architect overwrites `.hybrid-ai/SPEC.md` or `.hybrid-ai/SPEC-phase-N.md`, the old
version is copied to `.hybrid-ai/archive/YYYY-MM-DD_HHMMSS-{filename}.md` first.

---

## Requirements

- Project should have at least one useful context source (`CLAUDE.md`, `AGENTS.md`, `README.md`,
  or files under `.claude/`).
- The Builder terminal must run in the same project folder so it can read the SPEC files.
- Delegate requires Node.js ≥ 18 and the `opencode` CLI with `opencode-antigravity-auth` plugin.

---

## Plugin structure

```text
hybrid-ai-skills/
|-- .agents/
|   `-- plugins/
|       `-- marketplace.json
|-- .claude-plugin/
|   |-- marketplace.json
|   `-- plugin.json
|-- .codex-plugin/
|   `-- plugin.json
|-- deps/
|   `-- opencode-antigravity-auth/   (git submodule — Antigravity auth plugin for opencode)
|-- docs/
|   |-- COORDINATION.md
|   `-- RULES.md
|-- scripts/
|   |-- delegate.mjs                 (delegate CLI, also exposed as npx hybrid-ai-delegate)
|   `-- install-global.ps1
|-- skills/
|   |-- architect/SKILL.md
|   |-- build/SKILL.md
|   |-- delegate/SKILL.md
|   `-- review/SKILL.md
|-- .env.example                     (delegate env var reference)
|-- package.json
`-- logs/                            (auto-created, gitignored — delegate run logs per agent)
```
