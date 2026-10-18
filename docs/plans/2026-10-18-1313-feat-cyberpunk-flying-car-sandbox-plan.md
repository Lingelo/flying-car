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
- Configuration de référence pour R24 — proposition par défaut : GPU de classe RTX 3060 / Radeon
  RX 6600, Chrome stable, 1080p.
- Durée d'un cycle jour/nuit complet — proposition par défaut : 24 minutes réelles, réglable.
- Physique : moteur physique ou collisions arcade maison — à trancher selon R5 et R25.
- Hébergement de la démo (GitHub Pages ou autre) et découpage en tranches livrables (le noyau
  « rouler/voler dans une ville de nuit » d'abord).
