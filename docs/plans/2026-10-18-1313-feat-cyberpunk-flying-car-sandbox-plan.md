---
title: Bac à sable voiture volante cyberpunk - Plan
type: feat
date: 2026-10-18
topic: cyberpunk-flying-car-sandbox
artifact: kaizen-plan/v1
source: brainstorm
---

# Bac à sable voiture volante cyberpunk - Plan

<!-- kaizen:goal -->
## Capsule d'objectif

**Objectif :** depuis un navigateur desktop, un joueur explore librement et sans fin une ville
cyberpunk futuriste au rendu réaliste, au volant d'une voiture volante qu'il conduit dans les rues ou
pilote au-dessus des gratte-ciels, au milieu d'un trafic aérien et terrestre vivant, de jour comme de
nuit et par tous les temps.
**Moyens :** Three.js (rendu WebGL2) + Vite + TypeScript, imposés par le choix d'approche en séance.
**Autorité produit :** périmètre décidé par Angélo LIMA pendant la séance de brainstorm du 2026-10-18.
**Bloqueurs ouverts :** aucun.

<!-- kaizen:product -->
## Contrat produit

### Résumé
Un bac à sable 3D temps réel dans le navigateur : une ville cyberpunk générée à l'infini autour du
joueur, une voiture volante biplace au pilotage arcade qui passe du sol aux airs, des couloirs de
trafic aérien réactifs, un cycle jour/nuit et une météo dynamique, avec son spatialisé, radio,
plusieurs caméras, HUD et réglages de qualité. Pas d'objectifs, pas de score : l'exploration seule.

### Problème
Il n'existe pas d'expérience web jouable immédiatement (sans installation) qui procure la sensation
« Blade Runner / Cyberpunk » de voler entre des mégatours au milieu d'un trafic aérien dense, avec un
rendu crédible. Le projet est créé de zéro (dépôt vide).

### Acteurs
- **Joueur** — sur PC desktop, clavier/souris ou manette, veut se balader et contempler.

### Exigences

