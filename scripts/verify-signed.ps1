param(
  [Parameter(Mandatory=$true)][string]$DistDir,
  [Parameter(Mandatory=$true)][string]$ExpectedPublisher,
  [Parameter(Mandatory=$true)][string]$ExpectedName
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $DistDir -PathType Container)) {
  throw 'Pasta dist ausente.'
}
$package = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../package.json') -Raw | ConvertFrom-Json
$version = $package.version
$installer = Join-Path $DistDir "Edge Sidebar Lite-Setup-$version-x64.exe"
$mainExe = Join-Path $DistDir 'win-unpacked/Edge Sidebar Lite.exe'
foreach ($file in @($installer, $mainExe)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw "Binário esperado ausente: $file"
  }
  $signature = Get-AuthenticodeSignature -LiteralPath $file
  if ($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate) {
    throw "Assinatura Authenticode inválida em $file. Status: $($signature.Status)"
  }
  if ($signature.SignerCertificate.Subject -ne $ExpectedPublisher) {
    throw "Publicador incorreto em $file. Esperado: $ExpectedPublisher; recebido: $($signature.SignerCertificate.Subject)"
  }
  if ($signature.SignerCertificate.Subject -notmatch [regex]::Escape($ExpectedName)) {
    throw "Identidade do certificado não corresponde ao certificado escolhido: $ExpectedName"
  }
  Write-Host "OK assinatura: $([IO.Path]::GetFileName($file))"
}
# Electron-builder uses beta.yml for a beta build and latest.yml for stable.
$manifestName = if ($version -match '-beta[.-]') { 'beta.yml' } else { 'latest.yml' }
$manifest = Join-Path $DistDir $manifestName
if (-not (Test-Path $manifest -PathType Leaf)) { throw "$manifestName ausente: atualização automática não pode ser distribuída." }
$content = Get-Content $manifest -Raw
if ($content -notmatch 'files:' -or $content -notmatch 'sha512:' -or $content -notmatch [regex]::Escape("version: $version")) {
  throw 'Manifesto $manifestName inválido ou incompleto.'
}
$updateConfig = Join-Path $DistDir 'win-unpacked/resources/app-update.yml'
if (-not (Test-Path $updateConfig -PathType Leaf)) {
  throw 'app-update.yml ausente no pacote; falta configuração de atualização.'
}
if ((Get-Content -LiteralPath $updateConfig -Raw) -notmatch 'publisherName:') {
  throw 'app-update.yml sem publisherName: bloqueado.'
}
Write-Host 'OK: Authenticode e metadados de update verificados. Inspeção de UX/instalação ainda necessária.'
