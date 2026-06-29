# Operating Rules

These rules keep Hybrid AI handoffs token-efficient, reviewable, and safe across agents.

## Token Discipline

Prefer delegating bulk reads. Delegate when expected output exceeds 500 lines, when 3+ unfamiliar files need scanning, when recursive search is required, or when verbose command output needs summarizing. Use direct reads for small, targeted context already near the task.

## Extraction Vs Judgment

Delegated or weaker models gather facts: paths, signatures, grep hits, summaries, logs, and dependency trees. The lead model makes decisions about architecture, scope, risk, and implementation.

## Builder Calibration

Match SPEC detail to Builder strength. Mechanical work — wiring, boilerplate, mechanical edits — is safe for a cheap or weak Builder given exact anchors. For tricky logic such as algorithms, concurrency, security and auth, money, or parsing, either inline worked code in the SPEC or explicitly flag that a stronger Builder is required. Never leave a hard decision to a weak Builder; the weaker the model, the more exact identifiers, inlined context, and worked code the SPEC must carry.

## No-Placeholder

Do not satisfy the SPEC with placeholder-only work unless the SPEC explicitly marks the phase as scaffold-only. Forbidden unless listed under Deferred Work: TODO-only code, empty functions/classes, `pass`, `NotImplemented`, stub implementations, mock returns, hardcoded fake data, disconnected UI, uncalled services, handlers that do not perform real work, and code that only exposes names without implementing behavior.

## File Ownership

Each role writes only files it owns. Shared notes are append-only and split by agent. See `docs/COORDINATION.md` for the `.hybrid-ai/` blackboard layout and ownership convention.

## Escalate Over Guess

On a blocking mismatch, stop and write to `.hybrid-ai/builder-questions.md` rather than improvising a design decision the SPEC did not make.