**Voiture du joueur**
- R1. Le joueur pilote une voiture volante biplace basse aux lignes fluides de roadster électrique, au
  design original (sans nom, logo ni forme déposée d'un constructeur).
- R2. La voiture roule au sol sur les routes avec un comportement arcade nerveux : accélération vive,
  inertie et dérapages pardonnants.
- R3. Le joueur passe du mode sol au mode vol par une commande dédiée ; la transition (déploiement des
  propulseurs, décollage ou atterrissage) est animée et ne dure pas plus de 2 secondes.
- R4. En vol, le joueur contrôle vitesse, direction et altitude, du ras du sol jusqu'au-dessus des plus
  hautes tours, avec une altitude plafond au-delà de laquelle la voiture ne monte plus.
- R5. Une collision avec un bâtiment, le sol ou un véhicule fait rebondir et ralentir la voiture, sans
  la détruire ni interrompre la partie.
- R6. Le pilotage est jouable au clavier/souris et à la manette, avec des touches reconfigurables.

**Ville**
- R7. La ville est générée procéduralement par blocs autour du joueur et sans limite : les blocs sont
  créés devant lui et libérés derrière, sans écran de chargement pendant le jeu.
- R8. Une même graine produit toujours la même ville ; la graine est modifiable au lancement.
- R9. La ville comporte plusieurs quartiers visuellement distincts (au moins : centre de mégatours,
  quartier néon dense, zone industrielle, canaux).
- R10. Bâtiments, rues et véhicules portent l'esthétique cyberpunk : enseignes et hologrammes
  lumineux, écrans publicitaires animés, néons, structures et passerelles en hauteur.
- R11. Les rues au sol sont vivantes : routes marquées, trafic terrestre sur des voies, vapeur,
  flaques et surfaces mouillées réfléchissantes quand il pleut.

**Trafic aérien**
- R12. Plusieurs couloirs de trafic aérien existent à différentes altitudes, matérialisés par des
  balises lumineuses visibles de loin.
- R13. Les véhicules du trafic suivent leur couloir et ralentissent ou contournent le joueur lorsqu'il
  se trouve sur leur trajectoire.
- R14. Le joueur peut s'insérer dans un couloir et en suivre le flux, ou voler librement hors des
  couloirs.

**Ambiance**
- R15. Un cycle jour/nuit fait passer la ville par le jour, le crépuscule et la nuit ; l'éclairage,
  le ciel et l'allumage des néons et fenêtres suivent l'heure.
- R16. La météo évolue dynamiquement entre au moins temps clair, brume/smog et pluie, avec des
  transitions progressives ; la pluie mouille les surfaces et réduit la visibilité.
- R17. Le rendu vise le réalisme : matériaux PBR, reflets, bloom des lumières, brouillard
  atmosphérique et ombres.

**Son**
- R18. Le son est spatialisé : moteur/propulseurs qui varient avec la vitesse et le mode, ambiance de
  ville, pluie, et passage des véhicules autour du joueur.
- R19. Une radio de bord diffuse de la musique synthwave avec changement de piste et coupure.

**Caméras, interface et réglages**
- R20. Le joueur choisit entre une vue poursuite, une vue cockpit et une caméra cinématique.
- R21. Un mode photo fige le monde, libère la caméra et permet d'enregistrer une capture d'écran.
- R22. Un HUD affiche vitesse, altitude, mode sol/vol, heure, météo et une minicarte des environs ; il
  peut être masqué.
- R23. Un menu de réglages propose des préréglages qualité (bas, moyen, haut), le choix de l'heure et
  de la météo (ou leur évolution automatique) et la configuration des touches.

**Plateforme et performance**
- R24. L'expérience tourne dans un navigateur desktop récent, sans installation, et vise 60 images par
  seconde en 1080p en qualité haute sur la configuration de référence.
- R25. Le monde reste fluide pendant le vol à vitesse maximale : la génération des blocs ne provoque
  pas d'à-coups visibles.

### Décisions clés
- **Bac à sable libre** — l'effort porte sur l'ambiance, le pilotage et le trafic plutôt que sur un
  game design. Gouverne R1–R25, et la section Hors périmètre. (décidé en séance : choisi plutôt qu'un
  jeu à objectifs ou une simple vitrine — l'exploration est le cœur du projet)
- **Desktop haute qualité** — gouverne R6, R17, R24. (décidé en séance : choisi plutôt que
  desktop + mobile — permet des effets riches sans compromis tactile)
- **Pilotage arcade nerveux** — gouverne R2–R5. (décidé en séance : choisi plutôt qu'une
  semi-simulation — prise en main immédiate)
- **Trafic réactif** — gouverne R12–R14. (décidé en séance : choisi plutôt qu'un trafic décoratif ou
  des couloirs obligatoires)
- **Rues vivantes sans piétons** — gouverne R11. (décidé en séance : les piétons crédibles coûtent cher
  à animer, reportés)
- **Cycle jour/nuit et météo dynamique** — gouverne R15, R16. (décidé en séance : choisi plutôt
  qu'une nuit fixe avec pluie, plus ambitieux mais voulu)
- **Ville procédurale à graine** — gouverne R7–R9. (décidé en séance : choisi plutôt qu'une grande
  carte qui boucle)
- **Assets hybrides** — voiture et véhicules en glTF (modélisés ou sous licence libre CC0),
  bâtiments générés par code, textures PBR CC0. Gouverne R1, R10, R17. (décidé en séance : choisi
  plutôt que du 100 % procédural ou des assets fournis)
- **Son, radio, caméras multiples, HUD et réglages dans la v1** — gouverne R18–R23. (décidé en
  séance : les quatre extensions proposées ont été retenues)
- **Three.js WebGL2 + Vite/TypeScript** — gouverne R17, R24. (décidé en séance : choisi plutôt que
  WebGPU/TSL — écosystème plus jeune — ou React Three Fiber — surcoût sur une ville infinie dense)

### Parcours clés
1. **Première balade** — le joueur ouvre la page, la voiture est garée dans une rue du quartier néon ;
   il roule, décolle, monte entre les tours, rejoint un couloir de trafic, en sort, redescend et
   atterrit dans une autre rue.
2. **Contemplation** — le joueur règle l'heure au crépuscule et lance la pluie, passe en caméra
   cinématique puis en mode photo et enregistre une capture.

### Exemples d'acceptation
- AE1. (couvre R3) Étant donné la voiture à l'arrêt au sol, quand le joueur active le mode vol, alors
  les propulseurs se déploient et la voiture décolle en moins de 2 secondes, et le HUD indique « vol ».
- AE2. (couvre R3, R5) Étant donné la voiture en vol au-dessus d'une rue, quand le joueur repasse en
  mode sol, alors elle descend et se pose sur la chaussée sans traverser le sol ni un véhicule.
- AE3. (couvre R4) Étant donné la voiture à l'altitude plafond, quand le joueur continue de monter,
  alors l'altitude ne change plus.
- AE4. (couvre R5) Étant donné la voiture lancée à pleine vitesse vers une façade, quand elle la
  heurte, alors elle rebondit, perd de la vitesse et reste pilotable.
- AE5. (couvre R7, R25) Étant donné la voiture en vol à vitesse maximale en ligne droite pendant
  5 minutes, quand elle avance, alors des bâtiments existent toujours devant elle, aucun vide ni écran
  de chargement n'apparaît et la mémoire utilisée reste stable.
- AE6. (couvre R8) Étant donné la graine « 42 », quand le jeu est relancé avec la même graine, alors
  la même ville apparaît au même endroit.
- AE7. (couvre R13) Étant donné un véhicule du trafic suivant son couloir, quand le joueur s'arrête
  sur sa trajectoire, alors le véhicule ralentit ou le contourne au lieu de le traverser.
- AE8. (couvre R14) Étant donné le joueur entrant dans un couloir dans le sens du flux, quand il suit
  le couloir, alors il circule parmi les véhicules sans collision forcée.
- AE9. (couvre R15) Étant donné l'heure qui passe de 17 h à 21 h, quand la nuit tombe, alors le ciel
  s'assombrit et les néons et fenêtres s'allument progressivement.
- AE10. (couvre R16) Étant donné un temps clair, quand la météo passe à la pluie, alors la pluie
  apparaît progressivement, les rues deviennent réfléchissantes et la visibilité lointaine diminue.
- AE11. (couvre R21) Étant donné le mode photo actif, quand le joueur enregistre, alors une image de la
  vue courante est téléchargée sans le HUD.
- AE12. (couvre R24) Étant donné la configuration de référence en qualité haute en 1080p, quand le
  joueur survole le centre de mégatours de nuit sous la pluie, alors la fréquence d'images moyenne reste
  d'au moins 60 images par seconde.

### Critères de succès
- Un nouveau joueur décolle, vole entre les tours et atterrit dans la première minute sans aide.
- Une capture d'écran prise en mode photo est jugée « crédible » (ambiance cyberpunk réaliste) par le
  porteur du projet.

### Hors périmètre
- Plus tard : piétons, intérieurs de bâtiments, monuments uniques placés à la main, missions/courses,
  plusieurs voitures au choix, sauvegarde de partie.
- Hors de l'identité du produit : version mobile/tactile, multijoueur, destruction des véhicules,
  marques et modèles réels.

### Dépendances et hypothèses
- Assets 3D et textures sous licence libre (CC0) ou modélisés pour le projet ; leurs sources et
  licences sont tracées dans le dépôt.
- Musique de la radio libre de droits ou générée pour le projet.
- Navigateurs desktop récents avec WebGL2 (Chrome, Edge, Firefox, Safari).

### Questions ouvertes

**À résoudre avant la planification**
- Aucune.

**Reportées à la planification**
- Configuration de référence pour R24 — résolu par KTD14.
- Durée d'un cycle jour/nuit complet — résolu par KTD9.
- Physique : moteur physique ou collisions arcade maison — résolu par KTD5.
- Hébergement et découpage en tranches — résolu par KTD15 et les tranches S1–S16.

<!-- kaizen:planning -->
## Contrat de planification

### Décisions techniques clés
- KTD1. **Pile : Vite 8 + TypeScript 7 + three 0.186 + postprocessing 6 (pmndrs), tests Vitest 5 et
  Playwright 1.64**, versions épinglées dans le lockfile. Raison : approche A choisie en séance ;
  `postprocessing` fusionne les effets en un minimum de passes (bloom, SMAA, vignette), ce qui préserve
  le budget de R24. Alternative rejetée : l'`EffectComposer` de three/addons, une passe par effet, plus
  coûteux. Couvre R17, R24.
- KTD2. **Boucle à pas fixe (60 Hz) séparée du rendu, sans bibliothèque ECS** : des systèmes simples
  (`city`, `vehicle`, `traffic`, `atmosphere`, `audio`, `camera`, `ui`) mis à jour dans un ordre fixe
  par `src/core/loop.ts`. Raison : la simulation est déterministe et testable sans navigateur, et le
  pilotage ne dépend pas de la fréquence d'images. Alternative rejetée : une ECS (bitecs…), une
  abstraction inutile pour une poignée de systèmes. Couvre R2–R5, R25.
- KTD3. **Ville par tronçons (chunks) de 256 m, générés par une fonction pure
  `generateChunk(seed, cx, cz)`**. Le PRNG (sfc32) est initialisé par un hachage de
  `(seed, cx, cz)` : un tronçon est identique quel que soit l'ordre de visite (R8). Le quartier vient
  d'un bruit simplex basse fréquence (`simplex-noise`). Les rues suivent une grille globale, donc
  continue d'un tronçon à l'autre. Les façades sont dessinées par shader (fenêtres procédurales sur
  les UV, émissif piloté par le facteur nuit) et non par une géométrie par fenêtre. Alternative
  rejetée : une génération par croissance de réseau routier, non locale et donc incompatible avec un
  streaming infini déterministe. Couvre R7–R11.
- KTD4. **Génération dans un Web Worker, envoi en tableaux typés transférables, budget de création par
  image et pool de tronçons réutilisés**. Un anneau de rayon réglable (par défaut 5 tronçons) est
  chargé autour du joueur, les tronçons au-delà de rayon + 1 sont libérés dans le pool. Au plus
  2 tronçons sont envoyés au GPU par image. Les tronçons lointains (> 3) utilisent un LOD simplifié
  (boîtes sans détails), et le brouillard masque le bord. Raison : R25 et AE5 interdisent les à-coups
  et la croissance mémoire. Alternative rejetée : une génération synchrone sur le thread principal,
  qui provoque des pics de 20 à 50 ms à grande vitesse. Couvre R7, R25.
- KTD5. **Physique arcade maison, sans moteur physique**. La voiture est une sphère englobante, les
  bâtiments des boîtes (AABB) indexées dans une table de hachage spatiale par tronçon, le sol un plan
  `y = 0`. La réponse est une réflexion de la vitesse avec restitution 0,3 et amortissement 50 %.
  Raison : R5 n'exige que des rebonds, et synchroniser des milliers de corps avec le streaming
  coûterait plus que ce que ça apporte. Alternative rejetée : Rapier (WASM), poids et synchronisation
  sans bénéfice pour de l'arcade. Couvre R5, R25 (résout la question reportée « Physique »).
- KTD6. **Voiture pilotée par une machine à états pure** `sol → décollage → vol → atterrissage → sol`.
  Au sol, un modèle bicyclette simplifié avec un facteur de glisse pour les dérapages. En vol,
  vol stationnaire avec poussée, lacet, et montée/descente par touches, vitesse amortie et altitude
  bornée à un plafond de 600 m. La transition dure 1,5 s. Raison : un état explicite rend AE1–AE3
  testables sans rendu. Couvre R2–R4.
- KTD7. **Couche d'entrée par actions** (`throttle`, `steer`, `lift`, `toggleFlight`, `camera`,
  `photo`…) alimentée par le clavier, la souris (Pointer Lock) et l'API Gamepad. Les associations
  sont stockées dans `localStorage`, avec des valeurs par défaut si le stockage est indisponible.
  Couvre R6, R23.
- KTD8. **Trafic : couloirs = courbes Catmull-Rom au-dessus des axes de rues, sur 4 paliers
  d'altitude (80, 150, 250, 400 m), sens alternés par palier** ; voies au sol sur la chaussée. Le
  suivi de véhicule utilise l'Intelligent Driver Model (IDM). Le joueur est injecté comme obstacle
  quand il est dans le corridor d'un couloir : les véhicules ralentissent, ou se décalent
  latéralement si le joueur reste immobile plus de 2 s. Rendu par `InstancedMesh` par type de
  véhicule ; trafic lointain en traînées lumineuses sur GPU pour la densité. Alternative rejetée : un
  trafic décoratif, écarté en séance. Couvre R11–R14.
- KTD9. **Un état d'environnement unique** (`timeOfDay` 0–24, `cloudiness`, `fogDensity`,
  `rainIntensity`, `wetness` avec retard) pilote les uniforms de tous les matériaux. Le cycle complet
  dure 24 minutes réelles par défaut, réglable (résout la question reportée « Durée du cycle »). La
  météo est une chaîne de Markov (clair ↔ brume ↔ pluie) avec des transitions interpolées sur 60 s.
  Ciel via `Sky` (three/addons) pour le jour, champ d'étoiles et couche nuageuse la nuit. Pluie :
  traînées instanciées dans un cylindre qui suit la caméra. Couvre R15, R16.
- KTD10. **Rendu réaliste dans le budget** : tonemapping AgX, sortie sRGB, matériaux
  `MeshStandardMaterial` avec un env map PMREM régénéré quand l'heure change de plus de 15 min,
  ombres en cascade (`CSM`, three/addons) pour le soleil ou la lune, brouillard de hauteur injecté
  dans les shaders, bloom sélectif par seuil de luminance. Les rues mouillées sont obtenues par une
  rugosité abaissée selon `wetness` et l'env map, plus des reflets de néons étirés dans le shader de
  la chaussée. Trois préréglages qualité (bas, moyen, haut) activent ou désactivent ombres, bloom,
  densité de pluie, rayon d'anneau et résolution interne. Alternative rejetée : des réflexions en
  espace écran (SSR), coûteuses et sans implémentation maintenue compatible avec three 0.186. Couvre
  R17, R23, R24.
- KTD11. **Audio Web Audio via `AudioListener` et `PositionalAudio`**. Le moteur et les propulseurs
  sont synthétisés (oscillateurs et bruit filtré, paramétrés par vitesse et mode), donc sans licence
  à gérer. Ambiance et pluie en boucles CC0 ; un pool de 8 sources positionnelles est affecté aux
  véhicules les plus proches. La radio lit des pistes libres listées dans
  `public/audio/radio/manifest.json` avec leur licence. L'audio démarre au premier geste du joueur
  (politique autoplay des navigateurs). Couvre R18, R19.
- KTD12. **Interface en DOM/CSS sans framework**, superposée au canvas. Minicarte sur canvas 2D à
  partir des empreintes de bâtiments renvoyées par le générateur. Le mode photo met la simulation en
  pause, libère une caméra orbitale et exporte via `canvas.toBlob` avec le HUD masqué. Alternative
  rejetée : React, une dépendance pour trois panneaux. Couvre R20–R23.
- KTD13. **Assets** : glTF compressés (meshopt), textures KTX2, tous listés avec source et licence
  dans `public/assets/CREDITS.md`. La voiture du joueur a un modèle procédural de repli construit
  en code, remplacé automatiquement par `public/models/roadster.glb` quand il est présent. Couvre R1,
  R10.
- KTD14. **Configuration de référence pour R24 : GPU de classe RTX 3060 / Radeon RX 6600, Chrome
  stable, 1080p** (défaut proposé au brainstorm, retenu). La performance est mesurée par un mode
  benchmark `?bench=1` : un vol scripté de 60 s au-dessus du centre de nuit sous la pluie, qui
  affiche la moyenne et le 1 % bas des images par seconde. Un navigateur headless de CI n'a pas de
  GPU représentatif. Couvre R24, R25.
- KTD15. **Déploiement statique sur GitHub Pages** par un workflow GitHub Actions sur la branche par
  défaut (résout la question reportée « Hébergement »). Couvre R24.

### Contexte et patterns à suivre
- Dépôt vide : aucun pattern existant. Les conventions sont posées par U1 et suivies ensuite :
  `src/<système>/` par domaine, logique pure séparée du rendu (`*.ts` purs testés par Vitest,
  `*Render.ts` ou `*Mesh.ts` pour three).
- `three/examples/jsm` (addons `Sky`, `CSM`, `GLTFLoader`, `KTX2Loader`) importés via
  `three/addons/...`.

### Learnings et règles appliqués
- Aucun learning (`docs/learnings/` absent), aucun Kaizen Pack déclaré, pas de `CONSTITUTION.md` :
  constat vérifié par `kaizen.mjs learnings`, `packs --json` et `constitution --json`.

### Conception technique

```
                 ┌──────────── loop.ts (pas fixe 60 Hz + rendu rAF) ────────────┐
 input ─► actions ─► vehicle (machine à états) ─► collide (hachage spatial) ─────┤
                                     │                                          │
 seed ─► generator (Worker) ─► streamer (anneau, pool) ─► city meshes ─────────┤──► pipeline
                     └──► lanes ─► traffic sim (IDM, joueur=obstacle) ─► instances (postprocessing)
 environment (heure, météo) ──► uniforms matériaux / ciel / pluie / audio ───────┘
```

### Risques et dépendances
- **Budget GPU (R24)** : la ville dense, la pluie, le bloom et les ombres cumulés peuvent dépasser
  16 ms → préréglages qualité (KTD10) et mode benchmark (KTD14) dès U23 ; on mesure au fil des tranches.
- **Modèle de voiture glTF** : à modéliser ou à trouver sous CC0 ; le modèle procédural de repli
  (KTD13) évite que ça bloque la livraison.
- **Pistes de radio libres** : à sélectionner (CC0/CC-BY) ; une radio vide affiche « aucune piste »
  plutôt qu'une erreur.
- **Ordre de livraison** : le noyau jouable (rouler et voler dans une ville de nuit fixe) existe à la
  fin de S7 ; jusqu'à S11, l'éclairage est un préréglage « nuit » statique.

<!-- kaizen:threats -->
## Menaces

- **Altération** · paramètre d'URL `?seed=` · valeur non numérique ou démesurée → analyse stricte en
  entier 32 bits non signé, sinon graine par défaut (U2).
- **Déni de service local** · réglages dans `localStorage` corrompus (rayon d'anneau énorme) →
  validation et bornage de chaque réglage au chargement (U21).
- **Chaîne d'approvisionnement** · dépendances npm · lockfile commité, `npm ci` en CI, Dependabot
  activé (U1).

<!-- kaizen:rollout -->
## Déploiement et retour arrière

- **Exposition** : directe, site statique public sur GitHub Pages, sans feature flag ; chaque tranche
  fusionnée est déployée.
- **Ordre** : aucune migration ni donnée serveur ; une tranche laisse toujours la page jouable.
- **Rollback** : revert du commit fautif sur la branche par défaut, qui redéploie la version
  précédente ; rien d'irréversible, hormis les réglages locaux des joueurs, validés au chargement
  (U21).
- **Signal** : le smoke test Playwright (`npm run e2e`) qui charge la page et vérifie le rendu
  d'images ; seuil : > 0 échec du smoke test après déploiement → revert. Aucun signal n'est déclaré dans `monitor.signals`
  (pas de supervision de production pour un site statique), à ajouter seulement si une télémétrie
  est introduite.

<!-- kaizen:units -->
## Unités d'implémentation

### U1. Socle du projet et boucle de jeu
- **Goal:** page Vite qui affiche une scène three avec redimensionnement, boucle à pas fixe, CI.
- **Covers:** R24
- **Depends on:** —
- **Files:** `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`,
  `src/main.ts`, `src/core/loop.ts`, `src/core/loop.test.ts`, `.github/workflows/ci.yml`,
  `.github/dependabot.yml`, `.kaizen/config.json`, `.gitignore`, `README.md` (tous nouveaux)
- **Approach:** accumulateur de pas fixe (KTD2) avec plafond de rattrapage (max 5 pas par image) ;
  `.kaizen/config.json` déclare `verify` (typecheck, test, build) et la langue `fr`.
- **Evidence:** test first (accumulateur).
- **Test scenarios:** 16,7 ms → 1 pas ; 100 ms → 5 pas plafonnés ; interpolation alpha dans [0, 1[.
- **Verification:** `npm run typecheck && npm test && npm run build`
- **Slice:** S1

### U2. Aléatoire à graine
- **Goal:** PRNG déterministe et hachage de coordonnées ; lecture de `?seed=`.
- **Covers:** R8
- **Depends on:** U1
- **Files:** `src/core/random.ts`, `src/core/random.test.ts`, `src/core/seed.ts`,
  `src/core/seed.test.ts` (nouveaux)
- **Approach:** sfc32 + hachage entier `(seed, cx, cz)` (KTD3) ; analyse stricte de la graine
  (Menaces).
- **Evidence:** test first.
- **Test scenarios:** même graine → même suite ; coordonnées voisines → suites décorrélées ;
  `?seed=abc` ou `?seed=1e99` → graine par défaut.
- **Verification:** `npm test -- src/core`
- **Slice:** S1

### U3. Générateur de tronçon (pur)
- **Goal:** `generateChunk(seed, cx, cz)` → quartier, rues, îlots, descripteurs de bâtiments et
  d'enseignes, empreintes pour la minicarte.
- **Covers:** R7, R8, R9, R11, AE6
- **Depends on:** U2
- **Files:** `src/city/generator.ts`, `src/city/districts.ts`, `src/city/generator.test.ts` (nouveaux)
- **Approach:** grille de rues globale ; quartier par bruit simplex ; hauteurs et silhouettes
  (retraits, tours effilées) selon le quartier ; descripteurs de passerelles entre tours voisines
  (KTD3).
- **Evidence:** test first.
- **Test scenarios:** AE6 (graine 42, résultat identique entre deux appels et quel que soit l'ordre
  des tronçons) ; rues continues à la frontière de deux tronçons ; les 4 quartiers apparaissent sur
  une zone de 40 × 40 tronçons ; aucun bâtiment sur une chaussée.
- **Verification:** `npm test -- src/city/generator`
- **Slice:** S2

### U4. Streaming des tronçons (Worker, anneau, pool)
- **Goal:** charger et libérer les tronçons autour du joueur sans à-coups ni croissance mémoire.
- **Covers:** R7, R25, AE5
- **Depends on:** U3
- **Files:** `src/city/streamer.ts`, `src/city/streamer.test.ts`, `src/city/chunk.worker.ts`,
  `src/city/pool.ts` (nouveaux)
- **Approach:** KTD4 ; ordonnancement par distance puis par direction de déplacement ; le streamer
  est testé avec un générateur synchrone injecté.
- **Evidence:** test first.
- **Test scenarios:** déplacement rectiligne de 200 tronçons → nombre de tronçons actifs et taille du
  pool bornés (AE5, partie logique) ; au plus 2 tronçons montés par image ; demi-tour → tronçons
  réutilisés ; LOD appliqué au-delà de 3 tronçons.
- **Verification:** `npm test -- src/city/streamer`
- **Slice:** S3

### U5. Maillages de bâtiments, rues et shader de façade
- **Goal:** rendre les tronçons : bâtiments fusionnés, fenêtres procédurales, chaussées marquées.
- **Covers:** R9, R10, R17
- **Depends on:** U4
- **Files:** `src/city/buildingMesh.ts`, `src/city/roadMesh.ts`, `src/render/materials/facade.ts`,
  `src/render/materials/road.ts`, `src/render/materials/facade.test.ts` (nouveaux)
- **Approach:** une géométrie fusionnée par tronçon et par matériau ; uniforms partagés `nightFactor`
  et `wetness` (préparés pour KTD9) ; palette de façade par quartier.
- **Evidence:** test first pour la construction des attributs (nombre de sommets, UV) ;
  vérification visuelle pour le rendu.
- **Test scenarios:** un descripteur de bâtiment produit le bon nombre de faces ; les UV de façade
  respectent la taille d'étage ; les quartiers ont des palettes distinctes.
- **Verification:** `npm test -- src/render src/city/buildingMesh` + vérification visuelle `npm run dev`
- **Slice:** S4

### U6. Habillage cyberpunk
- **Goal:** enseignes néon, hologrammes et écrans animés, passerelles, vapeur au sol.
- **Covers:** R10, R11
- **Depends on:** U5
- **Files:** `src/city/signage.ts`, `src/render/materials/hologram.ts`, `src/city/steam.ts`,
  `src/city/signage.test.ts`, `public/assets/signs/atlas.ktx2`, `public/assets/CREDITS.md` (nouveaux)
- **Approach:** enseignes en `InstancedMesh` avec atlas animé par décalage d'UV ; hologrammes en
  additif avec scintillement ; passerelles issues des descripteurs du générateur.
- **Evidence:** test first pour le placement (enseignes sur façades, sans chevauchement) ;
  vérification visuelle.
- **Test scenarios:** chaque enseigne est collée à une façade ; densité d'enseignes plus forte dans le
  quartier néon.
- **Verification:** `npm test -- src/city/signage` + vérification visuelle
- **Slice:** S5

### U7. Couche d'entrée
- **Goal:** actions unifiées clavier/souris/manette, associations reconfigurables et persistées.
- **Covers:** R6
- **Depends on:** U1
- **Files:** `src/input/actions.ts`, `src/input/keyboard.ts`, `src/input/gamepad.ts`,
  `src/input/bindings.ts`, `src/input/bindings.test.ts` (nouveaux)
- **Approach:** KTD7 ; zone morte de la manette 0,15.
- **Evidence:** test first.
- **Test scenarios:** une touche réassignée déclenche la nouvelle action ; `localStorage` indisponible
  → associations par défaut ; JSON corrompu → associations par défaut ; zone morte appliquée.
- **Verification:** `npm test -- src/input`
- **Slice:** S6

### U8. Contrôleur de la voiture (pur)
- **Goal:** machine à états sol/vol et dynamiques arcade.
- **Covers:** R2, R3, R4, AE1, AE2, AE3
- **Depends on:** U7
- **Files:** `src/vehicle/controller.ts`, `src/vehicle/controller.test.ts` (nouveaux)
- **Approach:** KTD6 ; paramètres réunis dans `src/vehicle/tuning.ts` pour le réglage du ressenti.
- **Evidence:** test first.
- **Test scenarios:** AE1 (à l'arrêt, `toggleFlight` → état « vol » en ≤ 2 s simulées) ; AE2
  (atterrissage → altitude 0, état « sol ») ; AE3 (plafond 600 m tenu) ; dérapage en virage serré
  au-delà d'une vitesse seuil ; aucune poussée verticale au sol.
- **Verification:** `npm test -- src/vehicle`
- **Slice:** S6

### U9. Collisions arcade
- **Goal:** rebonds sur bâtiments, sol et véhicules.
- **Covers:** R5, AE2, AE4
- **Depends on:** U4, U8
- **Files:** `src/physics/spatialHash.ts`, `src/physics/collide.ts`, `src/physics/collide.test.ts`
  (nouveaux)
- **Approach:** KTD5 ; sous-pas si le déplacement dépasse le rayon de la sphère (pas de traversée à
  pleine vitesse) ; collision sphère-sphère générique, branchée sur les véhicules du trafic par U13.
- **Evidence:** test first.
- **Test scenarios:** AE4 (pleine vitesse contre une façade → rebond, vitesse réduite, voiture
  hors du mur) ; vitesse maximale → aucune traversée ; AE2 (pas de passage sous le sol) ; contact
  avec un véhicule → séparation.
- **Verification:** `npm test -- src/physics`
- **Slice:** S7

### U10. Modèle visuel de la voiture
- **Goal:** voiture au style roadster (originale), animation des propulseurs, phares et feux.
- **Covers:** R1, R3
- **Depends on:** U8
- **Files:** `src/vehicle/carModel.ts`, `src/vehicle/proceduralCar.ts`, `src/vehicle/carModel.test.ts`
  (nouveaux)
- **Approach:** KTD13 ; le déploiement des propulseurs suit la progression de la transition
  exposée par le contrôleur.
- **Evidence:** test first pour la logique de repli (glb absent → modèle procédural) et pour la
  correspondance progression ↔ angle des propulseurs ; vérification visuelle.
- **Test scenarios:** `roadster.glb` absent → modèle procédural sans erreur ; progression 0 → 1
  déploie entièrement les propulseurs.
- **Verification:** `npm test -- src/vehicle/carModel` + vérification visuelle
- **Slice:** S7

### U11. Caméras
- **Goal:** vue poursuite (ressort amorti), cockpit, caméra cinématique.
- **Covers:** R20
- **Depends on:** U10
- **Files:** `src/camera/chase.ts`, `src/camera/cockpit.ts`, `src/camera/cinematic.ts`,
  `src/camera/rig.ts`, `src/camera/rig.test.ts` (nouveaux)
- **Approach:** le rig cycle entre les caméras via l'action `camera` ; la caméra poursuite évite de
  passer à travers les bâtiments en reprenant le hachage spatial de U9.
- **Evidence:** test first.
- **Test scenarios:** cycle poursuite → cockpit → cinématique → poursuite ; caméra poursuite tirée
  devant un mur quand un bâtiment est entre elle et la voiture.
- **Verification:** `npm test -- src/camera`
- **Slice:** S8

### U12. Réseau de couloirs et voies (pur)
- **Goal:** couloirs aériens par paliers et voies au sol, balises.
- **Covers:** R11, R12
- **Depends on:** U3
- **Files:** `src/traffic/lanes.ts`, `src/traffic/lanes.test.ts` (nouveaux)
- **Approach:** KTD8 ; couloirs dérivés des axes de rues du générateur, donc déterministes et
  continus entre tronçons.
- **Evidence:** test first.
- **Test scenarios:** 4 paliers présents ; couloirs continus à la frontière de deux tronçons ; aucun
  couloir à travers un bâtiment de son palier ; balises espacées régulièrement.
- **Verification:** `npm test -- src/traffic/lanes`
- **Slice:** S9

### U13. Simulation du trafic (pure)
- **Goal:** véhicules sur couloirs et voies, suivi IDM, réaction au joueur, insertion du joueur.
- **Covers:** R11, R13, R14, AE7, AE8
- **Depends on:** U9, U12
- **Files:** `src/traffic/sim.ts`, `src/traffic/sim.test.ts` (nouveaux)
- **Approach:** KTD8 ; véhicules réaffectés aux tronçons chargés (pool fixe par qualité) ; les
  véhicules sont enregistrés dans le hachage spatial de U9 pour les collisions avec le joueur (R5).
- **Evidence:** test first.
- **Test scenarios:** AE7 (joueur immobile sur un couloir → le suiveur ralentit sans le traverser,
  puis se décale après 2 s) ; AE8 (joueur dans le sens du flux à vitesse du flux → aucune collision
  forcée) ; joueur percutant un véhicule → séparation et rebond ; aucune collision entre véhicules de la simulation sur 10 minutes simulées.
- **Verification:** `npm test -- src/traffic/sim`
- **Slice:** S9

### U14. Rendu du trafic
- **Goal:** véhicules instanciés avec feux, balises de couloirs, traînées lumineuses lointaines.
- **Covers:** R11, R12
- **Depends on:** U13
- **Files:** `src/traffic/trafficRender.ts`, `src/traffic/streaks.ts`, `src/traffic/trafficRender.test.ts`,
  `public/models/traffic/*.glb` (nouveaux)
- **Approach:** un `InstancedMesh` par type de véhicule (3 types au minimum) ; matrices d'instance
  écrites depuis la simulation.
- **Evidence:** test first pour l'écriture des matrices d'instance ; vérification visuelle.
- **Test scenarios:** N véhicules simulés → N instances visibles ; véhicule libéré → instance masquée.
- **Verification:** `npm test -- src/traffic/trafficRender` + vérification visuelle
- **Slice:** S10

### U15. Cycle jour/nuit
- **Goal:** heure qui avance, position du soleil et de la lune, ciel, lumières, facteur nuit.
- **Covers:** R15, AE9
- **Depends on:** U5
- **Files:** `src/atmosphere/environment.ts`, `src/atmosphere/time.ts`, `src/atmosphere/sky.ts`,
  `src/atmosphere/time.test.ts` (nouveaux)
- **Approach:** KTD9 ; le facteur nuit allume néons et fenêtres avec un décalage aléatoire par
  bâtiment.
- **Evidence:** test first.
- **Test scenarios:** AE9 (17 h → 21 h : facteur nuit croissant, part de fenêtres allumées
  croissante) ; 24 minutes réelles = 24 h de jeu par défaut ; boucle minuit sans saut.
- **Verification:** `npm test -- src/atmosphere/time`
- **Slice:** S11

### U16. Météo dynamique et pluie
- **Goal:** clair, brume et pluie avec transitions ; pluie visible ; surfaces mouillées.
- **Covers:** R11, R16, AE10
- **Depends on:** U15
- **Files:** `src/atmosphere/weather.ts`, `src/atmosphere/weather.test.ts`, `src/atmosphere/rain.ts`
  (nouveaux)
- **Approach:** KTD9 ; `wetness` suit `rainIntensity` avec un retard (sèche en 3 min).
- **Evidence:** test first.
- **Test scenarios:** AE10 (clair → pluie : intensité progressive sur 60 s, `wetness` et
  `fogDensity` croissants) ; le passage clair → pluie est toujours interpolé, jamais instantané ; météo forcée
  depuis les réglages.
- **Verification:** `npm test -- src/atmosphere/weather`
- **Slice:** S12

### U17. Pipeline de rendu et préréglages qualité
- **Goal:** tonemapping, env map, ombres CSM, brouillard de hauteur, bloom, SMAA ; préréglages.
- **Covers:** R17, R23, R24
- **Depends on:** U15
- **Files:** `src/render/pipeline.ts`, `src/render/fog.ts`, `src/settings/quality.ts`,
  `src/settings/quality.test.ts` (nouveaux)
- **Approach:** KTD10.
- **Evidence:** test first pour les préréglages (valeurs et bornes) ; vérification visuelle.
- **Test scenarios:** « bas » désactive les ombres et réduit l'anneau ; « haut » active tout ;
  résolution interne bornée.
- **Verification:** `npm test -- src/settings` + vérification visuelle
- **Slice:** S13

### U18. Audio spatialisé
- **Goal:** moteur synthétisé, ambiance, pluie, passages de véhicules.
- **Covers:** R18
- **Depends on:** U13, U16
- **Files:** `src/audio/engine.ts`, `src/audio/ambience.ts`, `src/audio/trafficVoices.ts`,
  `src/audio/trafficVoices.test.ts`, `public/audio/ambience/*.ogg` (nouveaux)
- **Approach:** KTD11 ; démarrage au premier geste.
- **Evidence:** test first pour l'affectation des 8 voix aux véhicules les plus proches et pour la
  table vitesse/mode → paramètres moteur ; écoute manuelle.
- **Test scenarios:** 20 véhicules → les 8 plus proches ont une voix ; véhicule qui s'éloigne →
  voix réaffectée ; mode vol → timbre propulseurs.
- **Verification:** `npm test -- src/audio`
- **Slice:** S14

### U19. Radio de bord
- **Goal:** lecture de pistes synthwave, piste suivante/précédente, coupure.
- **Covers:** R19
- **Depends on:** U18
- **Files:** `src/audio/radio.ts`, `src/audio/radio.test.ts`, `public/audio/radio/manifest.json`
  (nouveaux)
- **Approach:** KTD11 ; manifeste avec titre, auteur, licence.
- **Evidence:** test first.
- **Test scenarios:** suivante en fin de liste → première piste ; manifeste vide → état « aucune
  piste » sans erreur ; coupure conserve la position.
- **Verification:** `npm test -- src/audio/radio`
- **Slice:** S14

### U20. HUD et minicarte
- **Goal:** vitesse, altitude, mode, heure, météo, minicarte ; masquable.
- **Covers:** R22
- **Depends on:** U8, U16
- **Files:** `src/ui/hud.ts`, `src/ui/minimap.ts`, `src/ui/hud.css`, `src/ui/minimap.test.ts`
  (nouveaux)
- **Approach:** KTD12 ; minicarte redessinée à 10 Hz au plus.
- **Evidence:** test first pour la projection monde → minicarte ; vérification visuelle.
- **Test scenarios:** le joueur est au centre, orienté selon son cap ; empreintes des tronçons
  chargés dessinées.
- **Verification:** `npm test -- src/ui`
- **Slice:** S15

### U21. Menu de réglages
- **Goal:** préréglages qualité, heure et météo (auto ou forcées), configuration des touches.
- **Covers:** R6, R23
- **Depends on:** U7, U16, U17, U20
- **Files:** `src/ui/settingsMenu.ts`, `src/settings/store.ts`, `src/settings/store.test.ts`
  (nouveaux)
- **Approach:** KTD12 ; validation et bornage au chargement (Menaces).
- **Evidence:** test first.
- **Test scenarios:** réglage valide persisté et relu ; valeur hors bornes → bornée ; JSON corrompu
  → valeurs par défaut.
- **Verification:** `npm test -- src/settings`
- **Slice:** S15

### U22. Mode photo
- **Goal:** figer le monde, caméra libre, capture sans HUD.
- **Covers:** R21, AE11
- **Depends on:** U11, U20
- **Files:** `src/camera/photoMode.ts`, `src/camera/photoMode.test.ts`, `e2e/photo.spec.ts`
  (nouveaux)
- **Approach:** KTD12 ; capture lue juste après un rendu dédié, HUD masqué (pas de
  `preserveDrawingBuffer` permanent, coûteux).
- **Evidence:** test first (pause de la simulation) + test navigateur pour AE11.
- **Test scenarios:** simulation figée en mode photo ; AE11 (capture → téléchargement PNG,
  HUD masqué pendant la capture puis restauré).
- **Verification:** `npm test -- src/camera/photoMode && npm run e2e -- photo`
- **Slice:** S16

### U23. Benchmark, smoke test et déploiement
- **Goal:** mode `?bench=1`, smoke test Playwright, déploiement GitHub Pages.
- **Covers:** R24, R25, AE5, AE12
- **Depends on:** U17
- **Files:** `src/core/bench.ts`, `e2e/smoke.spec.ts`, `e2e/streaming.spec.ts`, `playwright.config.ts`,
  `.github/workflows/pages.yml` (nouveaux), `.github/workflows/ci.yml`
- **Approach:** KTD14, KTD15 ; Playwright utilise le Chromium installé (`executablePath` si besoin),
  la CI installe Chromium via `npx playwright install --with-deps chromium` ; un objet de
  diagnostic `window.__debug` (tronçons actifs, taille du pool, fps) n'est exposé qu'avec `?debug=1`.
- **Evidence:** test navigateur ; mesure manuelle sur la configuration de référence pour AE12.
- **Test scenarios:** la page se charge et produit des images sans erreur console ; AE5 (vol
  scripté de 5 min accéléré : nombre de tronçons actifs et taille du pool stables via
  `window.__debug`, aucun vide devant la voiture) ; AE12 (benchmark ≥ 60 fps de moyenne sur la configuration de référence, relevé consigné
  dans la PR).
- **Verification:** `npm run e2e` + relevé `?bench=1` sur la configuration de référence
- **Slice:** S16

<!-- kaizen:verification -->
## Contrat de vérification
- Commandes du dépôt (posées par U1, déclarées dans `.kaizen/config.json`) : `npm run typecheck`
  (`tsc --noEmit`), `npm test` (`vitest run`), `npm run build` (`vite build`), `npm run e2e`
  (`playwright test`).
- Ciblées par unité : la ligne **Verification** de chaque unité.
- AE1–AE4, AE6–AE10 : tests Vitest des unités U3, U8, U9, U13, U15, U16.
- AE5 : test logique U4 + test navigateur `e2e/streaming.spec.ts` (U23).
- AE11 : `e2e/photo.spec.ts` (U22).
- AE12 : relevé du mode benchmark sur la configuration de référence (KTD14), consigné dans la PR de
  S16 et refait quand une tranche touche au rendu.
- Vérification visuelle (`npm run dev`) pour U5, U6, U10, U14, U17 : capture jointe à la PR.

<!-- kaizen:done -->
## Définition de terminé
- U1–U23 livrées, chacune avec sa preuve, en 16 tranches de moins de 400 lignes relisibles
  (`node "$K" size`).
- R1–R25 et AE1–AE12 couverts par des tests verts ou par le relevé consigné (AE12).
- `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e` verts en CI.
- `/kaizen:review` sans P0/P1 ouvert pour chaque tranche.
- `public/assets/CREDITS.md` liste la source et la licence de chaque asset.
- Learning capturé si l'implémentation révèle un piège non documenté (budget GPU, streaming).
