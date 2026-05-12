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

```text
Terminal 1 - Architect / Reviewer
|-- /hybrid-ai-skills:architect  -> reads CLAUDE.md -> writes SPEC.md
`-- /hybrid-ai-skills:review     -> reviews Builder output (optional)

Terminal 2 - Builder model
`-- /hybrid-ai-skills:build      -> reads SPEC.md -> implements code
```

### Step-by-step

**Step 1 - Terminal 1: Architect plans**

```text
/hybrid-ai-skills:architect
```

**Step 2 - Terminal 2: Builder implements**

```text
# New terminal, same project folder, your preferred Builder model
/hybrid-ai-skills:build
```

**Step 3 - Terminal 1: Reviewer verifies (optional)**

```text
/hybrid-ai-skills:review
```

---

## Requirements

- Project must have `CLAUDE.md` at the root.
- `CLAUDE.md` must point to the project summary and relevant context files.
- The Builder terminal must run in the same project folder so it can read `SPEC.md`.

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
