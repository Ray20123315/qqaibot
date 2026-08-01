param(
    [ValidateSet('AUTO','CORE','FULL')]
    [string]$Mode = 'AUTO',
    [string]$VTSRootOverride = '',
    [ValidateRange(1,300)]
    [int]$WaitSeconds = 35,
    [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$CoreSource = Join-Path $Root 'Aye_VTS_v0_9_CORE'
$FullSource = Join-Path $Root 'Aye_VTS_v0_9_FULL'
$TargetName = 'Aye_VTS_v0_9_Compat'
$Timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($Desktop)) { $Desktop = Join-Path $env:USERPROFILE 'Desktop' }
New-Item -ItemType Directory -Force -Path $Desktop | Out-Null
$Work = Join-Path $env:TEMP ("Aye_VTS_Diagnostic_" + $Timestamp)
New-Item -ItemType Directory -Force -Path $Work | Out-Null

function Add-Candidate([System.Collections.Generic.List[string]]$List, [string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    if ((Test-Path $Path) -and -not $List.Contains($Path)) { $List.Add($Path) }
}

function Find-VTSInstall {
    $candidates = New-Object 'System.Collections.Generic.List[string]'
    if (${env:ProgramFiles(x86)}) {
        Add-Candidate $candidates (Join-Path ${env:ProgramFiles(x86)} 'Steam\steamapps\common\VTube Studio')
    }
    if ($env:ProgramFiles) {
        Add-Candidate $candidates (Join-Path $env:ProgramFiles 'Steam\steamapps\common\VTube Studio')
    }
    $steamRoots = @()
    if (${env:ProgramFiles(x86)}) { $steamRoots += (Join-Path ${env:ProgramFiles(x86)} 'Steam') }
    if ($env:ProgramFiles) { $steamRoots += (Join-Path $env:ProgramFiles 'Steam') }
    foreach ($steamRoot in $steamRoots) {
        $vdf = Join-Path $steamRoot 'steamapps\libraryfolders.vdf'
        if (Test-Path $vdf) {
            $text = Get-Content $vdf -Raw -ErrorAction SilentlyContinue
            foreach ($m in [regex]::Matches($text, '"path"\s+"([^"]+)"')) {
                $library = $m.Groups[1].Value -replace '\\\\','\'
                Add-Candidate $candidates (Join-Path $library 'steamapps\common\VTube Studio')
            }
        }
    }
    foreach ($candidate in $candidates) {
        if (Test-Path (Join-Path $candidate 'VTube Studio.exe')) { return $candidate }
    }

    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = '找不到 VTube Studio。請選擇包含「VTube Studio.exe」的資料夾。'
    $dialog.ShowNewFolderButton = $false
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        if (Test-Path (Join-Path $dialog.SelectedPath 'VTube Studio.exe')) { return $dialog.SelectedPath }
    }
    throw '找不到 VTube Studio.exe。請先安裝／更新 VTube Studio，再重新執行此工具。'
}

function Copy-Model([string]$Source, [string]$Target) {
    if (Test-Path $Target) {
        $backup = Join-Path $Work ('PreviousModel_' + (Split-Path $Target -Leaf))
        Copy-Item $Target $backup -Recurse -Force
        Remove-Item $Target -Recurse -Force
    }
    Copy-Item $Source $Target -Recurse -Force
    Get-ChildItem $Target -Recurse -File | ForEach-Object { Unblock-File $_.FullName -ErrorAction SilentlyContinue }
    Get-ChildItem $Target -Filter '*.vtube.json' -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

function Collect-Evidence([string]$VTSRoot, [string]$Target, [string]$Phase) {
    $phaseDir = Join-Path $Work $Phase
    New-Item -ItemType Directory -Force -Path $phaseDir | Out-Null
    if (Test-Path $Target) { Copy-Item $Target (Join-Path $phaseDir 'ModelFolder') -Recurse -Force }
    $localLow = Join-Path $env:USERPROFILE 'AppData\LocalLow\DenchiSoft\VTube Studio'
    if (Test-Path $localLow) { Copy-Item $localLow (Join-Path $phaseDir 'LocalLow_VTubeStudio') -Recurse -Force -ErrorAction SilentlyContinue }
    $streamLogs = Join-Path $VTSRoot 'VTube Studio_Data\StreamingAssets\Logs'
    if (Test-Path $streamLogs) { Copy-Item $streamLogs (Join-Path $phaseDir 'StreamingAssets_Logs') -Recurse -Force -ErrorAction SilentlyContinue }
    $files = Get-ChildItem $Target -Recurse -File -ErrorAction SilentlyContinue | Select-Object Name,FullName,Length,LastWriteTimeUtc
    $files | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $phaseDir 'InstalledFiles.json')
    $vtube = @(Get-ChildItem $Target -Filter '*.vtube.json' -File -ErrorAction SilentlyContinue)
    [ordered]@{
        Phase = $Phase
        VTubeStudioRoot = $VTSRoot
        ModelTarget = $Target
        VTubeJsonCreated = ($vtube.Count -gt 0)
        VTubeJsonFiles = @($vtube | ForEach-Object Name)
        CapturedAt = (Get-Date).ToUniversalTime().ToString('o')
    } | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $phaseDir 'PhaseReport.json')
    return ($vtube.Count -gt 0)
}

