# CarteDeVoeuxDebiles.co 🤪

À partir d'une photo, le site génère des versions déformées (grosse tête, tête de fourmi, tourbillon, fondu…) et compose une carte de vœux prête à imprimer (A6/A5, 300 dpi, fond perdu en option).

## Architecture

```
Navigateur (React + Vite)
   │  1. POST /api/uploads ───────────────► Lambda .NET 8 (ASP.NET Core minimal API)
   │  2. PUT photo (URL présignée) ───────► S3 « images » (supprimées après 24 h)
   │  3. POST /api/cards ─────────────────► Lambda : lit la photo, applique les déformations,
   │                                          écrit les JPEG dans S3, renvoie des URLs présignées
   │  4. Composition de la carte dans un <canvas> (texte, modèle, format) → PNG / impression
   ▼
CloudFront ── /        → S3 « site » (build React)
           └─ /api/*   → API Gateway HTTP API → Lambda
```

- **Envoi direct vers S3** : la photo ne transite pas par la Lambda, ce qui contourne la limite de 6 Mo par requête.
- **Un seul domaine** : CloudFront sert le site et l'API, donc l'API n'a pas besoin de règles CORS.
- **Déformations en C# pur** ([Distortions.cs](backend/src/CarteDeVoeuxDebiles.Core/Distortions/Distortions.cs)) : mapping inverse avec interpolation bilinéaire, parallélisé par ligne. SkiaSharp (licence MIT) ne sert qu'à décoder et encoder les images.
- **Point focal** : l'utilisateur clique sur la photo (sur le nez, idéalement) pour centrer les effets.

| Dossier | Contenu |
| --- | --- |
| `backend/src/CarteDeVoeuxDebiles.Core` | Déformations, buffer de pixels, orientation EXIF, codec |
| `backend/src/CarteDeVoeuxDebiles.Api` | API + hébergement Lambda, stockage S3 / local |
| `backend/tests/CarteDeVoeuxDebiles.Core.Tests` | Tests xUnit |
| `frontend` | Site React (TypeScript) |
| `template.yaml` | Infra AWS SAM |
| `deploy.ps1` | Build et déploiement complets |

## Développement local

Aucun compte AWS n'est nécessaire : en local, l'API stocke les fichiers dans `.local-storage/` et simule les URLs présignées.

Le plus simple : `./dev.ps1`, qui lance les deux. À la main :

```powershell
# Terminal 1 : API sur http://localhost:5081
cd backend/src/CarteDeVoeuxDebiles.Api
dotnet run

# Terminal 2 : site sur http://localhost:5173 (proxy /api vers :5081)
cd frontend
npm install
npm run dev
```

Tests : `cd backend; dotnet test`

### Ajouter une déformation

1. Créez une classe héritant de `WarpDistortion` dans `Distortions.cs`. Il suffit de renvoyer, pour chaque pixel de sortie, la coordonnée source à lire.
2. Enregistrez-la dans `DistortionCatalog.Default`.

Le frontend récupère automatiquement la liste via `GET /api/effects`.

## Déploiement AWS

Prérequis : AWS CLI configurée, SAM CLI, .NET 8 SDK, Node 20+ et `dotnet tool install -g Amazon.Lambda.Tools`.

```powershell
./deploy.ps1                       # URL CloudFront par défaut (xxxx.cloudfront.net)
```

### Avec le domaine cartedevoeuxdebiles.co

1. Achetez le domaine (Route 53 ou un autre registrar ; les `.co` ne sont pas proposés partout).
2. Demandez un certificat ACM **en us-east-1** pour `cartedevoeuxdebiles.co` et `www.cartedevoeuxdebiles.co`, puis validez-le par DNS.
3. Déployez :

```powershell
./deploy.ps1 -DomainName cartedevoeuxdebiles.co `
  -CertificateArn arn:aws:acm:us-east-1:<compte>:certificate/<id> `
  -HostedZoneId <zone Route 53>   # facultatif : crée les enregistrements A/AAAA
```

Sans `HostedZoneId`, faites pointer le domaine (en CNAME ou ALIAS) vers la distribution CloudFront.

### Coûts et limites

- Lambda arm64 avec 2 Go de mémoire : environ 0,5 à 2 s pour générer les 9 effets en 2000 px.
- L'API est limitée à 10 requêtes/s (pics à 20), réglable dans `template.yaml`.
- Les photos et les images générées sont supprimées après 1 jour (règle de cycle de vie S3). Les URLs de téléchargement expirent au bout d'1 h.
