param(
    [switch]$DryRun,
    [switch]$InstallClaudemd,
    [switch]$InstallAgentsmd,
    [switch]$InstallOpenCodePlugin,
    [string[]]$AdditionalTargetRoot = @()
)

$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$SourceRoot = Join-Path $RepoRoot "skills"
$SkillNames = @("architect", "build", "review", "delegate")

function Resolve-HomePath {
    param([string]$RelativePath)
    return Join-Path $env:USERPROFILE $RelativePath
}

function Get-ClaudePluginSkillTargets {
    $cacheRoot = Resolve-HomePath ".claude\plugins\cache\hybrid-ai-skills\hybrid-ai-skills"
    if (-not (Test-Path -LiteralPath $cacheRoot)) {
        return @()
    }

    return @(
        Get-ChildItem -LiteralPath $cacheRoot -Directory -ErrorAction SilentlyContinue |
            ForEach-Object {
                $skillsPath = Join-Path $_.FullName "skills"
                if (Test-Path -LiteralPath $skillsPath) {
                    $skillsPath
                }
            }
    )
}

function Get-TargetRoots {
    $targets = @(
        # Claude Code personal skills.
        (Resolve-HomePath ".claude\skills"),

        # Codex discovery locations.
        (Resolve-HomePath ".agents\skills\hybrid-ai-skills"),
        (Resolve-HomePath ".codex\skills\hybrid-ai-skills"),

        # OpenCode discovery locations seen in current Windows installs.
        (Resolve-HomePath ".opencode\skills"),
        (Resolve-HomePath ".config\opencode\skills"),

        # Antigravity user-level locations. Antigravity has no stable public
        # skill directory yet, so install to both likely global locations.
        (Join-Path $env:APPDATA "Antigravity\User\skills"),
        (Resolve-HomePath ".antigravity\skills")
    )

    $targets += Get-ClaudePluginSkillTargets
    $targets += $AdditionalTargetRoot

    return @($targets | Where-Object { $_ } | Select-Object -Unique)
}

function Test-SourceSkills {
    foreach ($skill in $SkillNames) {
        $skillFile = Join-Path $SourceRoot "$skill\SKILL.md"
        if (-not (Test-Path -LiteralPath $skillFile)) {
            throw "Missing source skill: $skillFile"
        }
    }
}

function Copy-SkillSet {
    param([string]$TargetRoot)

    if ($DryRun) {
        Write-Output "[dry-run] Would install skills to $TargetRoot"
        return
    }

    New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

    foreach ($skill in $SkillNames) {
        $source = Join-Path $SourceRoot $skill
        $target = Join-Path $TargetRoot $skill
        New-Item -ItemType Directory -Force -Path $target | Out-Null
        Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $target -Recurse -Force
    }

    Write-Output "Installed skills to $TargetRoot"
}

