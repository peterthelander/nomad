# Nomad

A first-person procedural island explorer built with Three.js. Walk through rolling hills, low-poly forests, rocky peaks, and a quiet coastline.

## Play online

**[Explore Nomad in your browser](https://peterthelander.github.io/nomad/)**

No download or installation needed. Open the link in a desktop browser and click **Enter the wilderness**.

The site is hosted on GitHub Pages and automatically deploys updates from the `main` branch.

## Run locally (optional)

From this folder, start a static server:

```sh
python3 -m http.server 8765
```

Open http://localhost:8765 in a desktop browser. Internet access is needed to load Three.js from its pinned CDN URL; no API keys, build step, or backend are required.

## Controls

- Click **Enter the wilderness** to capture the mouse.
- **WASD** or **arrow keys** to walk.
- **Mouse** to look.
- **Shift** to run.
- **Esc** to pause and release the mouse.

Movement follows the terrain height and stops at the shoreline and world boundary.

## Files

- `index.html` — page structure and overlay.
- `styles.css` — styling.
- `main.js` — procedural terrain, decoration, rendering, and first-person controls.

Requires a desktop browser with WebGL and Pointer Lock support.
