$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artifactDirectory = Join-Path $projectRoot 'artifacts'
[System.IO.Directory]::CreateDirectory($artifactDirectory) | Out-Null
$archivePath = Join-Path $artifactDirectory 'AlgoLens-source.zip'
$allowedDirectories = @('client', 'server', 'api', 'scripts', 'docs', '.github')
$allowedRootFiles = @('README.md', 'package.json', 'package-lock.json', '.env.example', '.gitignore', '.nvmrc', '.prettierrc.json', '.prettierignore', 'vercel.json', 'render.yaml')
$sourceFiles = @(
    foreach ($name in $allowedRootFiles) { Get-Item -LiteralPath (Join-Path $projectRoot $name) }
    foreach ($name in $allowedDirectories) { Get-ChildItem -LiteralPath (Join-Path $projectRoot $name) -File -Force -Recurse }
)
# Explicit roots and exclusions keep local credentials/data out of the handover.
$sourceFiles = $sourceFiles | Where-Object {
    $relative = $_.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
    $relative -notmatch '(^|/)(node_modules|dist|coverage|\.git)(/|$)' -and
    ($_.Name -notmatch '^\.env($|\.)' -or $_.Name -match '^\.env(?:\..+)?\.example$' -or $_.Name -eq '.env.example') -and
    $_.Name -notmatch '\.(db|db-journal|db-shm|db-wal|log|pem|key|pfx)$' -and
    $_.Name -notmatch '^(\.DS_Store|.*\.local)$'
} | Sort-Object FullName
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
try {
    $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($sourceFile in $sourceFiles) {
            $entryName = 'AlgoLens/' + $sourceFile.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $sourceFile.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $zip.Dispose() }
} finally { $stream.Dispose() }
Write-Output "Created $archivePath ($($sourceFiles.Count) source files)."
