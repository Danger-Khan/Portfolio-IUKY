# Images

Drop art for this game here — icons, backgrounds, sprites/objects, whatever you
want to add. Suggested subfolders, made only as you actually use them:

- `Images/icons/`
- `Images/backgrounds/`
- `Images/objects/`

Right now this game draws everything procedurally on the canvas (shapes,
gradients, particles — see `game.js`) and loads nothing from disk, so nothing
here is wired up automatically yet. Once you add files, `game.js` needs a
small loader (an `Image()`/`drawImage()` call per asset) to actually use them
— ask for that next and point at what you dropped in here.
