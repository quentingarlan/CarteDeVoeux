<#
.SYNOPSIS
    Déploie cartesvoeuxdebiles.com : stack SAM (Lambda, S3, CloudFront), puis le site React.

.EXAMPLE
    ./deploy.ps1
    ./deploy.ps1 -DomainName '' -CertificateArn ''   # sans domaine : URL CloudFront par défaut
#>
param(
    [string]$StackName = 'cartedevoeuxdebiles',
    [string]$Region = 'eu-central-1',
    [string]$DomainName = 'cartesvoeuxdebiles.com',
    [string]$CertificateArn = 'arn:aws:acm:us-east-1:824851412494:certificate/c1a6e751-c0d8-4bee-a4c1-7ba60a528a89',
    [string]$HostedZoneId = 'Z01992693P3NXAKLS9NB7'
)

$ErrorActionPreference = 'Stop'

function Invoke-Native([scriptblock]$Command) {
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "Échec : $Command" }
}

Push-Location $PSScriptRoot
try {
    Write-Host '==> Build de la Lambda .NET' -ForegroundColor Cyan
    Invoke-Native { sam build }

    Write-Host '==> Déploiement de la stack' -ForegroundColor Cyan
    $overrides = @()
    if ($DomainName) { $overrides += "DomainName=$DomainName" }
    if ($CertificateArn) { $overrides += "CertificateArn=$CertificateArn" }
    if ($HostedZoneId) { $overrides += "HostedZoneId=$HostedZoneId" }
    $deployArgs = @('deploy', '--stack-name', $StackName, '--region', $Region, '--capabilities', 'CAPABILITY_IAM',
        '--resolve-s3', '--no-confirm-changeset', '--no-fail-on-empty-changeset')
    if ($overrides) { $deployArgs += @('--parameter-overrides') + $overrides }
    Invoke-Native { sam @deployArgs }

    $outputs = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query 'Stacks[0].Outputs' | ConvertFrom-Json
    $output = { param($key) ($outputs | Where-Object OutputKey -eq $key).OutputValue }
    $bucket = & $output 'WebsiteBucketName'
    $distribution = & $output 'DistributionId'

    Write-Host '==> Build du site React' -ForegroundColor Cyan
    Push-Location frontend
    try {
        Invoke-Native { npm ci }
        Invoke-Native { npm run build }
    }
    finally { Pop-Location }

    Write-Host '==> Publication sur S3 / CloudFront' -ForegroundColor Cyan
    # Les fichiers de dist/assets ont un hash dans leur nom : cache long. Les pages HTML (/ et /en/), robots.txt et sitemap.xml : toujours revalidés.
    Invoke-Native { aws s3 sync frontend/dist "s3://$bucket" --delete --region $Region --exclude '*.html' --exclude '*.wasm' --exclude 'robots.txt' --exclude 'sitemap.xml' --cache-control 'public,max-age=31536000,immutable' }
    Invoke-Native { aws s3 sync frontend/dist "s3://$bucket" --region $Region --exclude '*' --include '*.html' --include 'robots.txt' --include 'sitemap.xml' --cache-control 'no-cache' }

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
    Invoke-Native { aws cloudfront create-invalidation --distribution-id $distribution --paths '/' '/index.html' '/en/index.html' | Out-Null }

    Write-Host "`nC'est en ligne : $(& $output 'SiteUrl')" -ForegroundColor Green
}
finally {
    Pop-Location
}
