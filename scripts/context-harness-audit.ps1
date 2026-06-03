$ErrorActionPreference = 'Stop'

$root = (Resolve-Path '.').Path

function Get-FileStats {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $item = Get-Item -LiteralPath $Path
  $content = Get-Content -LiteralPath $Path -Raw
  [PSCustomObject]@{
    Path  = $Path.Replace($root + '\', '')
    Bytes = $item.Length
    Lines = (($content -split "`n").Count)
  }
}

Write-Host "== Root Context Files =="
@('CLAUDE.md', 'AGENTS.md') |
  ForEach-Object { Get-FileStats (Join-Path $root $_) } |
  Where-Object { $_ } |
  Format-Table -AutoSize

Write-Host "`n== Active Claude Skills =="
$skillsRoot = Join-Path $root '.claude\skills'
$skillRows = @()
if (Test-Path -LiteralPath $skillsRoot) {
  Get-ChildItem -LiteralPath $skillsRoot -Directory | Sort-Object Name | ForEach-Object {
    $skillFile = Join-Path $_.FullName 'SKILL.md'
    if (Test-Path -LiteralPath $skillFile) {
      $text = Get-Content -LiteralPath $skillFile -Raw
      $description = ''
      if ($text -match '(?ms)^---\s*(.*?)\s*---') {
        $frontmatter = $Matches[1]
        if ($frontmatter -match '(?m)^description:\s*(.+)$') {
          $description = $Matches[1].Trim().Trim('"')
        }
      }
      $broad = $description -match 'any|before|starting|creative|implementing|review|fix|debug'
      $skillRows += [PSCustomObject]@{
        Skill       = $_.Name
        Bytes       = (Get-Item -LiteralPath $skillFile).Length
        DescChars   = $description.Length
        BroadSignal = if ($broad) { 'check' } else { '' }
      }
    }
  }
}
$skillRows | Format-Table -AutoSize
$totalSkillBytes = ($skillRows | Measure-Object Bytes -Sum).Sum
Write-Host "Active skill count: $($skillRows.Count)"
Write-Host "Active SKILL.md bytes: $totalSkillBytes"

Write-Host "`n== Slash Command Injection Check =="
$commandsRoot = Join-Path $root '.claude\commands'
if (Test-Path -LiteralPath $commandsRoot) {
  Get-ChildItem -LiteralPath $commandsRoot -Filter '*.md' | Sort-Object Name | ForEach-Object {
    $text = Get-Content -LiteralPath $_.FullName -Raw
    [PSCustomObject]@{
      Command = $_.Name
      Bytes   = $_.Length
      UsesAt  = if ($text -match '(^|\s)@[\w./\\-]+') { 'yes' } else { '' }
      UsesBang = if ($text -match '(^|\s)![^\s]') { 'yes' } else { '' }
    }
  } | Format-Table -AutoSize
} else {
  Write-Host "No project slash commands."
}

Write-Host "`n== Enabled Claude Plugins =="
$settings = @(
  (Join-Path $env:USERPROFILE '.claude\settings.json'),
  (Join-Path $root '.claude\settings.local.json')
)
foreach ($settingsPath in $settings) {
  if (Test-Path -LiteralPath $settingsPath) {
    Write-Host $settingsPath
    $json = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    if ($json.enabledPlugins) {
      $json.enabledPlugins.PSObject.Properties |
        Select-Object Name, Value |
        Format-Table -AutoSize
    } else {
      Write-Host "  No enabledPlugins block."
    }
  }
}
