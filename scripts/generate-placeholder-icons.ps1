param(
    [string]$OutDir = (Join-Path $PSScriptRoot "..\src-tauri\icons")
)

Add-Type -AssemblyName System.Drawing

$OutDir = (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Path $OutDir -Force)).Path

function New-PlaceholderPng {
    param([int]$Size, [string]$Path)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $bg = [System.Drawing.Color]::FromArgb(255, 24, 24, 27)
    $g.Clear($bg)
    $accent = [System.Drawing.Color]::FromArgb(255, 212, 130, 86)
    $brush = New-Object System.Drawing.SolidBrush $accent
    $inset = [int]($Size * 0.22)
    $g.FillRectangle($brush, $inset, $inset, $Size - 2 * $inset, $Size - 2 * $inset)
    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function New-IcoFromPngs {
    param([string[]]$PngPaths, [string]$OutPath)
    $entries = @()
    foreach ($p in $PngPaths) {
        $bytes = [System.IO.File]::ReadAllBytes($p)
        $img = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $p).Path)
        $entries += [PSCustomObject]@{ W = $img.Width; H = $img.Height; Bytes = $bytes }
        $img.Dispose()
    }
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter $ms
    $bw.Write([UInt16]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]$entries.Count)
    $headerSize = 6 + 16 * $entries.Count
    $offset = $headerSize
    foreach ($e in $entries) {
        $wByte = if ($e.W -ge 256) { [byte]0 } else { [byte]$e.W }
        $hByte = if ($e.H -ge 256) { [byte]0 } else { [byte]$e.H }
        $bw.Write($wByte)
        $bw.Write($hByte)
        $bw.Write([byte]0)
        $bw.Write([byte]0)
        $bw.Write([UInt16]1)
        $bw.Write([UInt16]32)
        $bw.Write([UInt32]$e.Bytes.Length)
        $bw.Write([UInt32]$offset)
        $offset += $e.Bytes.Length
    }
    foreach ($e in $entries) {
        $bw.Write($e.Bytes)
    }
    $bw.Flush()
    [System.IO.File]::WriteAllBytes($OutPath, $ms.ToArray())
    $bw.Dispose()
    $ms.Dispose()
}

$png32 = Join-Path $OutDir "32x32.png"
$png128 = Join-Path $OutDir "128x128.png"
$png256 = Join-Path $OutDir "128x128@2x.png"
$ico = Join-Path $OutDir "icon.ico"

New-PlaceholderPng -Size 32 -Path $png32
New-PlaceholderPng -Size 128 -Path $png128
New-PlaceholderPng -Size 256 -Path $png256
New-IcoFromPngs -PngPaths @($png32, $png128, $png256) -OutPath $ico

Write-Output "Wrote:"
Write-Output "  $png32"
Write-Output "  $png128"
Write-Output "  $png256"
Write-Output "  $ico"
