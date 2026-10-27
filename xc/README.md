# xc — Ishikawa, a walk through a house in 3D

A recreation of the Ishikawa studio site from the reference reel. Open `index.html` in a browser; it works straight from the file, no server or build step.

The hero walks you through a house in five shots, rendered with Three.js. Each shot is a photo turned into a space: it is projected back out of the camera that took it onto a rough 3D model of the place it shows (a box room for the courtyard and the corridor, ground and a far backdrop for the landscapes, plus cut-outs such as the house front, the opening onto the courtyard and the bench). Seen from where the photo was taken it is exactly the photo; moving the mouse moves your head and turns the view, so near walls slide past far ones like in a real room. Scrolling steps forward through each shot, and the cut to the next one walks through it: the shot you leave rushes past and fades as the next settles in. Touch screens get a slow sway instead of the mouse.

1. Courtyard — *Architecture of Stillness.*
2. The house against the mountains — *L'art de la retenue.*
3. Aerial over the lake (no text, as in the reel)
4. Cedar corridor — *La vérité est dans la texture.*
5. Living room, looking through to the bonsai — *Entrez dans l'expérience.*

| Path | What it is |
|---|---|
| `index.html` | Page markup and copy |
| `style.css` | Layout and type |
| `main.js` | Scroll and pointer loop, headlines, nav, progress bar, and the flat fallback |
| `photo3d.js` | The photos as 3D spaces: the per-shot depth models, camera and walk-through |
| `photos/1.jpg` … `5.jpg` | The five photos |
| `photos/photos.js` | The same photos as data URLs (generated, see below) |
| `tools/bundle-photos.py` | Rebuilds `photos/photos.js` |
| `vendor/three.min.js` | Three.js r159, MIT (`vendor/three.LICENSE`) |
| `shots/` | Project-card crops of the photos, and `poster.jpg`, shown until the 3D is ready |

## Photos

The photos are AI-generated in Figma (gemini-3.1-flash-image). Chrome won't let WebGL read image files on a page opened from disk, so the 3D hero reads them from `photos/photos.js` instead. To swap a photo, replace its `.jpg` and run `python tools/bundle-photos.py` from this folder. Each shot's depth model in `photo3d.js` (`SHOTS`) is fitted to its photo, with the back wall, horizon and cut-outs in image coordinates, so a very different photo needs its model adjusted too.

Without WebGL the photos play as flat layers that tilt with the pointer, using the `.jpg` files directly. With `prefers-reduced-motion`, shots cut straight from one to the next with a dip to black, and the pointer look and sway are off.
