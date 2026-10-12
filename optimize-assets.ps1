Add-Type -AssemblyName System.Drawing
$root = $PSScriptRoot
$outDir = Join-Path $root 'img/optimized'
[void][IO.Directory]::CreateDirectory($outDir)
$encoder = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$parameters = New-Object Drawing.Imaging.EncoderParameters 1
$parameters.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), ([long]85)
$manifest = @{}
foreach ($file in (Get-ChildItem (Join-Path $root 'img') -Recurse -File | Where-Object { $_.DirectoryName -ne $outDir -and $_.Extension -in '.jpeg','.png' })) {
    $relative = $file.FullName.Substring($root.Length + 1).Replace('\','/')
    $stem = $relative.Substring(4).Replace('/','-')
    $stem = [IO.Path]::GetFileNameWithoutExtension($stem)
    $source = [Drawing.Image]::FromFile($file.FullName)
    $widths = if ($file.Extension -eq '.png') { @(64,256) } else { @(480,960,1600) }
    $variants = @{}
    foreach ($target in $widths) {
        $width = [int][Math]::Min($target, $source.Width)
        $height = [int][Math]::Round($source.Height * $width / $source.Width)
        $bitmap = New-Object Drawing.Bitmap $width,$height
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($source,0,0,$width,$height)
        $extension = if ($file.Extension -eq '.png') { 'png' } else { 'jpg' }
        $name = "$stem-$target.$extension"
        if ($extension -eq 'png') { $bitmap.Save((Join-Path $outDir $name),[Drawing.Imaging.ImageFormat]::Png) }
        else { $bitmap.Save((Join-Path $outDir $name),$encoder,$parameters) }
        $variants[[string]$target] = @{ path = "img/optimized/$name"; width = $width; height = $height }
        $graphics.Dispose(); $bitmap.Dispose()
    }
    $source.Dispose()
    $manifest[$relative] = $variants
}
$parameters.Dispose()
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outDir 'manifest.json')
