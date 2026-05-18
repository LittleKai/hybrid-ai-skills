# Codex Local Plugin Setup

This note documents the Windows setup that works with Codex Desktop. Current
Codex builds can discover skills from both plugin marketplaces and direct user
skill directories.

Codex can load this skill set from either of these direct locations:

```text
%USERPROFILE%\.agents\skills\hybrid-ai-skills
%USERPROFILE%\.codex\skills
```

After copying or installing skills, fully restart Codex, start a new thread,
and invoke skills with `/skills`.

## Marketplace Fallback

If direct skill discovery is unavailable in your Codex Desktop build, use a
plugin marketplace wrapper. Some versions ignore a marketplace entry whose
local plugin path is `./` with this log message:

```text
local plugin source path must not be empty
```

Use a marketplace root that contains plugins under a non-empty subdirectory
path, for example:

```text
%USERPROFILE%\.codex\local-skills-marketplace
|-- .agents\plugins\marketplace.json
`-- plugins
    |-- hybrid-ai-skills
    |   |-- .codex-plugin\plugin.json
    |   `-- skills -> D:\Dev\3.lib_pj\hybrid-ai-skills\skills
    `-- minimax-skills
        |-- .codex-plugin\plugin.json
        `-- skills -> %USERPROFILE%\.codex\skills\minimax-skills
```

## Create the Local Marketplace

Run PowerShell from any directory:

```powershell
$root = "$env:USERPROFILE\.codex\local-skills-marketplace"
New-Item -ItemType Directory -Force -Path "$root\.agents\plugins" | Out-Null
New-Item -ItemType Directory -Force -Path "$root\plugins\hybrid-ai-skills\.codex-plugin" | Out-Null

cmd /c mklink /J "$root\plugins\hybrid-ai-skills\skills" "D:\Dev\3.lib_pj\hybrid-ai-skills\skills"
Copy-Item "D:\Dev\3.lib_pj\hybrid-ai-skills\.codex-plugin\plugin.json" "$root\plugins\hybrid-ai-skills\.codex-plugin\plugin.json" -Force
```

Create `%USERPROFILE%\.codex\local-skills-marketplace\.agents\plugins\marketplace.json`:

```json
{
  "name": "local-skills-marketplace",
  "interface": {
    "displayName": "Local Skills"
  },
  "plugins": [
    {
      "name": "hybrid-ai-skills",
      "source": {
        "source": "local",
        "path": "./plugins/hybrid-ai-skills"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

Register the marketplace:

```powershell
codex.cmd plugin marketplace add "$env:USERPROFILE\.codex\local-skills-marketplace"
```

Restart Codex, open:

```text
/plugins
```

Then install `hybrid-ai-skills` from `Local Skills`.

## Verify

After install, fully quit Codex, reopen it, and start a new thread. Open
`/skills` and choose the needed skill:

```text
/skills architect
/skills build
/skills review
```

## Notes

- Do not use `path: "./"` in `marketplace.json` for this Codex Desktop version.
- Use `/skills` as the primary verification method in Codex Desktop.
- A junction keeps local edits in this repository immediately visible to the
  local plugin wrapper.
- If `/plugins` does not show the marketplace, inspect
  `%USERPROFILE%\.codex\log\codex-tui.log` for `marketplace` or
  `failed to resolve`.
