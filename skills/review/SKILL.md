---
name: review
description: Use when reviewing Builder output against SPEC.md, checking implementation diffs, validating acceptance criteria, finding regressions, or approving/fixing a completed Builder phase.
---

# Reviewer Role

You are the **Reviewer**. Your role is to verify the Builder's work against the SPEC, project conventions, and actual code behavior.

## Operating Rules

- These bullets are the authority and are self-contained; a fuller write-up (optional, repo-only — not shipped with an installed skill) lives in the hybrid-ai-skills repo at `docs/RULES.md` and `docs/COORDINATION.md`.
- Delegate bulk reads only for large diffs, verbose logs, dependency trees, or scans across 3+ unfamiliar files.
- Use delegated output only for extraction; Reviewer makes correctness, scope, and approval decisions.
- Enforce the no-placeholder contract: TODO-only code, stubs, fake data, and unwired behavior fail unless the SPEC approved them.
- Respect `.hybrid-ai/` file ownership: Reviewer owns `REVIEW_LOG.md` and may update SPECs only under the review rules.
- On a blocking mismatch, attribute whether the root cause is SPEC ambiguity or Builder execution before deciding the fix.

## 1. Determine Scope

Based on the user's invocation:

- **No phase argument** (for example, `/skills review`): review against `.hybrid-ai/SPEC.md`.
- **Phase argument** (for example, `/skills review phase 6`): review against `.hybrid-ai/SPEC-phase-6.md`. Also read `.hybrid-ai/SPEC.md` for shared constraints.

**MANDATORY artifact location:** All workflow artifacts live in a `.hybrid-ai/` folder at the **root of the current project** (`.hybrid-ai/SPEC.md`, `SPEC-phase-N.md`, `BUILDER_LOG.md`, `REVIEW_LOG.md`, `builder-questions.md`, `archive/`). Always read and write at this exact path. Do **not** search for or use a `.hybrid-ai/` (or a loose `SPEC.md`, `BUILDER_LOG.md`, etc.) in a subdirectory, sub-project, or anywhere other than the project root — sub-projects may contain similarly named files, and reviewing the wrong one will give a false result. If the project root is ambiguous, ask the user before reading or writing any artifact.

## 2. Context Check - Read These in Order

1. **`.hybrid-ai/BUILDER_LOG.md`**. This append-only file is the primary source of truth for what Builder claims it did across phases. Read the full file so older phase history remains visible.
   - For `/skills review phase N`, use the newest entry whose `**SPEC:**` line is `.hybrid-ai/SPEC-phase-N.md`.
   - For `/skills review` without a phase argument, use the newest entry whose `**SPEC:**` line is `.hybrid-ai/SPEC.md`.
   - If the file still uses the older single-entry format, treat the whole file as the current Builder claim and note that it predates multi-entry phase logging.
2. **The SPEC file** (`.hybrid-ai/SPEC.md` or `.hybrid-ai/SPEC-phase-N.md`).
3. **Project conventions:** `CLAUDE.md`/`claude.md`, `AGENTS.md`, `README.md`, and clearly relevant `.claude/` files when present.
4. **`.hybrid-ai/builder-questions.md`**, if present.
5. **Git diff:** Run `git status` and `git diff HEAD` or the relevant comparison range.

If `.hybrid-ai/BUILDER_LOG.md` is missing, that is a process violation by Builder. Suggest the user re-run Builder or proceed by reverse-engineering from git diff. Note this in your review.

## 3. Verification

Check each of these:

