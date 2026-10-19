---
title: Une passe de rendu secondaire qui coupe les ombres avant la première shadow map provoque un sampler mismatch
date: 2026-10-19
category: runtime-errors
module: render
problem_type: runtime_error
component: frontend
symptoms:
  - "GL_INVALID_OPERATION: glDrawElements: Mismatch between texture format and sampler type (signed/unsigned/float/shadow)"
  - L'erreur n'apparaît qu'au démarrage sous la pluie (rues mouillées dès la première image)
root_cause: async_timing
resolution_type: code_fix
severity: medium
framework_version: three 0.186.1
tags: [threejs, shadow-map, planar-reflection, webgl, render-target]
---

# Une passe de rendu secondaire qui coupe les ombres avant la première shadow map provoque un sampler mismatch

## Problem
La réflexion plane (`src/render/reflection.ts`) rend la scène depuis une caméra miroir et désactivait
`renderer.shadowMap.autoUpdate` pour ne pas recalculer les ombres. La nuit, la shadow map du soleil
n'est produite qu'à la demande (`needsUpdate` quand elle n'existe pas encore). Quand la météo de départ
rend les rues mouillées dès la première image, la passe miroir s'exécute **avant** que la shadow map
existe : les shaders échantillonnent un `sampler2DShadow` lié à une texture vide d'un autre type.

## Symptoms
- `GL_INVALID_OPERATION … Mismatch between texture format and sampler type` en console, seulement
  sous la pluie au démarrage (pas en temps sec, pas après quelques secondes).

## What didn't work
- Supprimer simplement la désactivation des ombres dans la passe miroir : l'erreur disparaît, mais la
  revue performance a montré que la shadow map serait alors rendue deux fois par image de jour
  mouillé.

## Solution
Ne sauter les ombres dans la passe secondaire **qu'une fois la shadow map créée** :
`RenderPipeline.shadowReady` (`!sun.castShadow || sun.shadow.map !== null`) est passé à
`PlanarReflection.update(…, shadowReady)`, qui ne met `shadowMap.autoUpdate = false` que si c'est vrai
et le restaure dans un `finally`.

## Why it works
La première image laisse le moteur créer la shadow map (sa demande `needsUpdate` est honorée), donc
tout matériau qui l'échantillonne trouve une texture de profondeur. Ensuite, la carte de l'image
courante reste valide pour la vue miroir (ombres en espace monde), d'où le saut sans coût.

## Prevention
- Toute passe de rendu ajoutée (miroir, cube map, capture) qui coupe les ombres vérifie d'abord que les
  shadow maps existent.
- Tester le démarrage direct dans chaque météo (`snap()` de la météo au lancement rend ce cas
  immédiat).
