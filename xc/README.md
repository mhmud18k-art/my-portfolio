# xc — Ishikawa, scroll-driven 3D architecture site

A recreation of the Ishikawa studio site from the reference reel. Open `index.html` in a browser; it works straight from the file, no server or build step.

The hero is a real-time 3D scene built with Three.js: a concrete house with a bonsai courtyard, a cedar-slat corridor and a lit living room, on a forested plateau with a lake and mountains. Scrolling moves through five camera shots, and each cut dips to black:

1. Courtyard — *Architecture of Stillness.*
2. The house against the mountains — *L'art de la retenue.*
3. Aerial pull-back (no text, as in the reel)
4. Cedar corridor — *La vérité est dans la texture.*
5. Living room, looking through to the bonsai — *Entrez dans l'expérience.*

| Path | What it is |
|---|---|
| `index.html` | Page markup and copy |
| `style.css` | Layout and type |
| `main.js` | Scroll progress, headlines, nav, progress bar |
| `scene3d.js` | The 3D world and camera shots (all geometry and textures are generated in code) |
| `vendor/three.min.js` | Three.js r159, MIT (`vendor/three.LICENSE`) |
| `shots/` | Stills rendered from the scene: the project cards, and `poster.jpg`, shown before WebGL starts or where it isn't available |

## Photos

`photos/1.jpg` to `5.jpg` are AI-generated in Figma (gemini-3.1-flash-image), one per shot in the order above. Each photo replaces the 3D view for its shot and slowly dollies in as you scroll; the 3D scene only shows for a shot whose photo is missing or fails to load. To swap one, replace the file with a landscape image with the subject right of centre (the headlines sit on the left), and adjust its `background-position` in `index.html` so phones crop toward the subject.

The project cards in `shots/` are 4:5 crops of the same photos, and `shots/poster.jpg` is photo 1, shown until the page is ready.

With `prefers-reduced-motion`, the camera jumps between shots instead of easing and the idle drift is off.
