# Generates build/icon.png (256x256) for Orbit.
# If a real design asset (Logo imported via import-assets.ps1) already exists
# at build/icon.png, that artwork is kept and only the .ico container is
# produced by make-icon.js.
$outDir = Join-Path $PSScriptRoot "..\build"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$pngPath = Join-Path $outDir "icon.png"

if (Test-Path $pngPath) {
  Write-Host "build/icon.png exists - keeping imported design asset (skip placeholder)"
  exit 0
}

Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

$g.Clear([System.Drawing.Color]::Transparent)

$discBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 12, 12, 14))
$g.FillEllipse($discBrush, 12, 12, 232, 232)

$orbitPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 229, 160), 16)
$g.DrawEllipse($orbitPen, 36, 36, 184, 184)

$dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 229, 160))
$centerRadius = 92
$cx = 128 + [int]($centerRadius * [Math]::Cos([Math]::PI / 4))
$cy = 128 - [int]($centerRadius * [Math]::Sin([Math]::PI / 4))
$g.FillEllipse($dotBrush, $cx - 18, $cy - 18, 36, 36)

$glowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 0, 229, 160), 4)
$g.DrawEllipse($glowPen, 28, 28, 200, 200)

$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Wrote $pngPath"

$dotBrush.Dispose()
$orbitPen.Dispose()
$glowPen.Dispose()
$discBrush.Dispose()
$g.Dispose()
$bmp.Dispose()