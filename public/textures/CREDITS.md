# Environment asset credits

All scanned textures and rock models used by the five campaign worlds come from
[Poly Haven](https://polyhaven.com) and are released under the
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) licence
(public domain: no attribution required; credited here with thanks).

Files were downloaded at 1K, resized/re-encoded to WebP (albedo q76, normal q80,
ARM q70) and, for models, simplified and compressed with glTF-Transform
(meshopt geometry, 512 px WebP textures).

## Textures (`public/textures/<world>/<name>_{diff,nor,arm}.webp`)

| File stem | Poly Haven asset | Author(s) | Licence |
|---|---|---|---|
| `sky-isles/turf` | [leafy_grass](https://polyhaven.com/a/leafy_grass) | Charlotte Baglioni | CC0 |
| `sky-isles/cliff` | [aerial_rocks_02](https://polyhaven.com/a/aerial_rocks_02) | Rob Tuytel | CC0 |
| `verdant-wilds/floor` | [forest_leaves_02](https://polyhaven.com/a/forest_leaves_02) | Rob Tuytel | CC0 |
| `verdant-wilds/rock` | [mossy_rock](https://polyhaven.com/a/mossy_rock) | Rob Tuytel | CC0 |
| `shared/bark` | [bark_brown_02](https://polyhaven.com/a/bark_brown_02) | Rob Tuytel | CC0 |
| `crimson-dunes/sand` | [aerial_beach_01](https://polyhaven.com/a/aerial_beach_01) | Rob Tuytel | CC0 |
| `crimson-dunes/rock` | [cliff_side](https://polyhaven.com/a/cliff_side) | James Ray Cock, Jenelle van Heerden, Dario Barresi | CC0 |
| `crystal-heights/snow` | [snow_02](https://polyhaven.com/a/snow_02) | Rob Tuytel | CC0 |
| `crystal-heights/rock` | [rock_3](https://polyhaven.com/a/rock_3) | Rob Tuytel | CC0 |
| `obsidian-core/rock` | [dark_rock_02](https://polyhaven.com/a/dark_rock_02) (replaces dark_rock: brighter fractured basalt with stronger relief) | Amal Kumar | CC0 |
| `obsidian-core/ground` | [rock_ground](https://polyhaven.com/a/rock_ground) | Rob Tuytel | CC0 |

`_diff` = albedo (sRGB), `_nor` = OpenGL normal map, `_arm` = packed
ambient occlusion (R) / roughness (G) / metalness (B).

## Models (`public/models/env/*.glb`)

| File | Poly Haven asset | Author(s) | Licence |
|---|---|---|---|
| `boulder.glb` | [namaqualand_boulder_06](https://polyhaven.com/a/namaqualand_boulder_06) | Greg Zaal, Jenelle van Heerden | CC0 |
| `block.glb` | [namaqualand_boulder_03](https://polyhaven.com/a/namaqualand_boulder_03) | Jenelle van Heerden, Dario Barresi | CC0 |
| `slab.glb` | [rock_face_01](https://polyhaven.com/a/rock_face_01) | Dario Barresi | CC0 |
| `shard.glb` | [rock_09](https://polyhaven.com/a/rock_09) | Jenelle van Heerden | CC0 |
