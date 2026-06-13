param(
    [switch]$DryRun,
    [string[]]$AdditionalTargetRoot = @()
)

$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$SourceRoot = Join-Path $RepoRoot "skills"
$SkillNames = @("architect", "build", "review")

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
