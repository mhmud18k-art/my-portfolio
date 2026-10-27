# xc — Ishikawa, scroll-driven 3D architecture site

A recreation of the Ishikawa studio site from the reference reel. Open `index.html` in a browser; it works straight from the file, no server or build step.

The hero walks you through a house in five shots. Scrolling dollies into each shot, then the shot rushes past you and blurs while the next grows in from the distance, like stepping through a doorway. Moving the mouse looks around the room: the view turns a few degrees in perspective and the headlines drift the other way. Touch screens get a slow sway instead.

Each shot is a photo (see below). Under the photos is a real-time Three.js scene of the same house (a bonsai courtyard, a cedar-slat corridor and a lit living room on a forested plateau with a lake and mountains). It only shows for a shot whose photo is missing, and the mouse turns its camera too:

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

`photos/1.jpg` to `5.jpg` are AI-generated in Figma (gemini-3.1-flash-image), one per shot in the order above. Each photo replaces the 3D view for its shot. To swap one, replace the file with a landscape image with the subject right of centre (the headlines sit on the left), and adjust its `background-position` in `index.html` so phones crop toward the subject.

The project cards in `shots/` are 4:5 crops of the same photos, and `shots/poster.jpg` is photo 1, shown until the page is ready.

With `prefers-reduced-motion`, shots cut straight from one to the next with a dip to black, and the pointer look, sway and idle drift are off.
