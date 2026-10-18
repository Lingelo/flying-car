# Flying Car — Neon City

Bac à sable Three.js : pilotez une voiture volante dans une ville cyberpunk **infinie**, générée
procéduralement, de jour comme de nuit et par tous les temps. Roulez dans les rues, décollez,
glissez entre les gratte-ciels et insérez-vous dans les couloirs de trafic aérien.

Plan produit et technique (Kaizen) :
[`docs/plans/2026-10-18-1313-feat-cyberpunk-flying-car-sandbox-plan.md`](docs/plans/2026-10-18-1313-feat-cyberpunk-flying-car-sandbox-plan.md).

## Ce qu'il y a dedans

- **Ville infinie à graine** : tronçons de 256 m générés dans un Web Worker autour du joueur, quatre
  quartiers (centre de mégatours, quartier néon, canaux, zone industrielle), façades procédurales,
  enseignes et hologrammes animés, passerelles, vapeur. La même graine redonne la même ville.
- **Voiture volante** au style roadster (design original) : conduite arcade avec dérapages, décollage
  en 1,5 s (les roues se replient en propulseurs), vol jusqu'à 600 m, atterrissage sur la chaussée ou
  sur un toit, collisions qui font rebondir.
- **Trafic** : quatre paliers de couloirs aériens balisés, voitures au sol avec feux tricolores, les
  véhicules ralentissent puis contournent le joueur ; traînées lumineuses jusqu'à l'horizon.
- **Ambiance** : cycle jour/nuit (24 min), météo dynamique (dégagé, brume, pluie), rues mouillées avec
  reflets de néons et ronds dans les flaques, brouillard de hauteur, bloom, ombres du soleil.
- **Son** : moteur et propulseurs synthétisés, ville, vent, pluie, passages de véhicules spatialisés,
  radio de synthwave générative.
- **Caméras** poursuite / cockpit / cinématique, **mode photo**, HUD avec minicarte, menu de réglages.

Tout le contenu (géométrie, textures, sons, musique) est généré par le code : aucun asset à licencier.
Un modèle `public/models/roadster.glb` (avant vers +z) remplace la voiture procédurale s'il est
présent, et des pistes peuvent être ajoutées à la radio via `public/audio/radio/manifest.json`
(`[{ "title", "artist", "license", "file" }]`). Citer toute source ajoutée dans
[`public/assets/CREDITS.md`](public/assets/CREDITS.md).

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
```

Navigateur desktop récent avec WebGL2. Cible : 60 images/s en 1080p en qualité haute sur un GPU de
classe RTX 3060 / RX 6600.

## Commandes

| Action | Clavier | Manette |
|---|---|---|
| Accélérer / freiner | W S ou ↑ ↓ | RT / LT |
| Diriger | A D ou ← → | stick gauche |
| Décoller / atterrir | F | Y |
| Monter / descendre (en vol) | Espace / C | RB / LB |
| Boost | Maj gauche | A |
| Caméra | V | Select |
| Mode photo / capturer | P / Entrée | B (mode photo) |
| Radio / piste suivante | M / R | ↓ / X |
| HUD | H | ↑ |
| Menu (réglages, touches) | Échap | Start |

Cliquez dans la scène pour regarder à la souris. Les touches se reconfigurent dans le menu.

## Paramètres d'URL

| Paramètre | Effet |
|---|---|
| `?seed=42` | autre ville (entier 32 bits) |
| `?hour=18.5` | heure fixe |
| `?weather=rain` | `clear`, `haze` ou `rain` |
| `?quality=medium` | `low`, `medium` ou `high` |
| `?bench=1` | benchmark : 60 s de vol au-dessus du centre, la nuit sous la pluie, puis moyenne et 1 % bas |
| `?debug=1` | expose `window.__debug` et `window.__game` (tests navigateur) |

## Vérifier

```bash
npm run typecheck
npm test           # Vitest : génération, streaming, pilotage, collisions, trafic, météo…
npm run build
npm run e2e        # Playwright : chargement, streaming sur 15 km, mode photo
```

En CI (`.github/workflows/ci.yml`) les mêmes commandes tournent sur chaque PR ; la branche `main` est
déployée sur GitHub Pages (`.github/workflows/pages.yml`).
