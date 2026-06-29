# Coordination

Hybrid AI uses a file blackboard under the project-root `.hybrid-ai/` directory. The goal is simple coordination across a few terminals without locks, daemons, databases, or message buses.

## Blackboard Layout

```text
.hybrid-ai/
|-- SPEC.md
|-- SPEC-phase-N.md
|-- BUILDER_LOG.md
|-- REVIEW_LOG.md
|-- builder-questions.md
|-- notepads/
|   |-- architect.md
|   `-- builder.md
|-- plans/
|-- evidence/
|   `-- <task-id>/
|-- rules/
`-- archive/
```

- `SPEC.md` and `SPEC-phase-N.md` are owned by the Architect or Reviewer.
- `BUILDER_LOG.md` is owned by the Builder.
- `REVIEW_LOG.md` is owned by the Reviewer.
- `builder-questions.md` is append-only: Builder appends questions, Architect appends answers.
- `notepads/` is shared scratch, append-only, with one file per agent so writes never collide.
- `plans/` holds longer-lived plans and roadmaps.
- `evidence/<task-id>/` stores proof of work for a task, such as command output, diffs, and review notes.
- `rules/` can hold optional per-project rule overrides.
- `archive/` stores timestamped old SPEC files.

## File Ownership

Each role writes only the files it owns. Shared notes are append-only and split by agent. Do not have two agents edit the same file; ownership replaces locking.

There is one lead orchestrator, the Architect, that assigns work. Agents are not peers freely editing shared state.

## When To Graduate

The file blackboard is enough for about three agents. Move to a database or task queue only when many agents need concurrent status tracking. Move to a real message bus or OMO Team Mode only beyond that.
