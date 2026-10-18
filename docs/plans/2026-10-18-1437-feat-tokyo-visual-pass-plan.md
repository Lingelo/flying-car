---
title: Passe visuelle Tokyo cyberpunk - Plan
type: feat
date: 2026-10-18
topic: tokyo-visual-pass
artifact: kaizen-plan/v1
source: plan
origin: docs/plans/2026-10-18-1313-feat-cyberpunk-flying-car-sandbox-plan.md
---

# Passe visuelle Tokyo cyberpunk - Plan

<!-- kaizen:goal -->
## Capsule d'objectif

**Objectif :** la ville du bac à sable se lit immédiatement comme un Tokyo cyberpunk — enseignes en
japonais, écrans géants, carrefours en diagonale, métro aérien, ruelles à lanternes, tours-repères —
avec un rendu plus riche : occlusion ambiante et vrais reflets sur les rues mouillées.
**Moyens :** sur la base existante (Three.js WebGL2, postprocessing) ; N8AO pour l'occlusion.
**Autorité produit :** Angélo LIMA, en séance le 2026-10-18 (« reflets, occlusion, rendu très cool,
Tokyo cyberpunk » ; les quatre familles d'éléments retenues).
**Bloqueurs ouverts :** aucun.

<!-- kaizen:product -->
## Contrat produit

### Résumé
Une passe d'identité visuelle et de rendu sur la ville existante, sans changer le pilotage ni le
périmètre du bac à sable.

### Exigences

**Rendu**
- R1. Une occlusion ambiante assombrit les recoins (pieds de tours, dessous de passerelles et de
  viaduc, sous la voiture) en qualité moyenne et haute.
- R2. Par temps mouillé, les rues reflètent réellement la scène (néons, enseignes, véhicules, tours)
  en qualité haute ; les flaques sont nettes, l'asphalte mouillé flou ; la qualité basse garde les
  traînées simulées.

**Enseignes de Tokyo**
- R3. Les enseignes portent de vrais mots japonais (kanji, kana) lisibles, en colonnes verticales et
  en bandeaux, avec des styles néon sur fond sombre et panneaux éclairés.
- R4. Les enseignes verticales s'empilent sur les angles des immeubles des quartiers néon et centre.
- R5. Des écrans géants animés façon Shibuya habillent les angles des grands carrefours.

**Rues**
- R6. Les carrefours de deux avenues dans les quartiers néon et centre ont un passage piéton en
  diagonale (scramble).
- R7. Des lignes de métro aérien sur viaduc longent certaines avenues, avec des rames éclairées qui
  circulent ; le viaduc est solide pour la voiture, et la voiture comme le trafic passent dessous.
- R8. Les quartiers néon ont des ruelles étroites, des lanternes rouges, des câbles électriques
  au-dessus des rues et des distributeurs lumineux.

**Silhouette**
- R9. Des tours-repères façon Tokyo Tower (treillis rouge et blanc, éclairé la nuit) se dressent à
  intervalles réguliers et se voient de loin, au-delà de la zone chargée.
- R10. Des temples (toits courbes, torii rouges) occupent parfois un îlot entre les tours.

**Contraintes**
- R11. Tout reste déterministe par graine ; l'objectif de performance du plan d'origine (R24, R25)
  tient en qualité haute ; chaque effet coûteux a son réglage par qualité.

### Décisions clés
- **Éléments retenus** — enseignes japonaises, carrefour et métro aérien, silhouette, ruelles et
  lanternes. Gouverne R3–R10. (décidé en séance : les quatre familles proposées)
- **Reflets et occlusion** — demandés explicitement. Gouverne R1, R2. (décidé en séance)

### Exemples d'acceptation
- AE1. (couvre R2) Étant donné la pluie, la nuit, en qualité haute, quand la caméra regarde la rue,
  alors les enseignes et les véhicules apparaissent inversés dans la chaussée ; en qualité basse,
  aucun rendu de reflet n'a lieu.
- AE2. (couvre R3) Étant donné une enseigne verticale, quand elle est rendue, alors elle affiche un
  mot japonais de la liste, pas des pseudo-glyphes, y compris sans police japonaise installée.
- AE3. (couvre R6) Étant donné le carrefour de deux avenues du quartier néon, quand on le survole,
  alors des bandes piétonnes en diagonale le traversent.
- AE4. (couvre R7) Étant donné une ligne de métro aérien, quand la voiture roule dessous, alors elle
  passe sans collision ; quand elle vole dans le viaduc, alors elle rebondit.
- AE5. (couvre R9) Étant donné le joueur à 2 km d'une tour-repère, quand il regarde vers elle, alors
  elle est visible bien que son tronçon ne soit pas chargé.
- AE6. (couvre R11) Étant donné la même graine, quand on relance, alors viaducs, temples, repères,
  lanternes et enseignes sont identiques.

### Hors périmètre
- Plus tard : piétons, sons de métro et de passage à niveau, intérieurs de ruelles.

<!-- kaizen:planning -->
## Contrat de planification

### Décisions techniques clés
- KTD1. **Occlusion N8AO** (`n8ao`, MIT) en passe postprocessing, qualité moyenne (demi-résolution)
  et haute. Alternative rejetée : `SSAOEffect` + `NormalPass` de postprocessing, plus bruité et une
  passe de normales en plus. Couvre R1.
- KTD2. **Reflet plan à y = 0** : la scène est rendue depuis une caméra miroir (construite par
  `lookAt` comme `Reflector` de three) dans une cible demi-résolution avec mipmaps ; route, sol et
  eau l'échantillonnent en coordonnées projectives, niveau de mip selon la rugosité (net dans les
  flaques), déformé par les ondulations, pondéré par l'humidité et un Fresnel. Les faces du sol sont
  invisibles depuis dessous (culling), donc pas de plan de découpe. Rendu sauté si sec ou qualité
  < haute. Alternative rejetée : SSR, sans implémentation maintenue pour three 0.186. Couvre R2.
