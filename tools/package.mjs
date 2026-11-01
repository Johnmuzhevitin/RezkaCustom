import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// This import must succeed before an existing archive is touched.
import './check.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid package version');
mkdirSync(new URL('../dist', import.meta.url), { recursive: true });
// Use the built-in .NET ZIP writer without a script module or an execution-policy
// change. Paths are fixed literals, not shell-interpolated input.
execFileSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourcePath = Join-Path (Get-Location) 'extension'
$zipPath = Join-Path (Get-Location) 'dist/rezka-custom-${version}.zip'
[System.IO.File]::Delete($zipPath)
$archive = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
    Get-ChildItem -LiteralPath $sourcePath -File -Recurse | ForEach-Object {
        $entryName = $_.FullName.Substring($sourcePath.Length + 1).Replace('\\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entryName) | Out-Null
    }
} finally { $archive.Dispose() }`
], { cwd: root, stdio: 'inherit', windowsHide: true });
console.log(`Created dist/rezka-custom-${version}.zip`);
