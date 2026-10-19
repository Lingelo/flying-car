---
title: Les uniforms partagés via onBeforeCompile se mutent, ils ne se remplacent pas
date: 2026-10-19
category: logic-errors
module: render
problem_type: logic_error
component: frontend
symptoms:
  - Une texture chargée en asynchrone n'apparaît jamais alors que le chargement réussit, sans erreur
  - Le matériau reste sur son repli procédural (indicateur `u...Ready` resté à 0 côté GPU)
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags: [threejs, uniforms, onbeforecompile, textures, shader]
---

# Les uniforms partagés via onBeforeCompile se mutent, ils ne se remplacent pas

## Problem
Les matériaux de la ville partagent des registres d'uniforms (`cityUniforms`, `facadeUniforms`,
`groundUniforms`, `surfaceUniforms`, `signUniforms`) branchés dans `onBeforeCompile` par
`Object.assign(shader.uniforms, registre)`. Le shader compilé garde **les objets `{ value }` du
moment**. Si le chargement asynchrone des textures remplace ensuite ces objets
(`Object.assign(registre, { uAsphalt: { value: tex } })`), le programme continue de lire les anciens :
la texture n'arrive jamais, sans aucune erreur.

## Symptoms
- Chargement des JPEG réussi (réseau OK, `loadTextureSet` non nul) mais rendu inchangé.
- Aucun avertissement WebGL ni exception : le défaut est silencieux.

## What didn't work
- Recompiler (`needsUpdate`) n'aide pas si `customProgramCacheKey` est stable : le programme en cache
  reprend les mêmes références.

## Solution
Toujours écrire `.value` sur l'objet existant :

```ts
groundUniforms.uAsphalt.value = asphalt.diff;   // et non Object.assign(groundUniforms, {...})
groundUniforms.uGroundReady.value = 1;
```

Voir `loadGroundTextures` dans `src/render/materials/road.ts`, et `loadFacadeTextures` /
`loadSurfaceTextures` qui suivent la même règle.

## Why it works
Three.js lie chaque uniform du programme à l'objet `{ value }` fourni lors de la compilation et relit
`.value` à chaque rendu. Muter `.value` est vu immédiatement ; remplacer l'objet ne l'est jamais.

## Prevention
- Un registre d'uniforms est déclaré une fois avec toutes ses clés (`value: null` en attendant) et
  n'est ensuite modifié que par `.value`.
- En revue, tout `Object.assign(<registre>, …)` hors `onBeforeCompile` est suspect.
