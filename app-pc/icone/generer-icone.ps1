# Génère plume.ico (16 à 256 px) et plume-256.png : la plume à facettes bleue (v3)
# (même dessin que icone/plume.svg), sur fond transparent.
# Usage : powershell -File app-pc\icone\generer-icone.ps1
Add-Type -AssemblyName System.Drawing
$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$tailles = 16, 20, 24, 32, 40, 48, 64, 128, 256
$images = @()
# Sommets sur une grille de 64 (voir plume.svg)
$A = 2.5, 2; $B = 30.7, 2; $C = 19.4, 18.8; $D = 2.5, 30
$E = 47.6, 24.6; $F = 39.2, 38.5; $G = 25, 47; $H = 61.5, 62
$faces = @(
  @('2d6cdf', @($A, $B, $E, $H, $G, $D)),   # silhouette (couleur moyenne)
  @('4a86ec', @($A, $C, $D)), @('4a86ec', @($B, $E, $F, $C)),
  @('1f4fa8', @($A, $B, $C)), @('1f4fa8', @($G, $F, $H))
)
foreach ($s in $tailles + 1024) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  $k = $s / 64.0
  foreach ($f in $faces) {
    $c = [System.Drawing.ColorTranslator]::FromHtml('#' + $f[0])
    $pts = [System.Drawing.PointF[]]@($f[1] | ForEach-Object { New-Object System.Drawing.PointF ([single]($_[0] * $k)), ([single]($_[1] * $k)) })
    $g.FillPolygon((New-Object System.Drawing.SolidBrush $c), $pts)
  }
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  if ($s -in 256, 1024) { $bmp.Save((Join-Path $ici "plume-$s.png"), [System.Drawing.Imaging.ImageFormat]::Png) }
  $bmp.Dispose()
  if ($s -le 256) { $images += , $ms.ToArray() }
}
# Fichier .ico : en-tête, une entrée par taille, puis les images PNG
$out = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $out
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$tailles.Count)
$decalage = 6 + 16 * $tailles.Count
for ($i = 0; $i -lt $tailles.Count; $i++) {
  $c = if ($tailles[$i] -ge 256) { 0 } else { $tailles[$i] }
  $w.Write([byte]$c); $w.Write([byte]$c); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([uint16]1); $w.Write([uint16]32)
  $w.Write([uint32]$images[$i].Length); $w.Write([uint32]$decalage)
  $decalage += $images[$i].Length
}
foreach ($img in $images) { $w.Write($img) }
$w.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $ici 'plume.ico'), $out.ToArray())
"plume.ico : $($tailles.Count) tailles, $($out.Length) octets"
