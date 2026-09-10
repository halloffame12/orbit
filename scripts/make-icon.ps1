# Generates build/icon.png (256x256) for Orbit — dark tile + teal orbit ring with placeholder dot.
Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

# Transparent background
$g.Clear([System.Drawing.Color]::Transparent)

# Dark rounded-background disc
$discBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 12, 12, 14))
$g.FillEllipse($discBrush, 12, 12, 232, 232)

# Teal orbit ring
$orbitPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 229, 160), 16)
$g.DrawEllipse($orbitPen, 36, 36, 184, 184)

# Bright orbiting dot at 45deg (top-right)
$dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 229, 160))
$centerRadius = 92
$cx = 128 + [int]($centerRadius * [Math]::Cos([Math]::PI / 4))
$cy = 128 - [int]($centerRadius * [Math]::Sin([Math]::PI / 4))
$g.FillEllipse($dotBrush, $cx - 18, $cy - 18, 36, 36)

# Soft glow ring
$glowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 0, 229, 160), 4)
$g.DrawEllipse($glowPen, 28, 28, 200, 200)

$outDir = Join-Path $PSScriptRoot "..\build"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$pngPath = Join-Path $outDir "icon.png"
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

Write-Host "Wrote $pngPath"

$dotBrush.Dispose()
$orbitPen.Dispose()
$glowPen.Dispose()
$discBrush.Dispose()
$g.Dispose()
$bmp.Dispose()