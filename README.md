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

---

## Workflow

Codex note: after installing or updating a plugin or copying skill files, fully
restart Codex and start a new thread. Invoke installed skills from `/skills`,
then choose `architect`, `build`, or `review`.

```text
Terminal 1 - Architect / Reviewer
|-- /skills architect         -> reads CLAUDE.md -> writes SPEC.md
`-- /skills review (phase N?) -> reads BUILDER_LOG.md + SPEC + diff

Terminal 2 - Builder model
`-- /skills build (phase N?)  -> reads SPEC -> implements code -> writes BUILDER_LOG.md
```

### Step-by-step

**Step 1 - Terminal 1: Architect plans**

```text
/skills architect
```

The Architect auto-archives any existing SPEC.md to `.spec-archive/` before
overwriting, and spot-checks the SPEC against the codebase (via grep) to catch
references to files/APIs that don't exist.

**Step 2 - Terminal 2: Builder implements**

```text
# New terminal, same project folder, your preferred Builder model
/skills build
# Or, for phase-based SPECs:
/skills build phase 6
```

The Builder writes `BUILDER_LOG.md` when complete, listing files touched +
summary + deviations + open questions. This frees the Reviewer from
reverse-engineering work from `git diff` alone.

**Step 3 - Terminal 1: Reviewer verifies (optional)**

```text
/skills review
# Or, for phase-based:
/skills review phase 6
```

---

## SPEC conventions

The Architect chooses between two layouts based on project complexity:

**Monolithic** — single `SPEC.md` at project root. Best for short or single-phase work.

**Phase-based** — `SPEC.md` as index, plus `SPEC-phase-N.md` for each phase.
Each phase file is self-contained (own Goal/Steps/Verify). Index lists phases
with brief goals. Use when project has multiple sequential phases (e.g., a
multi-week roadmap).

The Builder and Reviewer accept an optional `phase N` argument and read the
corresponding file. With no argument, they default to `SPEC.md`.

## Archive policy

When the Architect overwrites `SPEC.md` or `SPEC-phase-N.md`, the old version
is copied to `.spec-archive/YYYY-MM-DD_HHMMSS-{filename}.md` first. This
preserves history when SPEC is revised mid-project (e.g., after a Reviewer
finds the original SPEC had bugs).

The Reviewer follows the same rule when rewriting SPECs.

---

## Requirements

- Project must have `CLAUDE.md` at the root.
- `CLAUDE.md` must point to the project summary and relevant context files.
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
