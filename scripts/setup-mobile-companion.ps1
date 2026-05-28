param(
  [switch]$InstallJdk,
  [switch]$InstallPlatformTools,
  [string]$FlutterRoot = "$env:USERPROFILE\.spotter-tools\flutter"
)

$ErrorActionPreference = "Stop"

function Add-PathForCurrentSession([string]$PathToAdd) {
  if ($env:PATH -notlike "*$PathToAdd*") {
    $env:PATH = "$PathToAdd;$env:PATH"
  }
}

$env:PUB_HOSTED_URL = "https://pub.flutter-io.cn"
$env:FLUTTER_STORAGE_BASE_URL = "https://storage.flutter-io.cn"

if (-not (Test-Path $FlutterRoot)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $FlutterRoot) | Out-Null
  git clone --depth 1 -b stable https://gitee.com/mirrors/Flutter.git $FlutterRoot
}

Add-PathForCurrentSession "$FlutterRoot\bin"

if ($InstallJdk) {
  winget install --id EclipseAdoptium.Temurin.17.JDK --source winget --accept-package-agreements --accept-source-agreements
}

if ($InstallPlatformTools) {
  winget install --id Google.PlatformTools --source winget --accept-package-agreements --accept-source-agreements
}

flutter --version
flutter doctor -v