function Test-InstalledSkillSet {
    param([string]$TargetRoot)

    foreach ($skill in $SkillNames) {
        $sourceFile = Join-Path $SourceRoot "$skill\SKILL.md"
        $targetFile = Join-Path $TargetRoot "$skill\SKILL.md"

        if (-not (Test-Path -LiteralPath $targetFile)) {
            throw "Install verification failed: missing $targetFile"
        }

        $sourceHash = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash
        $targetHash = (Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash
        if ($sourceHash -ne $targetHash) {
            throw "Install verification failed: hash mismatch for $targetFile"
        }
    }
}

# ── Delegate block strings (for CLAUDE.md / AGENTS.md injection) ──────────────

$DelegateSharedBody = (
    "The ``delegate`` skill is available globally. Use it to offload non-complex tasks - bulk reads,`n" +
    "recursive searches, single-file coding, test generation - to a secondary model pool, preserving`n" +
    "main model quota for complex work.`n`n" +
    "**Model routing:**`n" +
    "  --type=code   (default): Opus 4.6 :max first -> Flash :high fallback on quota`n" +
    "  --type=lookup :          Flash :high directly (extraction, grep, summarize)`n`n" +
    "Requires env vars in shell profile:`n" +
    "  DELEGATE_RUNNER=opencode`n" +
    "  GCLI_MODELS_CODE=google/antigravity-claude-opus-4-6-thinking:max,google/antigravity-gemini-3.5-flash:high`n" +
    "  GCLI_MODELS_LOOKUP=google/antigravity-gemini-3.5-flash:high`n`n" +
    "**Logging:** logs always written to ``logs/delegate-{agent}.log`` inside the target project.`n" +
    "  DELEGATE_AGENT=claude   # set in each agent's profile for per-agent log files`n" +
    "  DELEGATE_DEBUG=1        # verbose subprocess output + timing on stderr`n`n" +
    "**When to delegate automatically:**`n" +
    "- Output likely exceeds 500 lines or spans 3+ unfamiliar files -> delegate --type=lookup`n" +
    "- Task is single-file, isolated, no architectural judgment needed -> delegate --type=code`n" +
    "- Keep architecture, scope, and multi-file decisions in the main model`n`n" +
    "<!-- hybrid-ai-delegate-block-end -->`n"
)

$DelegateClaudeBlock = (
    "`n## Delegate Skill (hybrid-ai-skills)`n`n" +
    "**Invoke:** ``/delegate`` or ``node scripts/delegate.mjs [--type=code|lookup] `"<task>`"```n`n" +
    "Set in this profile (so log files are named ``delegate-claude.log``): ``DELEGATE_AGENT=claude``" +
    "`n`n" + $DelegateSharedBody
)
$DelegateAgentsBlock = (
    "`n## Delegate Skill (hybrid-ai-skills)`n`n" +
    "**Invoke:** ``node scripts/delegate.mjs [--type=code|lookup] `"<task>`"`` or ``npx hybrid-ai-delegate``" +
    "`n`nSet in this profile (so log files are named ``delegate-codex.log``): ``DELEGATE_AGENT=codex``" +
    "`n`n" + $DelegateSharedBody
)

function Install-DelegateBlock {
    param([string]$TargetPath, [string]$BlockContent)
    $marker = '<!-- hybrid-ai-delegate-block-end -->'
    if ($DryRun) {
        Write-Output "[dry-run] Would append delegate block to $TargetPath"
        return
    }
    $alreadyInstalled = $false
    if (Test-Path -LiteralPath $TargetPath) {
        $existing = Get-Content -LiteralPath $TargetPath -Raw -ErrorAction SilentlyContinue
        if ($existing -and $existing.Contains($marker)) {
            $alreadyInstalled = $true
        }
    }
    if ($alreadyInstalled) {
        Write-Output "Delegate block already present in $TargetPath -- skipping."
    } else {
        New-Item -ItemType Directory -Force -Path (Split-Path $TargetPath) | Out-Null
        Add-Content -LiteralPath $TargetPath -Value $BlockContent -Encoding utf8
        Write-Output "Appended delegate block to $TargetPath"
    }
}

# ── OpenCode plugin installer ──────────────────────────────────────────────────

function Install-OpenCodePlugin {
    $openCodeJsonPath = Resolve-HomePath ".config\opencode\opencode.json"
    $pluginDir = Join-Path $RepoRoot "deps\opencode-antigravity-auth"
    $pluginPathFwd = $pluginDir.Replace('\', '/')

    if ($DryRun) {
        Write-Output "[dry-run] Would update opencode.json plugin path to $pluginPathFwd"
        return
    }

    # Ensure submodule is populated
    if (-not (Test-Path (Join-Path $pluginDir "package.json"))) {
        Write-Output "Plugin submodule not populated. Running: git submodule update --init deps/opencode-antigravity-auth"
        Push-Location $RepoRoot
        try { git -c protocol.file.allow=always submodule update --init deps/opencode-antigravity-auth }
        finally { Pop-Location }
    }

    # Install plugin npm dependencies if needed
    $nodeModulesPath = Join-Path $pluginDir "node_modules"
    if (-not (Test-Path $nodeModulesPath)) {
        Write-Output "Installing plugin dependencies in $pluginDir ..."
        Push-Location $pluginDir
        try { npm install --silent }
        finally { Pop-Location }
        Write-Output "Plugin dependencies installed."
    }

    # Update opencode.json plugin path
    if (-not (Test-Path -LiteralPath $openCodeJsonPath)) {
        Write-Output "opencode.json not found at $openCodeJsonPath"
        Write-Output "Add manually: `"plugin`": [`"$pluginPathFwd`"]"
        return
    }

    $content = Get-Content -LiteralPath $openCodeJsonPath -Raw -Encoding utf8

    # Replace existing opencode-antigravity-auth path string in-place (safe regex sub)
    $oldPattern = '"[^"]*opencode-antigravity-auth[^"]*"'
    if ($content -match $oldPattern) {
        $updated = [regex]::Replace($content, $oldPattern, "`"$pluginPathFwd`"")
        [System.IO.File]::WriteAllText($openCodeJsonPath, $updated, [System.Text.Encoding]::UTF8)
        Write-Output "Updated opencode.json: plugin path -> $pluginPathFwd"
    } else {
        Write-Output "No opencode-antigravity-auth entry found in $openCodeJsonPath"
        Write-Output "Add manually: `"plugin`": [`"$pluginPathFwd`"]"
    }
}

# ── Main execution ─────────────────────────────────────────────────────────────

Test-SourceSkills
$targets = Get-TargetRoots

if (-not $targets.Count) {
    throw "No install targets resolved."
}

foreach ($target in $targets) {
    Copy-SkillSet -TargetRoot $target
}

if (-not $DryRun) {
    foreach ($target in $targets) {
        Test-InstalledSkillSet -TargetRoot $target
    }
    Write-Output "Verified $($targets.Count) target root(s). Restart agent apps or open a new session to reload skills."
}

if ($InstallClaudemd) {
    Install-DelegateBlock -TargetPath (Resolve-HomePath ".claude\CLAUDE.md") -BlockContent $DelegateClaudeBlock
}

if ($InstallAgentsmd) {
    Install-DelegateBlock -TargetPath (Resolve-HomePath ".codex\AGENTS.md") -BlockContent $DelegateAgentsBlock
    Install-DelegateBlock -TargetPath (Resolve-HomePath ".agents\AGENTS.md") -BlockContent $DelegateAgentsBlock
}

if ($InstallOpenCodePlugin) {
    Install-OpenCodePlugin
}
