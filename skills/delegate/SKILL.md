---
name: delegate
description: Use when offloading any non-complex task to save main model quota — bulk reads/searches that burn context (large files, recursive grep, verbose output, 3+ unfamiliar files), OR well-scoped coding tasks (single-file, isolated, no architectural decisions) where a secondary model is sufficient. Routes to Antigravity Opus 4.6 (max thinking) first for code, Gemini Flash (high thinking) for lookup, with automatic fallback on quota exhaustion.
---

# Delegate Skill

Offload tasks to a secondary model pool via `scripts/delegate.mjs` (or `npx hybrid-ai-delegate` after publish). Uses `opencode run` with Antigravity models; a legacy HTTP mode supports any OpenAI-compatible proxy.

## Task Types and Model Routing

| Flag | Use for | Models (in order) |
|------|---------|-------------------|
| `--type=code` (default) | Single-file coding, test gen, refactors | Opus 4.6 `:max` → Flash `:high` fallback |
| `--type=lookup` | File reads, grep, summarize, extraction | Flash `:high` directly |

- **`--type=code`**: Opus 4.6 with max thinking budget gives highest quality for coding tasks. Falls back to Flash:high automatically when Opus quota is exhausted.
- **`--type=lookup`**: Flash alone is sufficient for extraction — no need for Opus thinking budget.

## What to Delegate

### Lookup / extraction (`--type=lookup`)
- Reading 3+ unfamiliar files to gather facts
- Recursive grep/find with verbose output
- Summarizing large command output (npm ls, logs, dependency trees)
- Scanning for all usages of a symbol across a codebase
- Building a Context Pack for a SPEC

### Non-complex coding (`--type=code`)
- Single-file implementations that are well-scoped and isolated
- Simple utility functions, helpers, or type definitions
- Test generation for an existing function
- Code format / style fixes, variable renames within one file
- Boilerplate that follows an obvious existing pattern

## When NOT to Delegate

- Multi-file refactors or cross-cutting changes
- Anything requiring architectural judgment (data model, API design, tradeoffs)
- Tasks inside the Architect/Build/Review workflow
- Tasks needing deep knowledge of the current conversation context
- Tasks where you already have the relevant files in context — just do it directly

**Delegation has round-trip overhead. Only delegate when token savings clearly outweigh it.**

## How to Call

```sh
# Coding task (Opus:max → Flash:high on quota exhaustion)
node scripts/delegate.mjs --type=code "implement parseConfig in src/config.ts per the SPEC"

# Lookup / extraction (Flash:high)
node scripts/delegate.mjs --type=lookup "list every export in src/foo.ts with its signature"

# Pipe large input
big-command | node scripts/delegate.mjs --type=lookup --stdin "summarize the relevant errors"

# After publish (via npx)
npx -y hybrid-ai-delegate --type=code "implement parseConfig"
npx -y github:LittleKai/hybrid-ai-skills hybrid-ai-delegate --type=lookup "task"
```

## Verify the Output

Always spot-check returned paths, signatures, and line numbers. For code output, review for correctness before applying.

---

## Antigravity Setup (OpenCode Runner)

### Prerequisites
1. `opencode` CLI installed and authenticated
2. `opencode-antigravity-auth` plugin configured (see `deps/opencode-antigravity-auth/`)
3. Env vars set in shell profile or project `.env`

### Env vars

```sh
DELEGATE_RUNNER=opencode
GCLI_MODELS_CODE=google/antigravity-claude-opus-4-6-thinking:max,google/antigravity-gemini-3.5-flash:high
GCLI_MODELS_LOOKUP=google/antigravity-gemini-3.5-flash:high
```

**Model spec format:** `model:variant` — the variant is passed as `--variant` to `opencode run`.
- `google/antigravity-claude-opus-4-6-thinking:max` → 32768 thinking tokens (best for coding)
- `google/antigravity-gemini-3.5-flash:high` → high thinking level for Flash

**Fallback:** On quota exhaustion (429 / "quota exhausted" in response), `delegate.mjs` automatically moves to the next model in the list. Any other error is fatal.

### Install plugin and configure opencode

Run the install script with the plugin setup flag:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1 -InstallOpenCodePlugin
```

This updates `~/.config/opencode/opencode.json` to use the bundled plugin at `deps/opencode-antigravity-auth/`.

---

## Legacy HTTP Setup (OpenAI-compatible proxy)

When `DELEGATE_RUNNER` is not set, the script uses direct HTTP:

```sh
GCLI_API_KEY=key_aaa:3,key_bbb:1   # weighted pool
GCLI_BASE_URL=https://your-proxy/v1
GCLI_MODEL=gemini-3.1-pro           # optional, default gemini-3.1-pro
```

See `.env.example` for all options.
