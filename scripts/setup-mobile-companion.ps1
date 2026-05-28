param(
  [switch]$NoChinaMirrors,
  [switch]$InstallJdk,
  [switch]$InstallPlatformTools,
  [switch]$PrintBuildCommands,
  [switch]$ConfigureOnly,
  [switch]$SkipDoctor,
  [string]$FlutterRoot = "$env:USERPROFILE\.spotter-tools\flutter",
  [string]$AndroidSdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
)

$ErrorActionPreference = "Stop"

function Add-PathForCurrentSession([string]$PathToAdd) {
  if ($env:PATH -notlike "*$PathToAdd*") {
    $env:PATH = "$PathToAdd;$env:PATH"
  }
}

function Set-EnvIfMissing([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace((Get-Item "Env:$Name" -ErrorAction SilentlyContinue).Value)) {
    Set-Item "Env:$Name" $Value
  }
}

if (-not $NoChinaMirrors) {
  $env:PUB_HOSTED_URL = "https://pub.flutter-io.cn"
  $env:FLUTTER_STORAGE_BASE_URL = "https://storage.flutter-io.cn"
  $env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE ".gradle"
} else {
  Set-EnvIfMissing "PUB_HOSTED_URL" "https://pub.dev"
  Set-EnvIfMissing "FLUTTER_STORAGE_BASE_URL" "https://storage.googleapis.com"
}

Set-EnvIfMissing "ANDROID_HOME" $AndroidSdkRoot
Set-EnvIfMissing "ANDROID_SDK_ROOT" $AndroidSdkRoot
Add-PathForCurrentSession "$AndroidSdkRoot\platform-tools"

if (-not (Test-Path $FlutterRoot)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $FlutterRoot) | Out-Null
  git clone --depth 1 -b stable https://gitee.com/mirrors/Flutter.git $FlutterRoot
}

if (-not (Test-Path "$FlutterRoot\bin\flutter.bat")) {
  throw "Flutter SDK not found at $FlutterRoot. Pass -FlutterRoot to a valid SDK path or remove the existing invalid directory."
}

Add-PathForCurrentSession "$FlutterRoot\bin"

if ($InstallJdk) {
  winget install --id EclipseAdoptium.Temurin.17.JDK --source winget --accept-package-agreements --accept-source-agreements
}

if ($InstallPlatformTools) {
  if (-not (Test-Path "$AndroidSdkRoot\platform-tools\adb.exe")) {
    Write-Host "platform-tools not found under $AndroidSdkRoot"
    Write-Host "Install Android SDK command line tools, then run:"
    Write-Host "sdkmanager --sdk_root=$AndroidSdkRoot --install platform-tools"
  }
}

if ($ConfigureOnly) {
  Write-Host "Mobile companion environment configured for this PowerShell session."
  Write-Host "FlutterRoot=$FlutterRoot"
  Write-Host "AndroidSdkRoot=$AndroidSdkRoot"
  if ($PrintBuildCommands) {
    Write-Host ""
    Write-Host "Debug build:"
    Write-Host "  cd apps\mobile-companion"
    Write-Host "  flutter build apk --debug"
    Write-Host ""
    Write-Host "Release split-ABI build:"
    Write-Host "  cd apps\mobile-companion"
    Write-Host "  flutter clean"
    Write-Host "  flutter pub get"
    Write-Host "  flutter build apk --release --split-per-abi"
    Write-Host '  Get-ChildItem .\build\app\outputs\flutter-apk\app-*-release.apk | Select-Object Name,@{Name="MB";Expression={[math]::Round($_.Length / 1MB, 2)}}'
  }
  return
}

flutter --version
if (-not $SkipDoctor) {
  flutter doctor -v
}

if ($PrintBuildCommands) {
  Write-Host ""
  Write-Host "Debug build:"
  Write-Host "  cd apps\mobile-companion"
  Write-Host "  flutter build apk --debug"
  Write-Host ""
  Write-Host "Release split-ABI build:"
  Write-Host "  cd apps\mobile-companion"
  Write-Host "  flutter clean"
  Write-Host "  flutter pub get"
  Write-Host "  flutter build apk --release --split-per-abi"
  Write-Host '  Get-ChildItem .\build\app\outputs\flutter-apk\app-*-release.apk | Select-Object Name,@{Name="MB";Expression={[math]::Round($_.Length / 1MB, 2)}}'
}
