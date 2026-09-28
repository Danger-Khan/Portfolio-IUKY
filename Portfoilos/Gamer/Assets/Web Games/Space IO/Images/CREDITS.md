# Art credits — Space IO

The PNGs in this folder are by **Kenney** (https://kenney.nl), released under
**CC0 1.0 Universal (public domain)** — free to use, modify and redistribute,
including commercially, with no attribution required. This file exists anyway,
because crediting good free art is the decent thing to do.

- `Space`
- `background.png`
- `Space`
- `meteor.png`
- `Space`
- `ship.png`

Fetched from the extracted mirror at https://github.com/ETdoFresh/kenney.nl.

## How they're used

`game.js` loads these through `loadSprites()` in `../engine.js`. Every use is
guarded by an `if (SPR.<name>)` check, so the art is an upgrade and never a
dependency — delete any file here and the game falls straight back to the
shapes it draws itself. Nothing in this folder is required for the game to run.

Drop your own art in with these names to replace Kenney's without touching
`game.js`.
