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
| `vendor/three.min.js` | Three.js r159, MIT (`vendor/three.LICENSE`) |
| `photos/` | Five photos, AI-generated in Figma, for the fallback |
| `shots/` | Project-card crops of the photos, and `poster.jpg`, a still of the opening shown until the world is built |

## How the world is made

Everything is generated in code at load, with no models or image files. The terrain is a noise-shaped grid, fine where the journey runs and coarse toward the mountains, with vertex colours for meadow, forest floor, rock and snow and a little baked occlusion in the hollows. The road is a spline with its own smoothed profile, and the ground is cut to meet it. The forest is a few thousand instanced spruces with baked shading inside the crown, planted in patches so that patches behind the camera are skipped. They keep clear of the camera's path, so nothing passes through the lens. The house is board-formed concrete, with glass that is clear when seen face on and reflective at a glance.

The light is a low sun with soft shadows that follow the camera. The haze is thicker low in the valley, warm toward the sun and cool away from it, so the far ridges fade into the sky. Each frame renders in HDR, then goes through bloom, ACES tone mapping, a split-tone grade, a vignette and film grain.

## Performance and fallbacks

Phones and machines with four cores or less get the lighter tier: fewer and simpler trees, a coarser terrain, a smaller shadow map, 2× instead of 4× multisampling, and no bloom. `?tier=high` or `?tier=low` forces either. Without WebGL, or if the world fails to build, the five photos play the journey as flat layers that tilt with the pointer. With `prefers-reduced-motion`, the camera cuts straight between stations with a dip to black, and the tour, the walk and the pointer look are all off.

`?debug` exposes the world in the console as `window.world`: `world.probe(p)` gives the camera's position and height above the ground at progress `p`, and `world.solids` lists the house's boxes, for checking that the camera never clips.
