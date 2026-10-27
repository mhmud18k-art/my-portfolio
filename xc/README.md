# xc — Ishikawa, a scroll-driven 3D journey

A recreation of the Ishikawa studio site from the reference reel. Open `index.html` in a browser; it works straight from the file, no server or build step.

The hero is a real-time Three.js world, and scrolling drives the camera through it in one continuous move. A concrete house stands on a forested plateau above an alpine lake at golden hour. A road climbs from the shore through spruce forest to its west door, a cedar-slatted corridor leads to a bonsai courtyard, and the living room looks south through glass toward the low sun. Scrolling up plays the same journey backwards.

| Progress | Where the camera is | Headline |
|---|---|---|
| 0 | Over the lake, the house small against the low sun | *Architecture of Stillness.* |
| 0 → 1 | Gliding across the water, down to the shore, low along the road through the forest | |
| 1 | Out of the trees: the house across the meadow | *L'art de la retenue.* |
| 2 | Rising and swinging round to the front of the house | (none, as in the reel) |
| 3 | Round to the west door and into the cedar corridor, the bonsai at its end | *La vérité est dans la texture.* |
| 4 | Past the bonsai into the living room, facing the glass | *Entrez dans l'expérience.* |

The camera travels at an even pace between stations and eases into each one. The pace is measured by how fast the ground seems to pass, so the drive along the road gets more of the scroll than the flight above the lake. Near the ground it walks: the head rises and falls with each step and sways with each stride. The mouse turns the head; touch screens get a slow sway instead. The tour also plays on its own when the page opens at the top, and any scroll, touch or key hands it back to the visitor; the button under the progress bar plays and pauses it.

| Path | What it is |
|---|---|
| `index.html` | Page markup and copy |
| `style.css` | Layout and type |
| `main.js` | Scroll and pointer loop, the tour, headlines, nav, progress bar, and the flat fallback |
| `scene3d.js` | The world: terrain, lake, road, forest, house, sky and light, the camera's journey, and the post-processing |
| `textures/*.webp` | Photographic textures, AI-generated in Figma and made tileable: rock (with a normal map), alpine meadow (with a normal map), forest floor, and a spruce branch cut out on alpha |
| `textures/textures.js` | The same textures as data URLs (generated, see below) |
| `tools/bundle-textures.py` | Rebuilds `textures/textures.js` |
| `vendor/three.min.js` | Three.js r159, MIT (`vendor/three.LICENSE`) |
| `photos/` | Five photos, AI-generated in Figma, for the fallback |
| `shots/` | Project-card crops of the photos, and `poster.jpg`, a still of the opening shown until the world is built |

## How the world is made

The shapes are generated in code at load and covered in photographed textures. The valley is a noise-shaped grid. The mountains are a separate ring of terrain in polar steps that grow with distance, shaped by eroded noise: each octave is damped where the slope is already steep, so the ridges stay sharp and the faces between them read as worn. The valley stays open toward the setting sun, which is how the low light gets in. The ground is shaded per pixel from the photographed textures, each sampled at two scales so the tiling never shows. Meadow gives way to forest floor under the trees and to scree with height. Rock is projected along all three axes on steep faces, bumped by its own cracks so the low sun picks them out, and seen very large from afar so that it reads as gullies and cliff bands. Snow lies on the high, gentler ground. The low sun's light is traced past the peaks, so their shadows fall across the valley.

The spruces are built from the photographed branch: whorls of drooping, crossed branch cards round a trunk, with normals that point out from the crown so each tree shades as one mass. The low sun glows through the needles. The trees near the journey are detailed and cast shadows; the distant forest, including a belt on the mountains' lower slopes, uses a lighter version. All are instanced and planted in patches so that patches behind the camera are skipped, and they keep clear of the camera's path, so nothing passes through the lens. The boulders are fractured stone in the photographed rock, mossy where they face the sky, and the courtyard bonsai has needle pads and bark from the same textures. The road is a spline with its own smoothed profile, and the ground is cut to meet it. The house is board-formed concrete, with glass that is clear when seen face on and reflective at a glance.

Chrome won't let WebGL read image files on a page opened from disk, so the world reads the textures from `textures/textures.js`. After changing a texture, run `python tools/bundle-textures.py` from this folder.

The light is a low sun with soft shadows that follow the camera and widen to cover the whole view from the air. The haze is thicker low in the valley, warm toward the sun and cool away from it, so the far ridges fade into the sky. Each frame renders in HDR, then goes through bloom, ACES tone mapping, a split-tone grade, a vignette and film grain.

## Performance and fallbacks

Phones and machines with four cores or less get the lighter tier: fewer trees, coarser terrain and mountains, a smaller shadow map, 2× instead of 4× multisampling, and no bloom. A frame is about 1.4–1.9 million triangles on the full tier and 0.6–0.8 million on the lighter one. `?tier=high` or `?tier=low` forces either. Without WebGL, or if the world or its textures fail to load, the five photos play the journey as flat layers that tilt with the pointer. With `prefers-reduced-motion`, the camera cuts straight between stations with a dip to black, and the tour, the walk and the pointer look are all off.

`?debug` exposes the world in the console as `window.world`: `world.probe(p)` gives the camera's position and height above the ground at progress `p`, and `world.solids` lists the house's boxes, for checking that the camera never clips.
