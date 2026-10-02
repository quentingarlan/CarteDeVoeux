<#
.SYNOPSIS
    Déploie CarteDeVoeuxDebiles.co : stack SAM (Lambda, S3, CloudFront), puis le site React.

.EXAMPLE
    ./deploy.ps1
    ./deploy.ps1 -DomainName cartedevoeuxdebiles.co -CertificateArn arn:aws:acm:us-east-1:123456789012:certificate/... -HostedZoneId Z0123456789
#>
param(
    [string]$StackName = 'cartedevoeuxdebiles',
    [string]$Region = 'eu-west-3',
    [string]$DomainName = '',
    [string]$CertificateArn = '',
    [string]$HostedZoneId = ''
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
    # Les fichiers de dist/assets ont un hash dans leur nom : cache long. index.html : toujours revalidé.
    Invoke-Native { aws s3 sync frontend/dist "s3://$bucket" --delete --region $Region --exclude index.html --cache-control 'public,max-age=31536000,immutable' }
    Invoke-Native { aws s3 cp frontend/dist/index.html "s3://$bucket/index.html" --region $Region --cache-control 'no-cache' }
    Invoke-Native { aws cloudfront create-invalidation --distribution-id $distribution --paths '/' '/index.html' | Out-Null }

    Write-Host "`nC'est en ligne : $(& $output 'SiteUrl')" -ForegroundColor Green
}
finally {
    Pop-Location
}
