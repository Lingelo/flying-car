# Flying Car — Neon City

**Jouer dans le navigateur : https://lingelo.github.io/flying-car/** (desktop, WebGL2)

Bac à sable Three.js : pilotez une voiture volante dans un Tokyo cyberpunk **infini**, généré
procéduralement, toujours de nuit et par tous les temps. Roulez dans les rues, décollez, glissez entre
les gratte-ciels et insérez-vous dans les couloirs de trafic aérien.

Plans produit et technique (Kaizen), dans l'ordre :
[bac à sable](docs/plans/2026-10-18-1313-feat-cyberpunk-flying-car-sandbox-plan.md),
[passe visuelle Tokyo](docs/plans/2026-10-18-1437-feat-tokyo-visual-pass-plan.md),
[passe réalisme](docs/plans/2026-10-18-1506-feat-realism-pass-plan.md). Leçons retenues :
[`docs/learnings/`](docs/learnings/).

## Ce qu'il y a dedans

- **Ville infinie à graine** : tronçons de 256 m générés dans un Web Worker autour du joueur, quatre
  quartiers (centre de mégatours, quartier néon, canaux, zone industrielle), façades photographiques
  avec fenêtres en profondeur, boutiques au rez-de-chaussée, enseignes en tubes néon, hologrammes,
  métro aérien, temples, une Tokyo Tower, équipements de toits ; la même graine redonne la même ville.
- **Voiture volante** : coupé anguleux au design original, conduite arcade avec dérapages, décollage
  en 1,5 s (les roues se replient à plat sous le plancher), vol jusqu'à 600 m, atterrissage sur la
  chaussée ou sur un toit, collisions qui font rebondir.
- **Trafic** : berlines de patrouille volantes, fourgons et sportives ; quatre paliers de couloirs
  aériens balisés, voitures au sol avec feux tricolores, véhicules qui ralentissent puis contournent le
  joueur ; traînées lumineuses jusqu'à l'horizon.
- **Ambiance** : nuit permanente façon Blade Runner, météo dynamique (temps sec, pluie, brouillard,
  orage avec éclairs et tonnerre), rues mouillées avec reflets, brouillard de hauteur, ciel de smog
  balayé par des projecteurs, ligne d'horizon de tours au loin, occlusion ambiante, bloom.
- **Son** : moteur et turbines synthétisés, ville, vent, pluie, passages de véhicules spatialisés,
  radio darkwave générative.
- **Caméras** poursuite / cockpit / cinématique, **mode photo**, HUD avec minicarte, menu de réglages.

Géométrie, sons et musique sont générés par le code ; les textures photographiques sont des CC0 de
Poly Haven (`python3 scripts/fetch_assets.py`), avec un repli procédural si elles manquent. Un modèle `public/models/roadster.glb` (avant vers +z) remplace la voiture procédurale s'il est
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
| `?hour=23.5` | heure fixe (toujours la nuit : de 20 h 30 à 4 h 30) |
| `?weather=rain` | `clear` (sec), `rain`, `fog` ou `storm` (orage) |
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
