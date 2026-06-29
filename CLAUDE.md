# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`hybrid-ai-skills` is a **cross-agent plugin** (Claude Code + Codex) that packages three role-based skills for a token-efficient "Hybrid AI" workflow. There is no application code to build or test — the deliverables are Markdown skill definitions plus the plugin manifests that make them discoverable. Editing this repo means editing prompt/instruction content and JSON manifests, then verifying discovery in the host agent.

## The four skills (the actual product)

Each skill is a single `SKILL.md` under `skills/<name>/` with YAML frontmatter (`name`, `description`) followed by role instructions:

- **`architect`** — clarifies the request, then writes a Builder-ready `SPEC.md` (or phase files). Plans only; does not write implementation code unless asked.
- **`build`** — reads the SPEC, runs preflight verification, implements, and writes `BUILDER_LOG.md`.
- **`review`** — reads `BUILDER_LOG.md` + SPEC + git diff and verifies the work against acceptance criteria.
- **`delegate`** — offloads non-complex tasks (context extraction, single-file coding, test gen) to a secondary model pool to preserve main model quota. Routes to Antigravity Opus 4.6 → Gemini Flash fallback via `opencode run` subprocess.

These three define a handoff protocol that operates on artifacts in the *target* project (not this repo), all under a single **`.hybrid-ai/` folder at the target project root**: `.hybrid-ai/SPEC.md` / `SPEC-phase-N.md`, `BUILDER_LOG.md`, `REVIEW_LOG.md`, `builder-questions.md`, and `archive/`. The skills are required to use this exact root-level path and must not auto-discover similarly named files in subdirectories/sub-projects (monorepo safety). When editing one skill, keep these cross-references consistent across all three — e.g. the `.hybrid-ai/` artifact paths, the MANDATORY artifact-location block, the placeholder-scan token list, the phase-argument convention (`phase N`), and the auto-archive-before-overwrite rule appear in multiple files and must stay aligned.

## Manifest structure (keep these in sync on version bumps)

The same plugin is described by four manifests targeting two agent ecosystems. A version change must be applied to all of them:

- `.claude-plugin/marketplace.json` — Claude Code marketplace entry (`source: "./"`).
- `.claude-plugin/plugin.json` — Claude Code plugin; its `skills` array must list every skill dir (`./skills/architect`, etc.).
- `.codex-plugin/plugin.json` — Codex plugin; uses `skills: "./skills/"` plus an `interface` block.
- `.agents/plugins/marketplace.json` — Codex marketplace discovery wrapper.

Note the **flat layout**: `skills/` lives at the repo root. (An earlier revision experimented with a nested `plugins/hybrid-ai-skills/` layout; the current shipped layout is flat — do not reintroduce the nested one without updating every manifest path and the install script.)

## Delegate skill — global setup

The `delegate` skill is installed globally alongside the other three skills and requires environment variables to call its secondary model pool. Set these in your shell profile or in the target project's `.env`:

```sh
# Antigravity via opencode (primary recommended mode)
DELEGATE_RUNNER=opencode
# --type=code (default): Opus 4.6 max thinking → Flash high fallback on quota exhaustion
GCLI_MODELS_CODE=google/antigravity-claude-opus-4-6-thinking:max,google/antigravity-gemini-3.5-flash:high
# --type=lookup: Flash high directly for extraction/search tasks
GCLI_MODELS_LOOKUP=google/antigravity-gemini-3.5-flash:high
```

**Model spec format:** `model:variant` — variant is passed as `--variant` to `opencode run`.
**How model fallback works:** `delegate.mjs` tries each model in the selected pool left-to-right. On quota exhaustion it moves to the next model automatically.

**Dependency:** `opencode-antigravity-auth` plugin is bundled as a git submodule at `deps/opencode-antigravity-auth/`. Run `install-global.ps1 -InstallOpenCodePlugin` to configure opencode to use it.

See `skills/delegate/SKILL.md` for the legacy HTTP mode and full usage docs.

The `install-global.ps1 -InstallClaudemd` switch appends a delegate block to `~/.claude/CLAUDE.md` so Claude Code is globally aware of this skill across all projects.

## Local install / testing

Copy the skill files into the global discovery directories for Claude Code, Codex, OpenCode, and Antigravity:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1
# Preview targets without writing:
powershell -ExecutionPolicy Bypass -File .\scripts\install-global.ps1 -DryRun
```

`install-global.ps1` resolves target roots per agent, copies `skills/architect|build|review`, then verifies each installed `SKILL.md` by SHA-256 hash against the source. After installing, **restart the agent app or open a new session** so skill caches reload. To verify a change end-to-end, run the script and then invoke `/skills architect|build|review` in the host agent.

`CODEX_LOCAL_PLUGIN_SETUP.md` documents a junction-based local marketplace wrapper for Codex Desktop builds that reject `path: "./"` marketplace entries.

## Conventions when editing skills

- Skill instruction prose is the executable artifact — precision matters more than brevity. Preserve the **MANDATORY** markers and the literal artifact filenames/paths; downstream behavior depends on them.
- The skills assume the host agent reads project context first (`CLAUDE.md`, `AGENTS.md`, `README.md`, `.claude/`) and prefer `rg` (with CodeGraph when a `.codegraph/` index exists) over broad file scanning.
