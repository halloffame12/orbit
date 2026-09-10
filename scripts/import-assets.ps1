# Converts the design assets in /assets (exported by the designer) into the
# exact PNG artifacts used across the app and website:
#   Logo.jpg     -> build/icon.png               256x256  (Windows .ico source)
#   Favicon.jpg  -> website/public/favicon.png   192x192 + 64x64
#   Banner.jpg   -> website/public/og.png        1200x630 (OG/social + README)
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Path $PSScriptRoot -Parent
$assets = Join-Path $root "assets"

function Load-Bitmap([string]$path) {
  return [System.Drawing.Image]::FromFile($path)
}

function Save-Resized(
  [System.Drawing.Image]$src,
  [int]$width,
  [int]$height,
  [string]$outPath,
  [switch]$cover
) {
  $outDir = Split-Path -Path $outPath -Parent
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null

  $bmp = New-Object System.Drawing.Bitmap($width, $height)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if ($cover) {
    # Cover-fit: scale to fill, then crop to exactly width x height.
    $scale = [Math]::Max($width / $src.Width, $height / $src.Height)
    $sw = [Math]::Ceiling($src.Width * $scale)
    $sh = [Math]::Ceiling($src.Height * $scale)
    $g.DrawImage($src, [int](($width - $sw) / 2), [int](($height - $sh) / 2), $sw, $sh)
  } else {
    $g.DrawImage($src, 0, 0, $width, $height)
  }

  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "Wrote $outPath ($width x $height)"
}

$logo   = Load-Bitmap (Join-Path $assets "Logo.jpg")
$fav    = Load-Bitmap (Join-Path $assets "Favicon.jpg")
$banner = Load-Bitmap (Join-Path $assets "Banner.jpg")

Save-Resized $logo 256 256 (Join-Path $root "build\icon.png")
Save-Resized $fav 192 192 (Join-Path $root "website\public\favicon.png")
Save-Resized $fav 64 64 (Join-Path $root "website\public\favicon-64.png")
Save-Resized $banner 1200 630 (Join-Path $root "website\public\og.png") -cover

$logo.Dispose()
$fav.Dispose()
$banner.Dispose()