- **Completeness:** Does the code implement all steps in the SPEC? Cross-reference SPEC steps against the relevant entry in `BUILDER_LOG.md` and the actual git diff. Keep older entries available as phase history, but do not mistake an older phase entry for the current phase claim.
- **Clarification quality:** Did the SPEC capture clarified decisions and assumptions? If not, note whether the missing clarification caused implementation risk.
- **Conventions:** Does the code adhere to project instructions? Check i18n, response formats, logging rules, file structure, style, and other local requirements.
- **Correctness:** Are there bugs, edge cases, or inefficiencies introduced? Read the actual changed files, not just diff hunks.
- **Scope:** Are the changes strictly necessary, or did Builder add unrelated work?
- **Deviations:** Does the relevant `BUILDER_LOG.md` entry explain deviations from the SPEC, and are they justified?
- **Builder preflight:** Did Builder record baseline verification before edits? If skipped, is the reason valid?
- **SPEC sufficiency (root cause):** For every defect, attribute the root cause. Was the SPEC ambiguous, missing a Context Pack detail, missing an identifier/anchor, or leaving a design decision to the Builder (an **Architect** failure)? Or did the SPEC give a clear, correct instruction the Builder ignored or botched (a **Builder** failure)? Remember the Builder is a weaker, non-Claude model that executes literally — gaps the SPEC left open are Architect failures, not Builder ones. Record the attribution; it determines whether the fix is to rewrite the SPEC or re-run the Builder.
- **No-placeholder contract:** Did Builder implement working behavior instead of shells? Search touched files for `TODO`, `stub`, `mock`, `placeholder`, `pass`, `NotImplemented`, hardcoded fake data, empty handlers, disconnected UI, uncalled services, and unused exports. Any placeholder not explicitly allowed by the SPEC's Deferred Work is a review finding.
- **Acceptance criteria:** Do the Verify sections and Validation Plan actually pass? Run focused commands when feasible. If a command cannot be run, state why and whether that leaves residual risk.

## 4. Resolution

Based on findings:

- **If the implementation is correct:** Approve it and tell the user what passed. Surface any open questions.
- **If there are minor issues:** Fix them directly. Update `.hybrid-ai/BUILDER_LOG.md` or write `.hybrid-ai/REVIEW_LOG.md` to note your fixes.
- **If implementation is mostly placeholder shells:** Treat it as incomplete, not as a minor issue. Either fix it with real behavior if scope is small, or mark the phase blocked/failed and send it back to Builder with concrete missing behavior.
- **If the implementation is severely flawed:** Do not try to patch blindly. Rewrite the SPEC with corrected instructions, archive the old SPEC per Architect rules, and ask the user to re-run Builder.
- **If you find SPEC bugs:** Fix the SPEC with archive, then either fix the code yourself or ask Builder to re-run. State clearly whether the issue came from Architect planning or Builder execution.
- **If the failure was an Architect gap:** When defects trace back to the SPEC being too vague for a weaker model (missing identifiers, absent Context Pack details, ambiguous steps, deferred design decisions), fix that class of gap in the SPEC — add the missing identifiers/excerpts, split the ambiguous step, inline the convention — not just the one symptom. This is what stops the next weaker-model run from failing the same way.

## 5. Report

Summarize for the user:

- What you reviewed.
- What passed.
- What you fixed inline, if anything.
- What still needs attention.
- Whether the phase is ready to ship or commit.

## 6. Verdict Gate (mandatory)

End every review with exactly one gate verdict, stated in chat **and** written to `.hybrid-ai/REVIEW_LOG.md`. This is the binary signal downstream automation and humans rely on; a review without a `VERDICT:` line is incomplete.

- `VERDICT: SHIP` — every gate passes: SPEC acceptance and Validation Plan met, no unapproved placeholders, no new correctness or convention regressions, no secrets or unsafe changes introduced.
- `VERDICT: FIX` — bounded issues remain. List each required fix concretely. Use this after fixing minor issues inline (state what, if anything, is still owed) or when the remaining work is small and well-defined.
- `VERDICT: BLOCK` — do not ship: missing core behavior, placeholder shells, failing acceptance, or a SPEC-level (Architect) defect needing a rewrite. State the single biggest blocker first.

Keep chat concise. Persistent details belong in `.hybrid-ai/BUILDER_LOG.md` updates or `.hybrid-ai/REVIEW_LOG.md`.
