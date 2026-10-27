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

With `prefers-reduced-motion`, the camera jumps between shots instead of easing and the idle drift is off.
