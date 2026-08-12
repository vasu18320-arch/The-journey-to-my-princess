# The Journey to My Princess — An Anniversary Quest

A self-contained, portrait-oriented pixel-style browser game made for a long-distance anniversary gift.

## Run locally
Open `index.html` in a modern browser.

## Publish with GitHub Pages
1. Put all files in the repository root.
2. GitHub → repository → **Settings** → **Pages**.
3. Under Build and deployment choose **Deploy from a branch**.
4. Select `main` and `/ (root)`.
5. Save and wait for the Pages URL.

## Controls
Desktop: A/D or Left/Right, W/Space/Up = jump, J/X = attack, Escape = fullscreen.
Mobile: touch buttons. Double-tap the game area for fullscreen.

## Important
The four main characters are implemented as original crisp pixel-style drawings inspired by the supplied references. The game has no external asset dependencies, so GitHub Pages cannot fail because a sprite file is missing.

The game saves progress with localStorage.


## Personalization
At the top of `game.js`, edit:
- `KNIGHT_NAME`
- `PRINCESS_NAME`
- `FINAL_MESSAGE`

No image files are required. This keeps the first GitHub Pages deployment reliable.
