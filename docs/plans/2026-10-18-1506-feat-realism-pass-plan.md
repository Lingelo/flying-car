---
title: Passe réalisme des assets - Plan
type: feat
date: 2026-10-18
topic: realism-pass
artifact: kaizen-plan/v1
source: plan
origin: docs/plans/2026-10-18-1437-feat-tokyo-visual-pass-plan.md
---

# Passe réalisme des assets - Plan

<!-- kaizen:goal -->
## Capsule d'objectif

**Objectif :** la ville et les véhicules cessent de faire « maquette » : façades photoréalistes avec
de vraies fenêtres en profondeur, bases et toits détaillés, néons en tubes lumineux façon Blade
Runner plutôt que pancartes, voitures modélisées finement.
**Moyens :** textures PBR CC0 (Poly Haven) téléchargées par un script et versionnées ; géométrie et
shaders procéduraux pour le reste ; voitures procédurales détaillées.
**Autorité produit :** Angélo LIMA, en séance le 2026-10-18 (« bâtiments pas réels, vitres, textures,
bases, sommets génériques ; voitures peu détaillées ; plus de néons, pas des pancartes, comme Blade
Runner ; trop maquette ») ; voitures : procédural très détaillé (choisi plutôt que Sketchfab ou des
modèles fournis).
**Bloqueurs ouverts :** aucun.

<!-- kaizen:product -->
## Contrat produit

### Résumé
Remplacer les surfaces unies et les volumes nus par des matériaux et des détails crédibles, en
gardant la ville infinie, déterministe et fluide.

### Exigences

**Façades**
- R1. Les façades utilisent des matériaux photographiques (béton, panneaux, métal, carrelage) avec
  relief, rugosité et salissures (coulures sous les rebords, pied plus sale).
- R2. Les fenêtres montrent une profondeur : pièces intérieures en perspective (murs, plafond,
  mobilier, stores, éclairages variés), montants et allèges en relief, reflet du ciel et de la ville.

**Bases et sommets**
- R3. Le pied des immeubles a un podium : vitrines double hauteur éclairées, auvents, entrées.
- R4. Les toits portent des équipements : climatiseurs, châteaux d'eau, antennes, paraboles,
  héliports balisés, couronnes LED, grues ; les murs portent des climatiseurs et tuyaux.

**Néons**
- R5. Les enseignes sont des tubes néon (lettres et formes en tubes, cœur blanc, halo coloré) sur
  armatures métalliques, sans fond plein ; les écrans gardent un cadre.
- R6. Les néons diffusent un halo dans l'air humide (brume, pluie) et des hologrammes géants
  translucides animés flottent entre les tours (poissons koï, kanji, logos).

**Voitures**
- R7. La roadster du joueur est modélisée finement : carrosserie sculptée, lignes de carrosserie,
  bouclier, prises d'air, diffuseur, rétroviseurs, verrière, habitacle visible, jantes à rayons avec
  disques et étriers, pneus, optiques, peinture métallisée à paillettes et vernis.
- R8. Le trafic compte au moins trois véhicules détaillés (berline volante façon Spinner, utilitaire,
  sportive) avec leurs feux.

**Sol**
- R9. Chaussée et trottoirs en matériaux photographiques (asphalte usé, dalles), bordures en relief,
  plaques d'égout.

**Contraintes**
- R10. Tous les assets externes sont CC0, listés avec source et licence, et l'application reste
  fonctionnelle s'ils manquent (repli procédural).
- R11. Déterminisme par graine conservé ; performance : chaque ajout coûteux suit la qualité.

### Décisions clés
- **Voitures procédurales détaillées** — gouverne R7, R8. (décidé en séance : choisi plutôt que des
  modèles Sketchfab CC-BY ou fournis)
- **Textures CC0 Poly Haven** — accessibles depuis l'environnement ; gouverne R1, R9, R10.

### Exemples d'acceptation
- AE1. (couvre R2) Étant donné une fenêtre éclairée vue de biais, quand la caméra se déplace, alors
  l'intérieur de la pièce se décale en perspective (parallaxe).
- AE2. (couvre R5) Étant donné une enseigne de nuit, quand on l'approche, alors on voit des lettres
  en tubes lumineux devant le mur, sans panneau plein derrière.
- AE3. (couvre R10) Étant donné les textures absentes, quand le jeu démarre, alors la ville s'affiche
  avec les matériaux procéduraux et sans erreur.
- AE4. (couvre R11) Étant donné la même graine, quand on relance, alors les équipements de toit et
  de façade sont identiques.

### Hors périmètre
- Plus tard : intérieurs réels traversables, piétons, véhicules au sol déformables.

<!-- kaizen:planning -->
## Contrat de planification

### Décisions techniques clés
- KTD1. **Script `scripts/fetch-assets.mjs`** : télécharge depuis l'API Poly Haven une liste fixe de
  textures 1k (diffuse, normale GL, ARM) en JPG dans `public/assets/textures/`, versionnées ; un
  loader partagé les charge avec repli sur les matériaux actuels (R10). Couvre R1, R9, R10.
- KTD2. **Façades** : mappage en mètres (déjà en place) avec textures répétées par style de
  bâtiment, normal map, salissures procédurales ; **interior mapping** (rayon dans une boîte de
  pièce par fenêtre) pour les vitres ; montants par perturbation de normale. Couvre R1, R2.
- KTD3. **Détails instanciés** : équipements de toit et de façade décrits par des fonctions pures
  `(chunk, seed)` dans le Worker, rendus en `InstancedMesh` par type pour rester à un appel de
  dessin par type. Couvre R3, R4, R11.
