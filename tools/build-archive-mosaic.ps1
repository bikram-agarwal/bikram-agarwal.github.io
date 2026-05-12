param(
  [string]$OutputPath,
  [int]$Columns = 4,
  [int]$Rows = 3,
  [int]$CellSize = 96,
  [int]$Gap = 12,
  [int]$Padding = 16,
  [int]$CornerRadius = 18,
  [string]$OverflowText = "+32"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$mediaRoot = Join-Path $repoRoot "archive\media"

if (-not $OutputPath) {
  $OutputPath = Join-Path $mediaRoot "logo_grid.png"
}

$icons = @(
  "logo_andios.png",
  "logo_disk.png",
  "logo_eclipse.png",
  "logo_gadget.png",
  "logo_mint.png",
  "logo_rhombus.png",
  "logo_ribbons.png",
  "logo_shapes.png",
  "logo_stack.png",
  "logo_texty.png",
  "logo_ubu.png"
)

Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Rectangle,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()

  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  return $path
}

function Draw-RoundedRectangle {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rectangle,
    [System.Drawing.Color]$Color,
    [float]$Radius
  )

  $path = New-RoundedRectanglePath -Rectangle $Rectangle -Radius $Radius
  $brush = [System.Drawing.SolidBrush]::new($Color)

  try {
    $Graphics.FillPath($brush, $path)
  } finally {
    $brush.Dispose()
    $path.Dispose()
  }
}

function Draw-ContainedImage {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Image]$Image,
    [System.Drawing.RectangleF]$Bounds
  )

  $scale = [Math]::Min($Bounds.Width / $Image.Width, $Bounds.Height / $Image.Height)
  $width = $Image.Width * $scale
  $height = $Image.Height * $scale
  $x = $Bounds.X + (($Bounds.Width - $width) / 2)
  $y = $Bounds.Y + (($Bounds.Height - $height) / 2)
  $target = [System.Drawing.RectangleF]::new($x, $y, $width, $height)

  $Graphics.DrawImage($Image, $target)
}

$width = ($Padding * 2) + ($Columns * $CellSize) + (($Columns - 1) * $Gap)
$height = ($Padding * 2) + ($Rows * $CellSize) + (($Rows - 1) * $Gap)
$bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

try {
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  $overflowColor = [System.Drawing.Color]::FromArgb(120, 33, 26, 21)
  $textColor = [System.Drawing.Color]::FromArgb(215, 242, 232, 223)

  for ($index = 0; $index -lt ($Rows * $Columns); $index++) {
    $column = $index % $Columns
    $row = [Math]::Floor($index / $Columns)
    $x = $Padding + ($column * ($CellSize + $Gap))
    $y = $Padding + ($row * ($CellSize + $Gap))
    $tileRect = [System.Drawing.RectangleF]::new($x, $y, $CellSize, $CellSize)
    $isOverflowTile = $index -eq (($Rows * $Columns) - 1)

    if ($isOverflowTile) {
      Draw-RoundedRectangle `
        -Graphics $graphics `
        -Rectangle $tileRect `
        -Color $overflowColor `
        -Radius $CornerRadius

      $font = [System.Drawing.Font]::new("Arial", 24, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      $brush = [System.Drawing.SolidBrush]::new($textColor)
      $format = [System.Drawing.StringFormat]::new()
      $format.Alignment = [System.Drawing.StringAlignment]::Center
      $format.LineAlignment = [System.Drawing.StringAlignment]::Center

      try {
        $graphics.DrawString($OverflowText, $font, $brush, $tileRect, $format)
      } finally {
        $format.Dispose()
        $brush.Dispose()
        $font.Dispose()
      }

      continue
    }

    $iconPath = Join-Path $mediaRoot $icons[$index]
    if (-not (Test-Path -LiteralPath $iconPath)) {
      throw "Missing icon source: $iconPath"
    }

    $image = [System.Drawing.Image]::FromFile($iconPath)
    try {
      $iconInset = [Math]::Round($CellSize * 0.16)
      $iconBounds = [System.Drawing.RectangleF]::new(
        $x + $iconInset,
        $y + $iconInset,
        $CellSize - ($iconInset * 2),
        $CellSize - ($iconInset * 2)
      )
      Draw-ContainedImage -Graphics $graphics -Image $image -Bounds $iconBounds
    } finally {
      $image.Dispose()
    }
  }

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }

  $extension = [IO.Path]::GetExtension($OutputPath).ToLowerInvariant()
  if ($extension -eq ".webp") {
    $magick = Get-Command magick -ErrorAction SilentlyContinue
    if (-not $magick) {
      throw "Writing WebP requires ImageMagick. Use .png output or install magick."
    }

    $tempPng = [IO.Path]::ChangeExtension([IO.Path]::GetTempFileName(), ".png")
    $bitmap.Save($tempPng, [System.Drawing.Imaging.ImageFormat]::Png)
    & $magick.Source $tempPng $OutputPath
    Remove-Item -LiteralPath $tempPng -Force
  } else {
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }

  Write-Host "Wrote $OutputPath"
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