- KTD3. **Atlas d'enseignes généré au lancement** sur un canvas 2D avec Noto Sans JP
  (`@fontsource/noto-sans-jp`, OFL, chargé par plages unicode), attendu via `document.fonts.load`.
  Le shader d'enseigne choisit une cellule par graine ; styles néon / panneau éclairé. Couvre R3,
  R5.
- KTD4. **Viaducs** : lignes de métro le long des avenues d'axe x dont l'indice de ligne vérifie un
  hachage de la graine (une sur trois) ; tablier à 12–14 m et piles sur le terre-plein central toutes
  les 32 m (entre les voies au sol) ; boîtes de collision ajoutées à celles du tronçon. Rames
  instanciées dont la position est une fonction périodique du temps (pas de simulation). Couvre R7.
- KTD5. **Repères hors streaming** : une tour par super-cellule de 8 × 8 tronçons (tronçon choisi
  par hachage), gérées par un module à part qui garde celles à moins de 4 km ; le générateur laisse
  libre l'îlot central de ce tronçon. Couvre R9.
- KTD6. **Habillage dans le Worker** : ruelles (écart de parcelles élargi dans le quartier néon),
  lanternes, câbles, distributeurs, temples et piles empilées d'enseignes sont produits par des
  fonctions pures `(chunk, seed)` et leurs géométries construites dans le Worker, comme les
  enseignes existantes. Couvre R4, R8, R10, R11.

### Contexte et patterns à suivre
- `src/city/signage.ts` (placement pur + géométrie), `src/city/payload.ts` (transferts Worker),
  `src/render/materials/hologram.ts` (ShaderMaterial avec brouillard), `src/render/pipeline.ts`.

### Learnings et règles appliqués
- Aucun learning écrit à ce jour ; pièges connus de cette base appliqués : mots réservés GLSL
  (`half`, `layout`…), billboards en `DoubleSide`, capture canvas synchrone.

<!-- kaizen:rollout -->
## Déploiement et retour arrière

- **Exposition** : directe sur GitHub Pages après CI verte ; les effets coûteux suivent la qualité.
- **Rollback** : revert du commit ; rien d'irréversible (aucune donnée).
- **Signal** : smoke test Playwright après déploiement ; seuil : > 0 échec → revert.

<!-- kaizen:units -->
## Unités d'implémentation

### U1. Occlusion ambiante
- **Goal:** N8AO dans le pipeline selon la qualité.
- **Covers:** R1, R11
- **Depends on:** —
- **Files:** `src/render/pipeline.ts`, `src/settings/quality.ts`, `src/settings/quality.test.ts`, `package.json`
- **Approach:** KTD1.
- **Evidence:** test first (préréglages : ao absent en basse, demi-résolution en moyenne).
- **Test scenarios:** basse sans AO ; moyenne en demi-résolution ; haute en pleine résolution.
- **Verification:** `npm test -- src/settings` + vérification visuelle
- **Slice:** S1

### U2. Reflets plans
- **Goal:** vrais reflets sur rues, trottoirs et canaux mouillés.
- **Covers:** R2, AE1, R11
- **Depends on:** U1
- **Files:** `src/render/reflection.ts`, `src/render/reflection.test.ts`, `src/render/materials/road.ts`, `src/render/materials/cityUniforms.ts`, `src/main.ts`
- **Approach:** KTD2.
- **Evidence:** test first (caméra miroir : position et visée réfléchies ; rendu sauté si sec ou
  qualité basse) ; vérification visuelle pour AE1.
- **Test scenarios:** caméra à (x, h, z) visant un point → miroir à (x, −h, z) visant le point
  réfléchi ; humidité 0 → pas de rendu ; qualité basse → pas de rendu.
- **Verification:** `npm test -- src/render` + capture pluie de nuit
- **Slice:** S1

