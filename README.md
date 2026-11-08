# Nomad

A first-person procedural island explorer built with Three.js. Walk through rolling hills, low-poly forests, rocky peaks, and a quiet coastline.

## Play online

**[Explore Nomad in your browser](https://peterthelander.github.io/nomad/?v=graphics-06)**

No download or installation needed. Open the link on a phone, tablet, or desktop and select **Enter the wilderness**.

The site is hosted on GitHub Pages and automatically deploys updates from the `main` branch. Multiplayer is hosted on Cloudflare Workers with one Durable Object per island.

## Run locally (optional)

From this folder, start a static server:

```sh
python3 -m http.server 8765
```

Open http://localhost:8765 in a browser. Internet access is needed to load Three.js from its pinned CDN URL; no build step or player API keys are required. Solo exploration works even when the multiplayer service is unavailable.

## Controls

### Phone / tablet

- Tap **Enter the wilderness** to start.
- Drag the left joystick to walk; push farther to move faster.
- Drag anywhere outside the joystick and buttons to look around. Both thumbs work at once.
- Tap **Jump** at the lower right to jump.
- Tap **Pause** to open the menu. Landscape orientation gives you more room.

### Desktop

- Click **Enter the wilderness** to capture the mouse.
- **WASD** or **arrow keys** to walk.
- **Mouse** to look.
- **Shift** to run.
- **Space** to jump (press again after landing).
- **Esc** to pause and release the mouse.

Movement follows the terrain height and stops at the shoreline and world boundary.

## Files

- `index.html` — page structure and overlay.
- `styles.css` — styling.
- `main.js` — rendering, movement, and application setup.
- `world.js` — deterministic terrain, trees, rocks, and coastal height texture.
- `atmosphere.js` — gradient sky, procedural clouds, animated ocean, and sunlight/shadows.
- `controls.js` — desktop and multi-touch input.
- `movement.js` — jump gravity and terrain landing.
- `multiplayer.js` — shared rooms and connection handling.
- `avatars.js` — detailed procedural explorers and articulated walk animation.
- `config.js` — public multiplayer endpoint (no credentials).
- `server/` — Cloudflare Worker and per-world Durable Object.
- `wrangler.jsonc` — deployment configuration.

## Multiplayer service

The client joins `amber-island` by default. **Invite friends** copies the current room link; **New island** creates a new room link. Rooms support up to 20 connections, with anonymous avatars and no sign-up. Desktop controls are unchanged. On phones, pause to access invitation buttons.

Room state is temporary: disconnecting removes your avatar, and empty rooms retain no player progress. All room links use the same deterministic terrain. Room links are invitations, not authenticated private spaces. This is a casual exploration prototype, not a cheat-resistant simulation.

### Deploy to your Cloudflare account

Use a current Node.js LTS release:

```sh
npm ci
npx wrangler login
npm run deploy:server
```

The configuration uses SQLite-backed Durable Objects, supported on the Workers Free plan. No paid plan or custom domain is required. Free usage limits still apply; monitor them in the Cloudflare dashboard.

Set `MULTIPLAYER_URL` in `config.js` to the HTTPS `workers.dev` URL returned by deployment. No secret belongs in that file. Then run:

```sh
npm run version:assets
```

Commit and push the client files to `main` to update GitHub Pages. Version assets after changes to any browser JavaScript or CSS so devices receive the new files.

### Test the backend locally

```sh
npm run dev:server
```

In a second terminal:

```sh
NOMAD_TEST_URL=http://localhost:8787 npm test
```

Tests cover stalled-connection recovery, idle bandwidth, asset versions, desktop/touch input, and real WebSocket room isolation, late joining, leaving, capacity, and invalid messages. Without `NOMAD_TEST_URL`, network integration tests are skipped.

To use the local backend in the browser, temporarily set `MULTIPLAYER_URL` to `http://localhost:8787`, version the assets, and serve the game at `http://localhost:8765`. Restore the production endpoint before pushing. A different frontend origin must be added explicitly to `ALLOWED_ORIGINS` in the Worker configuration.

Requires a browser with WebGL. Desktop mouse controls use Pointer Lock; mobile controls use touch gestures.
