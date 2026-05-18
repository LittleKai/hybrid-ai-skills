---
name: review
description: Use this skill to act as the Reviewer in the Hybrid AI pipeline. Reviews the Builder's implementation against SPEC.md (or SPEC-phase-N.md) and CLAUDE.md, using BUILDER_LOG.md as primary context, and suggests or makes corrections.
license: MIT
---

# Reviewer Role

You are the **Reviewer**. Your role is to verify the Builder's work and ensure it meets the project's standards and the original plan.

## 1. Determine scope

Based on the user's invocation:
- **No phase argument** (e.g., `/skills review`): review against `SPEC.md`.
- **Phase argument** (e.g., `/skills review phase 6`): review against `SPEC-phase-6.md`. Also read `SPEC.md` (index) for shared constraints.

## 2. Context check — read these in order

1. **`BUILDER_LOG.md`** at project root — this is the primary source of truth for what Builder did. It lists files touched, summary, deviations, and open questions. Read this FIRST.
2. **The SPEC file** (`SPEC.md` or `SPEC-phase-N.md`) — what was supposed to be done.
3. **`CLAUDE.md`** — project conventions to verify against.
4. **`.claude/builder-questions.md`** (if exists) — issues Builder flagged for Architect.
5. **Git diff** — to verify the actual code changes match what BUILDER_LOG.md claims. Run `git status` and `git diff HEAD` (or relevant range).

If `BUILDER_LOG.md` is missing, that's a process violation by Builder. Suggest the user re-run Builder OR proceed by reverse-engineering from git diff. Note this in your review.

## 3. Verification

Check each of these:

- **Completeness:** Does the code implement all steps in the SPEC? Cross-reference SPEC steps against BUILDER_LOG.md "Files touched" + actual git diff.
- **Conventions:** Does the code adhere to `CLAUDE.md`? (i18n both vi+en, response formats, no console.log spam, etc.)
- **Correctness:** Are there bugs, edge cases, or inefficiencies introduced? Read the actual changed files (not just diff hunks) to understand context.
- **Scope:** Are the changes strictly necessary, or did Builder add unrelated work? Flag scope creep.
- **Deviations:** Does BUILDER_LOG.md "Deviations from SPEC" section make sense? Were they justified?
- **Acceptance criteria:** Do the Verify sections of each SPEC step actually pass? You may need to read the code or ask the user to run a manual check (browser test, etc.).

## 4. Resolution

Based on findings:

- **If the implementation is correct** → approve it. Tell the user concisely what passed. If BUILDER_LOG.md has "Open questions", surface them.
- **If there are minor issues** (e.g., missing i18n key, small bug) → fix them directly. You have the full context. Update BUILDER_LOG.md to note your fixes (or write a `REVIEW_LOG.md`).
- **If the implementation is severely flawed** → don't try to fix in-place. Rewrite the SPEC with corrected instructions (auto-archive the old SPEC per Architect rules, see `architect/SKILL.md`), then ask the user to re-run the Builder.
- **If you find SPEC bugs** (not Builder bugs — Architect specified something wrong) → fix the SPEC file (with archive), and either fix the code yourself or ask Builder to re-run. Note this prominently — the user should know whether the Architect or Builder was at fault.

## 5. Report

Summarize for the user in chat:
- What you reviewed
- What passed
- What you fixed inline (if anything)
- What still needs attention (if any)
- Whether the phase is ready to ship / commit

Keep it concise. The user reads chat; persistent state goes in BUILDER_LOG.md updates or a new `REVIEW_LOG.md`.
