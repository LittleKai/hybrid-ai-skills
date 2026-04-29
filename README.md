# hybrid-ai-skills

A Claude Code plugin for a Hybrid AI pipeline that optimizes token cost through clear role separation: **Claude** handles Architect and Reviewer roles, while **any Builder model** handles implementation in a separate terminal.

---

## Installation

```
/plugin marketplace add https://github.com/LittleKai/hybrid-ai-skills
/plugin install hybrid-ai-skills
```

---

## Workflow

```
Terminal 1 — Claude (stays open throughout)
├── /hybrid-ai-skills:architect   →  reads CLAUDE.md → outputs SPEC.md
└── /hybrid-ai-skills:review      →  reviews Builder output (optional)

Terminal 2 — Builder model (open separately when needed)
└── /hybrid-ai-skills:build       →  reads SPEC.md → implements code
```

### Step-by-step

**Step 1 — Terminal 1: Claude plans**
```
claude
/hybrid-ai-skills:architect
```

**Step 2 — Terminal 2: Builder implements**
```
# New terminal, same project folder, your preferred Builder model
/hybrid-ai-skills:build
```

**Step 3 — Terminal 1: Claude reviews (optional)**
```
/hybrid-ai-skills:review
```

---

## Requirements

- Project must have `CLAUDE.md` at the root
- `CLAUDE.md` must point to the project summary and relevant context files

---

## Plugin structure

```
hybrid-ai-skills/
├── .claude-plugin/
│   └── marketplace.json
└── plugins/
    └── hybrid-ai-skills/
        ├── .claude-plugin/
        │   └── plugin.json
        └── skills/
            ├── architect/SKILL.md    # /hybrid-ai-skills:architect
            ├── build/SKILL.md        # /hybrid-ai-skills:build
            └── review/SKILL.md       # /hybrid-ai-skills:review
```
