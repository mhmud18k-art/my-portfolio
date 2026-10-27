# Ishikawa — scroll-driven architecture site

Open `index.html` in a browser. The hero is a sticky stage with 5 scenes; scrolling crossfades them and pushes the camera in, while the headline for each scene fades in and out.

## Replacing the scenes with real images

Each scene is drawn in SVG as a placeholder. To use real renders, put images in `assets/`:

| File | Scene |
|---|---|
| `assets/scene-1.jpg` | Courtyard with bonsai and rock |
| `assets/scene-2.jpg` | Dark wooden corridor |
| `assets/scene-3.jpg` | House exterior with mountains |
| `assets/scene-4.jpg` | Aerial view on the mountain slope |
| `assets/scene-5.jpg` | Interior framing the bonsai |

Any image that exists replaces its drawing automatically. 16:9, at least 1920px wide works best.