$VTSRoot = if ([string]::IsNullOrWhiteSpace($VTSRootOverride)) { Find-VTSInstall } else { (Resolve-Path $VTSRootOverride).Path }
if (-not (Test-Path (Join-Path $VTSRoot 'VTube Studio.exe'))) { throw '指定的 VTSRoot 不含 VTube Studio.exe。' }
$Live2DModels = Join-Path $VTSRoot 'VTube Studio_Data\StreamingAssets\Live2DModels'
New-Item -ItemType Directory -Force -Path $Live2DModels | Out-Null
$Target = Join-Path $Live2DModels $TargetName
$Exe = Join-Path $VTSRoot 'VTube Studio.exe'

$modeToInstall = if ($Mode -eq 'FULL') { 'FULL' } else { 'CORE' }
$source = if ($modeToInstall -eq 'FULL') { $FullSource } else { $CoreSource }
Copy-Model $source $Target

$installReport = [ordered]@{
    ToolVersion = '0.9'
    RequestedMode = $Mode
    InitialInstalledMode = $modeToInstall
    VTubeStudioRoot = $VTSRoot
    Target = $Target
    InstalledAt = (Get-Date).ToUniversalTime().ToString('o')
}
$installReport | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $Work 'InstallReport.json')

Start-Process $Exe -WorkingDirectory $VTSRoot
Start-Sleep -Seconds $WaitSeconds
$coreDetected = Collect-Evidence $VTSRoot $Target '01_CORE_OR_SELECTED'

if ($Mode -eq 'AUTO' -and $coreDetected) {
    Copy-Model $FullSource $Target
    Start-Process $Exe -WorkingDirectory $VTSRoot
    Start-Sleep -Seconds $WaitSeconds
    [void](Collect-Evidence $VTSRoot $Target '02_FULL')
}

$summary = @"
阿叶睡不醒QAQ VTube Studio 診斷
時間：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
VTS：$VTSRoot
模型：$Target
初始模式：$modeToInstall
CORE 是否建立 .vtube.json：$coreDetected

請把同資料夾產生的 Aye_VTS_Diagnostic_*.zip 上傳回對話。
"@
$summary | Set-Content -Encoding UTF8 (Join-Path $Work '請上傳這個診斷包.txt')

$zip = Join-Path $Desktop ("Aye_VTS_Diagnostic_" + $Timestamp + '.zip')
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $Work '*') -DestinationPath $zip -CompressionLevel Optimal

if (-not $NonInteractive) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "安裝／診斷完成。`n`n已在桌面建立：`n$zip`n`n若模型仍不能使用，請把這個 ZIP 上傳給 ChatGPT。",
        '阿叶 V皮修復工具',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
    Start-Process explorer.exe -ArgumentList "/select,`"$zip`""
}
Write-Output $zip
