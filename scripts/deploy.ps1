# 部署到自架 Docker 主機：打包 → 傳送並核對 → 在遠端建置並啟動 fayitw-web 容器
# 用法（在專案根目錄）：
#   powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Server user@host -ProxyNetwork 網路名稱
# 也可以先設定環境變數 FAYITW_DEPLOY_SERVER、FAYITW_PROXY_NETWORK，之後省略參數。
# 主機位址與網路名稱都不寫進 repo。
param(
    [string]$Server = $env:FAYITW_DEPLOY_SERVER,
    [string]$ProxyNetwork = $env:FAYITW_PROXY_NETWORK,  # 主機上 Proxy 容器所在的 Docker 網路
    [string]$RemoteDir = 'fayitw-deploy'  # 遠端家目錄底下的資料夾
)
$ErrorActionPreference = 'Stop'
if (-not $Server) { throw '請用 -Server user@host 指定部署主機，或設定環境變數 FAYITW_DEPLOY_SERVER' }
if (-not $ProxyNetwork) { throw '請用 -ProxyNetwork 指定 Proxy 所在的 Docker 網路，或設定環境變數 FAYITW_PROXY_NETWORK' }

$root = Split-Path $PSScriptRoot -Parent
$release = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path $env:TEMP "fayitw-$release.tar"
$sshOpts = @('-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=5')

function Invoke-Remote([string]$Code) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes("`$ProgressPreference='SilentlyContinue';" + $Code))
    # docker 的建置進度寫在 stderr；只看結束代碼判斷成敗，不讓進度訊息中斷腳本
    $ErrorActionPreference = 'Continue'
    & ssh @sshOpts $Server powershell -NoProfile -NonInteractive -OutputFormat Text -EncodedCommand $encoded
    if ($LASTEXITCODE -ne 0) { throw "遠端指令失敗（exit $LASTEXITCODE）" }
}

# 1. 只打包網站需要的檔案（根目錄的每個 .html 頁面都會帶上，新增頁面不用改這裡）
# 固定用 Windows 內建的 tar：從 Git Bash 執行時 PATH 會先找到 GNU tar，它會把 C:\ 路徑當成遠端主機
$tar = Join-Path $env:SystemRoot 'System32\tar.exe'
if (-not (Test-Path $tar)) { $tar = 'tar' }
Push-Location $root
try {
    $pages = (Get-ChildItem -Filter *.html -File).Name
    & $tar -cf $archive Dockerfile .dockerignore compose.yaml docker @pages css js assets
}
finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw '打包失敗' }
$hash = (Get-FileHash $archive -Algorithm SHA256).Hash

# 2. 傳到遠端的獨立版本目錄
$remoteHome = "$(Invoke-Remote '([string]$HOME).Replace(''\'', ''/'')')".Trim()
$remoteRoot = "$remoteHome/$RemoteDir"
$dir = "$remoteRoot/releases/$release"
Invoke-Remote "New-Item -ItemType Directory -Force '$dir' | Out-Null"
& scp @sshOpts $archive "${Server}:$dir/site.tar"
if ($LASTEXITCODE -ne 0) { throw '傳送失敗' }
Remove-Item $archive

# 3. 遠端核對 SHA-256、解壓、建置並等容器健康
Invoke-Remote @"
`$dir = '$dir'
if ((Get-FileHash "`$dir/site.tar" -Algorithm SHA256).Hash -ne '$hash') { Write-Output '傳送後檔案不一致'; exit 1 }
tar -xf "`$dir/site.tar" -C `$dir
if (`$LASTEXITCODE -ne 0) { exit 1 }
# SSH 工作階段無法使用 Docker Desktop 的憑證管理器，改用獨立的 CLI 設定拉公開映像
`$env:DOCKER_CONFIG = '$remoteRoot/docker-cli'
if (-not (Test-Path "`$env:DOCKER_CONFIG/config.json")) {
    New-Item -ItemType Directory -Force `$env:DOCKER_CONFIG | Out-Null
    Set-Content "`$env:DOCKER_CONFIG/config.json" '{}' -Encoding ascii
}
`$env:FAYITW_PROXY_NETWORK = '$ProxyNetwork'
docker compose -f "`$dir/compose.yaml" up -d --build --wait
if (`$LASTEXITCODE -ne 0) { exit 1 }
docker ps --filter name=fayitw-web --format '{{.Names}}  {{.Image}}  {{.Status}}'
"@

Write-Output "已部署版本 $release（遠端目錄 $dir）"
