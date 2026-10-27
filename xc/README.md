# xc — scroll-driven 3D portfolio (Arabic, RTL)

Open `index.html` in a browser; it works straight from the file, no server or build step.

The hero is a real-time 3D scene built with Three.js: a concrete house with a bonsai courtyard, a cedar-slat corridor and a lit living room, on a forested plateau with a lake and mountains. Scrolling moves through five camera shots, and each cut dips to black. The headlines over the shots introduce me and how I work. Below the hero are my projects with real screenshots, then the tools I use and contact.

| Path | What it is |
|---|---|
| `index.html` | Page markup and copy |
| `style.css` | Layout and type |
| `main.js` | Scroll progress, headlines, nav, progress bar |
| `scene3d.js` | The 3D world and camera shots (all geometry and textures are generated in code) |
| `vendor/three.min.js` | Three.js r159, MIT (`vendor/three.LICENSE`) |
| `shots/` | Screenshots of Cosmos and Darakom, and `poster.jpg`, the still shown before WebGL starts or where it isn't available |

With `prefers-reduced-motion`, the camera jumps between shots instead of easing and the idle drift is off.
