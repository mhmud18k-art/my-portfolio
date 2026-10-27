# xc — scroll-driven portfolio (Arabic, RTL)

Open `index.html` in a browser. It presents my work in Arabic: the hero is a sticky stage with 5 scenes (me at the desk, Cosmos, Darakom, Malaabi, contact); scrolling crossfades them and pushes the camera in, while the headline for each scene fades in and out.

## Replacing the scenes with real images

Each scene is drawn in SVG as a placeholder. To use real renders, put images in `assets/`:

| File | Scene |
|---|---|
| `assets/scene-1.jpg` | Desk with monitor and phone |
| `assets/scene-2.jpg` | Cosmos — the solar system |
| `assets/scene-3.jpg` | Darakom — Damascus rooftops at dusk |
| `assets/scene-4.jpg` | Malaabi — a floodlit pitch at night |
| `assets/scene-5.jpg` | Contact — paper plane at dawn |

Any image that exists replaces its drawing automatically. 16:9, at least 1920px wide works best. Headlines sit on the right, so keep the subject of each image centre or left.
