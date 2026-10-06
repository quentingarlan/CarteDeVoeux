<#
.SYNOPSIS
    Déploie cartesvoeuxdebiles.com : WAF (us-east-1), stack SAM (Lambda, S3, CloudFront), puis le site React.

.DESCRIPTION
    Domaine, certificat et zone DNS sont lus dans deploy.config.psd1 (non versionné, voir deploy.config.example.psd1).
    Un paramètre passé en ligne de commande l'emporte sur le fichier.

.EXAMPLE
    ./deploy.ps1
    ./deploy.ps1 -DomainName '' -CertificateArn ''   # sans domaine : URL CloudFront par défaut
    ./deploy.ps1 -SkipWaf                            # sans WAF (évite son coût mensuel)
#>
param(
    [string]$StackName = 'cartedevoeuxdebiles',
    [string]$Region = 'eu-central-1',
    [string]$DomainName,
    [string]$CertificateArn,
    [string]$HostedZoneId,
    [switch]$SkipWaf
)

$ErrorActionPreference = 'Stop'

function Invoke-Native([scriptblock]$Command) {
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "Échec : $Command" }
}

function Get-StackOutput([string]$Stack, [string]$StackRegion, [string]$Key) {
    $outputs = aws cloudformation describe-stacks --stack-name $Stack --region $StackRegion --query 'Stacks[0].Outputs' | ConvertFrom-Json
    ($outputs | Where-Object OutputKey -eq $Key).OutputValue
}

Push-Location $PSScriptRoot
try {
    $configPath = Join-Path $PSScriptRoot 'deploy.config.psd1'
    if (Test-Path $configPath) {
        $config = Import-PowerShellDataFile $configPath
        foreach ($name in 'DomainName', 'CertificateArn', 'HostedZoneId') {
            if (-not $PSBoundParameters.ContainsKey($name) -and $config.ContainsKey($name)) {
                Set-Variable -Name $name -Value $config[$name]
            }
        }
    }

    $webAclArn = ''
    if (-not $SkipWaf) {
        # Un WAF pour CloudFront ne peut exister qu'en us-east-1.
        Write-Host '==> Déploiement du WAF (us-east-1)' -ForegroundColor Cyan
        $wafStack = "$StackName-waf"
        Invoke-Native { aws cloudformation deploy --stack-name $wafStack --region us-east-1 --template-file waf.yaml --no-fail-on-empty-changeset }
        $webAclArn = Get-StackOutput $wafStack 'us-east-1' 'WebAclArn'
    }

    Write-Host '==> Build de la Lambda .NET' -ForegroundColor Cyan
    Invoke-Native { sam build }

    Write-Host '==> Déploiement de la stack' -ForegroundColor Cyan
    $overrides = @()
    if ($DomainName) { $overrides += "DomainName=$DomainName" }
    if ($CertificateArn) { $overrides += "CertificateArn=$CertificateArn" }
    if ($HostedZoneId) { $overrides += "HostedZoneId=$HostedZoneId" }
    # Omis avec -SkipWaf : la valeur par défaut (vide) détache un WAF associé lors d'un déploiement précédent.
    if ($webAclArn) { $overrides += "WebAclArn=$webAclArn" }
    $deployArgs = @('deploy', '--stack-name', $StackName, '--region', $Region, '--capabilities', 'CAPABILITY_IAM',
        '--resolve-s3', '--no-confirm-changeset', '--no-fail-on-empty-changeset')
    if ($overrides) { $deployArgs += @('--parameter-overrides') + $overrides }
    Invoke-Native { sam @deployArgs }

    $bucket = Get-StackOutput $StackName $Region 'WebsiteBucketName'
    $distribution = Get-StackOutput $StackName $Region 'DistributionId'

    Write-Host '==> Build du site React' -ForegroundColor Cyan
    Push-Location frontend
    try {
        Invoke-Native { npm ci }
        Invoke-Native { npm run build }
    }
    finally { Pop-Location }

    Write-Host '==> Publication sur S3 / CloudFront' -ForegroundColor Cyan
    # Les fichiers de dist/assets ont un hash dans leur nom : cache long. Les pages HTML (/ et /en/), robots.txt et sitemap.xml : toujours revalidés.
    # Les fichiers __* de public/ ne servent qu'aux tests locaux : ils ne sont pas publiés.
    Invoke-Native { aws s3 sync frontend/dist "s3://$bucket" --delete --region $Region --exclude '__*' --exclude '*.html' --exclude '*.wasm' --exclude 'robots.txt' --exclude 'sitemap.xml' --cache-control 'public,max-age=31536000,immutable' }
    Invoke-Native { aws s3 sync frontend/dist "s3://$bucket" --region $Region --exclude '*' --include '*.html' --include 'robots.txt' --include 'sitemap.xml' --cache-control 'no-cache' }
    # sync --delete ignore les fichiers exclus : on retire explicitement ceux publiés par d'anciens déploiements.
    Invoke-Native { aws s3 rm "s3://$bucket" --recursive --region $Region --exclude '*' --include '__*' }

    # Le WebAssembly du détourage dépasse 10 Mo, limite au-delà de laquelle CloudFront ne compresse plus : on l'envoie déjà gzippé.
    foreach ($wasm in Get-ChildItem frontend/dist -Recurse -Filter *.wasm) {
        $gzipped = "$($wasm.FullName).gz"
        $source = [IO.File]::OpenRead($wasm.FullName)
        $target = [IO.File]::Create($gzipped)
        $gzip = New-Object IO.Compression.GZipStream($target, [IO.Compression.CompressionLevel]::Optimal)
        try { $source.CopyTo($gzip) } finally { $gzip.Dispose(); $target.Dispose(); $source.Dispose() }
        $key = $wasm.FullName.Substring((Resolve-Path frontend/dist).Path.Length + 1).Replace('\', '/')
        Invoke-Native { aws s3 cp $gzipped "s3://$bucket/$key" --region $Region --content-encoding gzip --content-type application/wasm --cache-control 'public,max-age=31536000,immutable' }
        Remove-Item $gzipped
    }
    Invoke-Native { aws cloudfront create-invalidation --distribution-id $distribution --paths '/' '/index.html' '/en/index.html' '/robots.txt' '/sitemap.xml' '/__*' | Out-Null }

    Write-Host "`nC'est en ligne : $(Get-StackOutput $StackName $Region 'SiteUrl')" -ForegroundColor Green
}
finally {
    Pop-Location
}
