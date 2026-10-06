# Copiez ce fichier en deploy.config.psd1 (non versionné) et renseignez vos valeurs.
# Laissez une valeur vide pour déployer sans domaine (URL CloudFront par défaut).
@{
    DomainName     = 'example.com'
    # Certificat ACM en us-east-1 couvrant example.com et www.example.com.
    CertificateArn = 'arn:aws:acm:us-east-1:<compte>:certificate/<id>'
    # Facultatif : zone Route 53, pour créer les enregistrements A/AAAA.
    HostedZoneId   = ''
}