- KTD4. **Néons en tubes** : l'atlas trace les lettres en contour (tube) dans un canal et un halo
  large dans un autre, fond transparent ; matériau additif devant une armature métallique ; halos
  volumétriques en sprites additifs dont l'intensité suit l'humidité et le brouillard. Couvre R5, R6.
- KTD5. **Voitures** : loft à plus haute résolution avec profils multiples, éléments ajoutés en
  géométrie (bouclier, diffuseur, aileron, rétros, habitacle), jantes à rayons, matériau
  `MeshPhysicalMaterial` avec paillettes (normal map de bruit) et vernis. Couvre R7, R8.

### Contexte et patterns à suivre
- `src/city/signage.ts`, `src/city/streetLife.ts` (placement pur + géométrie Worker),
  `src/render/materials/facade.ts`, `src/vehicle/proceduralCar.ts`, `src/traffic/vehicleShapes.ts`.

### Learnings et règles appliqués
- Pièges de cette base : mots réservés GLSL, `DoubleSide` pour les panneaux, cible de rendu
  échantillonnée pendant son rendu, `flipY` des textures canvas.

<!-- kaizen:rollout -->
## Déploiement et retour arrière

- **Exposition** : directe après CI verte.
- **Rollback** : revert ; rien d'irréversible.
- **Signal** : smoke test Playwright ; seuil : > 0 échec → revert.

<!-- kaizen:units -->
## Unités d'implémentation

### U1. Pipeline d'assets CC0
- **Goal:** télécharger, versionner et charger les textures avec repli.
- **Covers:** R10, AE3
- **Depends on:** —
- **Files:** `scripts/fetch-assets.mjs`, `src/render/textures.ts`, `src/render/textures.test.ts`, `public/assets/textures/*`, `public/assets/CREDITS.md`
- **Approach:** KTD1.
- **Evidence:** test first (manifeste : chaque texture a ses cartes et une licence CC0 ; loader : une
  texture manquante donne le repli sans erreur).
- **Verification:** `npm test -- src/render/textures`
- **Slice:** S1

### U2. Façades photoréalistes et fenêtres en profondeur
- **Goal:** matériaux PBR, salissures, interior mapping.
- **Covers:** R1, R2, AE1
- **Depends on:** U1
- **Files:** `src/render/materials/facade.ts`, `src/render/materials/interior.ts`, `src/render/materials/interior.test.ts`
- **Approach:** KTD2.
- **Evidence:** test first pour le calcul d'intersection rayon / pièce (porté en TS) ; captures.
- **Test scenarios:** rayon de face → mur du fond ; rayon de biais → mur latéral ; AE1 (le point
  touché se décale avec la direction de vue).
- **Verification:** `npm test -- src/render/materials` + captures jour et nuit
- **Slice:** S1

### U3. Podiums, équipements de toit et de façade
- **Goal:** bases et sommets crédibles.
- **Covers:** R3, R4, AE4, R11
- **Depends on:** U1
- **Files:** `src/city/details.ts`, `src/city/details.test.ts`, `src/city/detailView.ts`, `src/city/payload.ts`, `src/city/cityView.ts`
- **Approach:** KTD3.
- **Evidence:** test first.
- **Test scenarios:** équipements sur les toits et dans leur emprise ; climatiseurs collés aux murs ;
  podiums au rez-de-chaussée ; déterminisme (AE4).
- **Verification:** `npm test -- src/city/details`
- **Slice:** S2

### U4. Néons en tubes, halos et hologrammes géants
- **Goal:** l'éclairage façon Blade Runner.
- **Covers:** R5, R6, AE2
- **Depends on:** —
- **Files:** `src/render/signAtlas.ts`, `src/render/materials/hologram.ts`, `src/city/signage.ts`, `src/city/holograms.ts`, `src/city/holograms.test.ts`
- **Approach:** KTD4.
- **Evidence:** test first pour le placement (armatures, hologrammes entre les tours, hors des
  couloirs aériens) ; captures pour AE2.
- **Verification:** `npm test -- src/city src/render`
- **Slice:** S3

### U5. Roadster détaillée
- **Goal:** la voiture du joueur au niveau d'un modèle de jeu.
- **Covers:** R7
- **Depends on:** —
- **Files:** `src/vehicle/proceduralCar.ts`, `src/vehicle/carParts.ts`, `src/vehicle/carModel.test.ts`
- **Approach:** KTD5.
- **Evidence:** test first (pièces présentes, roues repliables, dimensions) ; captures.
- **Verification:** `npm test -- src/vehicle`
- **Slice:** S4

### U6. Trafic détaillé
- **Goal:** trois véhicules détaillés dont une voiture volante façon Spinner.
- **Covers:** R8
- **Depends on:** U5
- **Files:** `src/traffic/vehicleShapes.ts`, `src/traffic/trafficRender.test.ts`
- **Approach:** KTD5, instanciation conservée.
- **Evidence:** test first (types, dimensions, feux avant/arrière).
- **Verification:** `npm test -- src/traffic`
- **Slice:** S4

### U7. Sol photoréaliste
- **Goal:** asphalte, dalles, bordures, plaques.
- **Covers:** R9
- **Depends on:** U1
- **Files:** `src/render/materials/road.ts`, `src/city/roadMesh.ts`, `src/city/buildingMesh.test.ts`
- **Approach:** KTD1, bordures en géométrie.
- **Evidence:** test first (bordures le long des trottoirs, hors chaussée) ; captures.
- **Verification:** `npm test -- src/city`
- **Slice:** S5

<!-- kaizen:verification -->
## Contrat de vérification
- `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e` ; captures jour / nuit / pluie.
- AE3 : test navigateur avec les textures bloquées.

<!-- kaizen:done -->
## Définition de terminé
- U1–U7 livrées avec preuve ; R1–R11, AE1–AE4 couverts ; revue Kaizen sans P0/P1 ouvert.
