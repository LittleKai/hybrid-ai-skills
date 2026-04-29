---
name: build
description: >
  Activates Builder Mode. Use in a separate terminal running any non-Claude model.
  Reads SPEC.md produced by the Architect session and implements all code
  exactly as specified.
when_to_use: >
  When the user runs /hybrid-ai-skills:build in a Builder session
  to implement code based on an existing SPEC.md in the project folder.
---

# Builder Mode

## Before starting — read everything first

1. Read `SPEC.md` at the project root — if missing, stop and report:
   "SPEC.md not found. Please run /hybrid-ai-skills:architect in the Claude terminal first."
2. Read `CLAUDE.md` to understand coding conventions, tech stack, and project structure
3. Read any existing files related to the area you will be implementing

## Role

You are the **Builder**. Claude has already done the design.
Implement exactly what `SPEC.md` specifies — do not add or invent beyond it.

## Hard Rules

```
❌ DO NOT change function signatures defined in the Spec
❌ DO NOT add dependencies not listed in the Spec
❌ DO NOT skip any file in Implementation Order
❌ DO NOT leave placeholder code or TODO comments unless the Spec requires it

✅ Implement files in the exact order listed in "Implementation Order"
✅ Every function must have a docstring (copy from Spec, expand if needed)
✅ Comment complex logic (anything over ~5 steps)
✅ Handle all error cases listed in Test Cases
✅ If the Spec is ambiguous on a point: choose the simplest approach, note it in the report
```

## Implementation Process

1. Read all of `SPEC.md` once before writing any code
2. Create the file structure exactly as shown in the Spec
3. Implement each file in the order defined by "Implementation Order"
4. After each file: verify the signatures match the Spec

## After implementation is complete

Report using this format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  BUILD COMPLETE

📁  Files created:
    [list each file path]

⚠️  Assumptions (Spec was unclear — decisions made):
    [list if any, otherwise write "None"]

❓  Needs confirmation:
    [list if any, otherwise write "None"]

🔙  Return to the Claude terminal to review:
    /hybrid-ai-skills:review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