### U3. Atlas d'enseignes japonaises
- **Goal:** vrais mots japonais sur les enseignes et écrans.
- **Covers:** R3, R5, AE2
- **Depends on:** —
- **Files:** `src/render/signAtlas.ts`, `src/render/signAtlas.test.ts`, `src/render/materials/hologram.ts`, `public/assets/CREDITS.md`, `package.json`
- **Approach:** KTD3.
- **Evidence:** test first pour la disposition de l'atlas (cellules, mots, sans chevauchement) ;
  test navigateur pour AE2 (police chargée).
- **Test scenarios:** chaque mot a une cellule ; cellules dans l'atlas ; mot choisi par graine
  déterministe.
- **Verification:** `npm test -- src/render/signAtlas` + `npm run e2e -- tokyo`
- **Slice:** S2

### U4. Piles d'enseignes et écrans géants
- **Goal:** colonnes d'enseignes aux angles, écrans géants aux carrefours.
- **Covers:** R4, R5, R11
- **Depends on:** U3
- **Files:** `src/city/signage.ts`, `src/city/signage.test.ts`
- **Approach:** KTD6.
- **Evidence:** test first.
- **Test scenarios:** piles sur les angles, sans chevauchement ; écrans seulement aux angles de
  carrefours d'avenues dans néon et centre ; déterminisme.
- **Verification:** `npm test -- src/city/signage`
- **Slice:** S2

### U5. Carrefours scramble
- **Goal:** passages piétons en diagonale aux carrefours d'avenues.
- **Covers:** R6, AE3
- **Depends on:** —
- **Files:** `src/city/roadMesh.ts`, `src/city/buildingMesh.test.ts`, `src/render/materials/road.ts`
- **Approach:** drapeau `scramble` dans l'info du quad de carrefour ; diagonales en shader.
- **Evidence:** test first (drapeau posé seulement sur avenue × avenue en néon/centre).
- **Test scenarios:** carrefour avenue × avenue en néon → scramble ; rue × rue → non ; quartier
  industriel → non.
- **Verification:** `npm test -- src/city`
- **Slice:** S3

### U6. Métro aérien
- **Goal:** viaducs, piles, collisions et rames.
- **Covers:** R7, AE4, R11
- **Depends on:** —
- **Files:** `src/city/rail.ts`, `src/city/rail.test.ts`, `src/city/trains.ts`, `src/city/payload.ts`, `src/city/cityView.ts`, `src/game.ts`
- **Approach:** KTD4.
- **Evidence:** test first.
- **Test scenarios:** déterminisme et continuité entre tronçons ; piles hors des voies au sol ;
  AE4 avec le monde de collision (dessous libre, tablier solide) ; position des rames périodique.
- **Verification:** `npm test -- src/city/rail`
- **Slice:** S3

### U7. Ruelles, lanternes, câbles, distributeurs
- **Goal:** l'ambiance de rue de Tokyo dans le quartier néon.
- **Covers:** R8, R11
- **Depends on:** —
- **Files:** `src/city/generator.ts`, `src/city/generator.test.ts`, `src/city/streetLife.ts`, `src/city/streetLife.test.ts`, `src/city/payload.ts`, `src/city/cityView.ts`
- **Approach:** KTD6.
- **Evidence:** test first.
- **Test scenarios:** ruelles plus larges en néon ; lanternes au-dessus des trottoirs et ruelles,
  jamais dans un bâtiment ; câbles entre deux façades ; distributeurs sur trottoir.
- **Verification:** `npm test -- src/city`
- **Slice:** S4

### U8. Tours-repères et temples
- **Goal:** silhouette de Tokyo visible de loin et temples entre les tours.
- **Covers:** R9, R10, AE5, AE6, R11
- **Depends on:** U7
- **Files:** `src/city/landmarks.ts`, `src/city/landmarks.test.ts`, `src/city/generator.ts`, `src/city/temples.ts`, `src/main.ts`
- **Approach:** KTD5, KTD6.
- **Evidence:** test first.
- **Test scenarios:** une tour par super-cellule, déterministe ; îlot central libre de bâtiments ;
  AE5 (repères à 2 km gardés) ; temples déterministes et collisions présentes.
- **Verification:** `npm test -- src/city`
- **Slice:** S4

<!-- kaizen:verification -->
## Contrat de vérification
- `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`.
- AE1, AE3, AE5 : captures navigateur (`?hour=22&weather=rain`), jointes au résumé.
- AE2 : test navigateur qui vérifie que la police japonaise est chargée et l'atlas dessiné.
- AE4, AE6 : tests Vitest.
- R11 : `?bench=1` sur la configuration de référence (manuel).

<!-- kaizen:done -->
## Définition de terminé
- U1–U8 livrées avec leur preuve ; R1–R11 et AE1–AE6 couverts.
- Vérifications vertes ; revue Kaizen sans P0/P1 ouvert.
