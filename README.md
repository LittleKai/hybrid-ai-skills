# hybrid-ai-skills

A Hybrid AI workflow plugin that optimizes token cost through clear role separation:
Architect plans, Builder implements, and Reviewer verifies.

The repo supports both Claude Code and Codex plugin discovery.

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

After copying or installing skills, restart Codex and use `/skills` to invoke
the skill.

> Note: Some Codex Desktop versions reject local marketplace entries whose
> plugin source path is `./`. If `/plugins` does not show this plugin, use the
> local marketplace wrapper documented in
> [`CODEX_LOCAL_PLUGIN_SETUP.md`](CODEX_LOCAL_PLUGIN_SETUP.md).

Add the GitHub repository as a Codex marketplace:

```text
codex plugin marketplace add LittleKai/hybrid-ai-skills
```

You can also use the full Git URL:

```text
codex plugin marketplace add https://github.com/LittleKai/hybrid-ai-skills
```

To update the marketplace later:

```text
codex plugin marketplace upgrade hybrid-ai-skills-marketplace
```

### Global local install

To copy the current local skill files into the common global locations for
Claude Code, Codex, OpenCode, and Antigravity:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1
```

Preview targets without writing:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1 -DryRun
```

The script verifies installed `SKILL.md` files by SHA-256 hash. Restart the
agent app or open a new session after installing so skill caches reload.

---

## Workflow

Codex note: after installing or updating a plugin or copying skill files, fully
restart Codex and start a new thread. Invoke installed skills from `/skills`,
then choose `architect`, `build`, or `review`.

```text
Terminal 1 - Architect / Reviewer
|-- /skills architect         -> reads CLAUDE.md -> writes .hybrid-ai/SPEC.md
`-- /skills review (phase N?) -> reads .hybrid-ai/BUILDER_LOG.md + SPEC + diff

Terminal 2 - Builder model
`-- /skills build (phase N?)  -> reads SPEC -> implements code -> writes .hybrid-ai/BUILDER_LOG.md
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
questions. This frees the Reviewer from reverse-engineering work from `git diff`
alone.

**Step 3 - Terminal 1: Reviewer verifies (optional)**

```text
/skills review
# Or, for phase-based:
/skills review phase 6
```

---

## Artifact location

All workflow artifacts live in a `.hybrid-ai/` folder at the **root of the
target project**, not loose at the project root:

```text
.hybrid-ai/
|-- SPEC.md
|-- SPEC-phase-N.md
|-- BUILDER_LOG.md
|-- REVIEW_LOG.md
|-- builder-questions.md
`-- archive/
```

All three skills always use this exact path. They do **not** auto-discover a
`.hybrid-ai/` (or a loose `SPEC.md`/`BUILDER_LOG.md`) in a subdirectory or
sub-project — a monorepo may contain similarly named files, and acting on the
wrong one would corrupt the handoff. If the project root is ambiguous, the skill
asks the user which directory is the root first.

## SPEC conventions

The Architect chooses between two layouts based on project complexity:

**Monolithic** — single `.hybrid-ai/SPEC.md`. Best for short or single-phase work.

**Phase-based** — `.hybrid-ai/SPEC.md` as index, plus `.hybrid-ai/SPEC-phase-N.md`
for each phase. Each phase file is self-contained (own Goal/Steps/Verify). Index
lists phases with brief goals. Use when project has multiple sequential phases
(e.g., a multi-week roadmap).

The Builder and Reviewer accept an optional `phase N` argument and read the
corresponding file. With no argument, they default to `.hybrid-ai/SPEC.md`.

## Archive policy

When the Architect overwrites `.hybrid-ai/SPEC.md` or `.hybrid-ai/SPEC-phase-N.md`,
the old version is copied to `.hybrid-ai/archive/YYYY-MM-DD_HHMMSS-{filename}.md`
first. This preserves history when SPEC is revised mid-project (e.g., after a
Reviewer finds the original SPEC had bugs).

The Reviewer follows the same rule when rewriting SPECs.

---

## Requirements

- Project should have at least one useful context source, such as `CLAUDE.md`,
  `AGENTS.md`, `README.md`, or relevant files under `.claude/`.
- If project context is missing, the Architect should ask for the minimum
  missing context before writing a SPEC.
- The Builder terminal must run in the same project folder so it can read the SPEC files.

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
`-- skills/
    |-- architect/SKILL.md
    |-- build/SKILL.md
    `-- review/SKILL.md
```
