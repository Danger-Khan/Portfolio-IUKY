# Changelog

## 2026-09-10 — index.html debug pass

Analyzed [index.html](../index.html) and fixed four bugs:

1. **Unclosed `<div>` in the header.** The `grid lg:grid-cols-3` wrapper around the
   intro/photo block was missing its closing `</div>`, leaving invalid HTML that
   browsers were silently auto-correcting. Added the missing tag.

2. **Resume link card had no section wrapper.** The "Full_Resume_2026" link sat
   directly between `</header>` and the next `<section>` with no
   `max-w-7xl mx-auto px-6` container, so it stretched edge-to-edge unlike every
   other section. Its inner flex layout also spread four items
   (icon, title, description, arrow) across `justify-between`, squeezing the text
   awkwardly. Wrapped it in the standard container and regrouped the flex
   children into icon+text on the left, arrow on the right.

3. **Backslash path separators.** `img\dp.jpg` and
   `Portfoilos/AI\ML/index.html` used Windows-style backslashes, which are not
   valid URL separators and would break once hosted on a real web server (e.g.
   GitHub Pages). Converted both to forward slashes.

4. **Invalid mailto link.** The footer's Email_Terminal link was
   `mailto:contact@yameenimaad@gmail.com` — two `@` signs, so it never resolved.
   Confirmed with the user and changed it to `mailto:yameenimaad@gmail.com`.

### Known, unfixed (flagged, not acted on)

- `Portfoilos` and `Embeded Systems` are typos of "Portfolios"/"Embedded" as
  actual folder names; `Embeded Systems` also has a space in its path. Links
  still work (browsers auto-encode the space), so left alone to avoid breaking
  other references — rename on request.
- In the footer's `grid md:grid-cols-2` layout, the block of five portfolio
  links lands under the name/description on desktop rather than beside the
  social links, since it's the second item in a two-column grid. Flag for a
  layout decision if the current placement isn't intended.

## 2026-09-10 — sub-portfolio debug pass

Analyzed the five linked portfolio pages one by one for structural and
functional bugs (unbalanced tags, dead JS references, broken asset paths).

- **[Portfoilos/Gamer/index.html](../Portfoilos/Gamer/index.html)** — clean.
  Tags balanced, JS null-checks its DOM lookup. Content is placeholder
  ("GameVerse", `hello@example.com`, `#` social links, an inert "Play Now"
  button) rather than a bug — flagging in case it should be personalized.
- **[Portfoilos/Graphics/index.html](../Portfoilos/Graphics/index.html)** —
  clean. Tags balanced, real contact email and LinkedIn link, IntersectionObserver
  reveal animation and year-stamp script both check for their elements before use.
- **[Portfoilos/3D/index.html](../Portfoilos/3D/index.html)** — found and fixed
  one real bug: two `modelDefinitions` entries loaded
  `Low_poly_business_buildings_pack.glb`, but the actual file on disk is
  lowercase (`low_poly_business_buildings_pack.glb`). Windows' case-insensitive
  filesystem hid this locally, but it would 404 on a case-sensitive host like
  GitHub Pages, silently dropping the two "Market" building models (only a
  console error, no visible crash). Corrected the path casing to match the file.
  Noted but left alone: the `info` object carries `Future` / `'Future Sign'`
  entries that no `modelDefinitions` name ever references, so that content is
  unreachable — likely intentional placeholder for a not-yet-added model.
  Also, meshes are marked `castShadow`/`receiveShadow` but
  `renderer.shadowMap.enabled` is never set, so shadows are configured but never
  actually render — a dead/incomplete feature, not a crash.
- **[Portfoilos/AI/ML/index.html](<../Portfoilos/AI/ML/index.html>)** — clean,
  static page, tags balanced, no JS.
- **[Portfoilos/Embeded Systems/index.html](<../Portfoilos/Embeded Systems/index.html>)**
  — clean, same template as the AI/ML page, tags balanced, no JS.

## 2026-09-10 — theme/context alignment pass

Brought each sub-portfolio's branding in line with the "Imaad Yameen" identity
used everywhere else on the site, and added a way back to the hub page (none
of the five existed before):

- **Gamer** — was branded as a fictitious company "GameVerse" with a
  `hello@example.com` placeholder contact and a dead "Play Now" button (no
  href/handler). Renamed the logo/footer to Imaad Yameen, pointed the contact
  link at his real email, made "Play Now" a working link to the Projects
  section, and added a "← Portfolio" nav link back to the site root.
- **Graphics, AI/ML, Embedded Systems** — each already used real contact
  info; only added the "← Portfolio" back-link (none existed).
- **3D** — turned the "Imaad Yameen / Creative Systems" brand pill in the
  HUD into a link back to the site root.

Left untouched, flagged for the user in chat: the Gamer page's stats
("5+ Years", "20+ Games", "10K Players") and its social links (Instagram/X/
YouTube all point to "#") are still placeholder — real numbers and URLs are
needed before publishing.

## 2026-09-10 — new GIS portfolio page

Built [Portfoilos/GIS/index.html](../Portfoilos/GIS/index.html) from the
coursework the user added under `Portfoilos/GIS/` (PEW-105 Geoinformatics
tasks 1–5 plus a capstone report), and linked it from the main hub's footer
as "GIS_Portfolio" alongside the other five.

Real content pulled from the added files (nothing fabricated):

- **Capstone project** — extracted title, author, study-area table, methodology,
  and both live links directly from
  `FInal Project/KP_Marble_Slurry_Report.docx` (a Google Earth Engine app
  detecting marble-slurry contamination across 7 sites in 6 KP districts,
  using Sentinel-2 spectral indices + a Random Forest classifier + a
  2018–2026 trend model). Linked the live app, the Earth Engine script, and
  the report PDF.
- **Task 1** — identified from its ArcMap screenshot as a Pakistan population
  cartography exercise; linked its PDF.
- **Tasks 2–4** — three live Google Earth Engine apps, URLs read from each
  task's `App Link.txt` / `Links.txt` (LST vs. population, Peshawar
  multi-hazard assessment, national LULC — the LULC card also links its GEE
  script).
- **Task 5** — a Colab notebook doing regression modelling (Ridge, Lasso,
  Random Forest, Gradient Boosting) on the PEW-105 Peshawar dataset;
  identified from its own screenshot, linked from `Link.txt`.

Two path pitfalls handled: local task folders contain literal `#` characters
(e.g. `Task#1`), which would truncate an href at the `#` as a URL fragment —
percent-encoded those as `%23` in the one link that needed it. Gave the page
its own palette (emerald/sky-blue/amber) distinct from the other five
sub-portfolios, and added the same "← Portfolio" back-link used elsewhere.

Not done, needs the user's call: no screenshots or maps were embedded as
images — the page stays text-and-links like the AI/ML and Embedded Systems
pages. If preferred, the existing task screenshots and the report's
`banner.jpg`/`icon.jpg` could be added as visuals on request.

## 2026-09-10 — major restructure: per-portfolio themes + real CAD/CAM/CAE + local ML lab

The user renamed several `Portfoilos/` folders directly on disk between
sessions (adding descriptive suffixes) and dropped a large real SolidWorks
export archive into a new `CADCAMCAE/Data/SDWRKS/` folder. This broke every
link in the main hub's footer, so that was fixed first, then each
sub-portfolio was reworked per the user's direction.

- **Critical fix — dead hub links.** `Graphics` was gone, `3D` → `3D,Website
  & Graphics`, `AI` → `AI ,ML`, `Embeded Systems` → `Embeded Systems &
  Circuitry`, `GIS` → `GIS, remote sensing`. Updated every href in
  [index.html](../index.html)'s footer to the new paths (HTML-escaping `&` as
  `&amp;`), and added the new CAD/CAM/CAE entry.

- **[Portfoilos/CADCAMCAE/index.html](<../Portfoilos/CADCAMCAE/index.html>)
  — rebuilt from scratch.** Surveyed the real SolidWorks archive (66 native
  CAD files, 89 STL exports, 65 G-code CAM toolpaths) and organized it into
  featured projects with an honest narrative built from the actual file
  names and folder structure: a 2D pen plotter assembly, a 42-part desktop
  filament recycler with its planetary-gear extruder train, the filament
  gate mechanism, a PCSIR injection-mold design (tying back to the real
  SK Engineering mold-design work on the main résumé), and 3D-printed
  material test specimens, plus a smaller component gallery. Built
  [viewer.html](<../Portfoilos/CADCAMCAE/viewer.html>), a genuine in-browser
  STL viewer (Three.js + STLLoader + OrbitControls) that every "View in 3D"
  button opens on the real exported STL files — orbit, zoom, and download
  the native file all work. Verified every linked file actually exists on
  disk and that div tags balance.

- **[Portfoilos/3D,Website & Graphics/](<../Portfoilos/3D,Website & Graphics/>)
  — split and re-homed.** This folder had kept the old Three.js "3D World"
  page under a new name, while the separate Graphics "Design Terminal" page
  had vanished. Moved the 3D World experience to a new
  [world.html](<../Portfoilos/3D,Website & Graphics/world.html>) (same
  Assets folder, so nothing broke), and rebuilt `index.html` as the Graphics
  hub, now featuring a "Launch Interactive 3D World" banner card linking to
  it, with the old CAD/CAM card there repointed to the new dedicated
  CAD/CAM/CAE portfolio instead of duplicating it.

- **[Portfoilos/GIS, remote sensing/index.html](<../Portfoilos/GIS, remote sensing/index.html>)
  — globe/mapping theme.** Added a CSS-animated rotating globe with pulsing
  site-pin markers and a site legend (using the seven real cluster names
  from the capstone report), a lat/long graticule background pattern, and a
  live coordinate readout in the nav using the report's real Peshawar
  cluster coordinates. Content unchanged, all links still verified working.

- **[Portfoilos/Embeded Systems & Circuitry/index.html](<../Portfoilos/Embeded Systems & Circuitry/index.html>)
  — circuit-board theme.** Added a PCB-trace grid background, IC-chip-style
  card edges (pin marks via `::before`/`::after`), an animated signal pulse
  running along a trace divider between sections, and a blinking status LED
  next to the logo.

- **[Portfoilos/Gamer/](<../Portfoilos/Gamer/>) — soft gacha theme.**
  Replaced the neon cyberpunk palette with a pastel pink/lavender/gold one,
  swapped in "Quicksand" for headings, added floating sparkle accents in the
  hero and gacha-style "✦ SSR" rarity badges on project cards, softened
  shadows and hover motion. Structure and copy unchanged (the placeholder
  stats and dead social links flagged earlier are still open items).

- **[Portfoilos/AI ,ML/ML/index.html](<../Portfoilos/AI ,ML/ML/index.html>)
  — real local forecasting lab, built from scratch.** This was the
  substantial functional build: a genuine, fully client-side regression
  engine at
  [Assets/regression-engine.js](<../Portfoilos/AI ,ML/Assets/regression-engine.js>)
  implementing ordinary least squares linear regression, weighted least
  squares regression, and degree-2/3 polynomial regression (via a
  hand-written Gaussian-elimination solver for the normal equations) — no
  external ML library, no network calls. The page's old placeholder project
  cards were replaced with an interactive lab: an editable data table
  (X / Y / Weight, with a sample-dataset loader), a model and forecast-horizon
  picker, and a hand-rolled canvas chart rendering the training points,
  fitted curve, and forecast markers, alongside R² / RMSE / MAE and the
  fitted equation. Verified the math (OLS/WLS closed forms, polynomial
  normal equations), fixed a cosmetic double-space bug in the equation
  formatter, and confirmed error handling for degenerate inputs (fewer than
  2 points, identical x values, too few points for the chosen polynomial
  degree) — all caught and shown in the UI rather than throwing.
  Explicitly scoped by the user as a v1 "starter" — logistic regression,
  k-NN, or classification are natural next additions to the same engine
  file.

All nine affected files were re-verified to exist at their final paths after
this pass.

## 2026-09-10 — new Programming portfolio, built from real local projects

Built [Portfoilos/Programming/index.html](<../Portfoilos/Programming/index.html>)
from scratch (it existed only as an empty file) with a code-editor/terminal
visual identity — macOS-style window chrome, line-numbered syntax-highlighted
code blocks, monospace throughout — distinct from the other eight pages.
Linked it from the main hub's footer as "Programming_Portfolio".

Per the user's pointer to `D:\Yameen\programing` (one level above this git
repo), found real, substantial work to feature honestly rather than invent
placeholder projects:

- **Flagship: Farman Clothes — Atelier Ledger**, a full Python business
  application for a tailoring studio, found under
  `D:\Yameen\programing\JTC Programs\ERP PY APP`. Read its own `README.md`
  for an accurate feature list and stack (Tkinter desktop GUI + local Flask
  API, Excel-backed persistence via openpyxl, bcrypt auth, ReportLab PDF
  export, pytest tests, 5-language UI). It's a local desktop app with no
  public deployment, so it's labeled "Local Desktop App — Not Publicly
  Deployed" rather than given a fake live-demo button. Copied three of its
  real interface-design screenshots (dashboard, order registry, client
  directory — all sample/placeholder data, no real customer PII) into
  [Portfoilos/Programming/Assets/](<../Portfoilos/Programming/Assets/>) and
  captioned them as interface design previews, since they're Stitch-tool
  design output rather than confirmed pixel-for-pixel app screenshots.
- **Confirmed via the user's live GitHub profile** (fetched, not guessed):
  two public repos exist — this portfolio site itself, and a separate
  **Horizon 2026 Calendar** project (Three.js starfield, real-time UTC
  clock, 12 zodiac-themed month pages) deployed at
  `yameenimaad.github.io/Calendar`. Both are featured with real repo and
  live-demo links.
- **A real code snippet**, not a description: pulled the actual
  `weightedLinearRegression` function from this site's own
  `Portfoilos/AI ,ML/Assets/regression-engine.js` and hand-marked it up with
  VS-Code-Dark+-style syntax highlighting as proof-of-work.

Explicitly did not feature the root `package.json`'s React-Three-Fiber
dependencies (`@react-three/fiber`, `@react-three/drei`, `three`) as a
project — it's an installed `node_modules` tree with no `src/` or actual
source code behind it, so there's nothing real to show. Also did not surface
the ESP32/Arduino folders found alongside `JTC Programs` (Cheap Yellow
Display projects, a weather station, a multi-protocol gateway) — those are
embedded-systems work and a better fit for the existing Embedded Systems &
Circuitry portfolio, which still only has placeholder project cards; flagged
here rather than acted on, since it wasn't part of this request.

Verified all HTML tags balance and all three image assets resolve on disk.

## 2026-09-10 — validate.ps1: an actual test/validation script

Built [validate.ps1](../validate.ps1) in the project root — a repeatable
check instead of the ad hoc PowerShell spot-checks used earlier in this
session. Run it any time with:

```
powershell -File validate.ps1
```

It scans every `.html` file in the repo (skipping `node_modules`) and checks:

1. **`<div>` / `</div>` balance** per file (the exact bug class found in the
   original `index.html`).
2. **Every local `href`/`src` actually resolves** on disk, after decoding
   both HTML entities (`&amp;` -> `&`) and URL percent-encoding (`%20`,
   `%23`) — and flags a literal, unescaped `#` in a broken link as a likely
   cause, since that's the exact bug class fixed earlier in the GIS task
   links.
3. **The CAD viewer's `?model=...` query parameter** specifically, so a
   broken `viewer.html?model=...` reference is caught even though the file
   `viewer.html` itself exists.
4. **`mailto:` addresses** have exactly one `@` and no spaces (the exact bug
   class fixed earlier in the main page's footer).
5. A **best-effort heuristic pass** over inline `<script>` content for
   quoted strings ending in a known asset extension (`.glb`, `.stl`, `.step`,
   etc.), checked against both the HTML file's own folder and its `Assets/`
   subfolder — this is what would have automatically caught the
   `Low_poly_business_buildings_pack.glb` casing bug found earlier by hand.

While building it, hit and fixed a real Windows PowerShell 5.1 gotcha: the
first draft used em dashes in comments/strings, and `powershell -File`
reads `.ps1` files without a BOM using the system ANSI codepage by default,
which corrupted those multi-byte characters into mojibake and broke parsing.
Rewrote the script in plain ASCII to avoid the encoding trap entirely.

Also caught and fixed a bug in the validator itself: it initially flagged
the two `&amp;`-escaped footer links (`3D,Website & Graphics`,
`Embeded Systems & Circuitry`) as broken because it only undid URL
percent-encoding, not HTML-entity encoding. Added an `HtmlDecode` step and
confirmed those were false positives, not real site bugs.

Proved the script actually detects problems (not just trivially passing) by
writing a throwaway fixture file with a deliberately unclosed `<div>`, a
broken link, and an invalid `mailto:`, confirming `validate.ps1` caught all
three, then deleting the fixture. Final run against the real site: **18 HTML
files checked, 0 issues.**

## 2026-09-10 — surfaced the 7 sub-portfolios on the main page

The seven sub-portfolios (Programming, Gamer, Creative &amp; 3D, CAD/CAM/CAE,
AI/ML, Embedded Systems, GIS) were only discoverable via small uppercase
text links buried in the footer — easy to miss entirely. Added, in
[index.html](../index.html):

- A new `specialized_Portfolios.sys` section, placed right after the resume
  card near the top of the page (not at the bottom), with one clickable
  card per portfolio: icon, a distinct accent color per card (reusing the
  existing Tailwind `industrial-*` palette already defined in this file, no
  new colors added), and a one-line description naming the real substance
  behind each one (e.g. "66 real SolidWorks files, live in-browser 3D STL
  viewer" for CAD/CAM/CAE, "runs 100% locally" for AI/ML).
- A small "Explore Specialized Portfolios" button in the hero that jump-links
  down to that section, reusing the site's existing `.nav-btn` style rather
  than inventing new CSS.
- Left the original footer links in place as a secondary/redundant nav path.

Confirmed the div-tag count still balances (79 open / 79 close) and re-ran
[validate.ps1](../validate.ps1) against the whole site: 18 HTML files
checked, 0 issues — all seven new links resolve correctly.

## 2026-09-10 — AI/ML lab: added a real neural network + more lab functions

Expanded [Portfoilos/AI ,ML/Assets/regression-engine.js](<../Portfoilos/AI ,ML/Assets/regression-engine.js>)
and [Portfoilos/AI ,ML/ML/index.html](<../Portfoilos/AI ,ML/ML/index.html>)
per the user's request — still zero network calls for any computation.

- **`neuralNetworkRegression()`** — a genuine feedforward neural network (1
  input → configurable tanh hidden layer → 1 linear output), trained from a
  random initialization by full-batch gradient descent with hand-written
  backpropagation. No TensorFlow.js, no ONNX runtime, no pretrained weights
  fetched from anywhere — every weight update happens in this function, in
  the browser tab, on every run. Inputs/outputs are min-max normalized
  internally (tanh saturates outside [-1, 1] and gradient descent converges
  far more reliably on normalized data); `predict()` still takes and returns
  raw values so it's a drop-in fourth option alongside the three regressions.
  Verified the backprop gradients by hand against the standard derivation for
  MSE loss + tanh hidden + linear output before trusting it.
- **Neural network controls in the UI**: hidden-neuron count, training
  epochs, and learning rate, shown only when that model is selected, plus a
  live loss-curve sparkline (a second small canvas) and a loss readout
  showing first-epoch vs. final-epoch MSE after each training run.
- **CSV import** — the lab previously had no way to get data in besides
  typing rows one at a time or the fixed sample set. Added a paste-CSV panel
  (`x,y` or `x,y,weight` per line) that replaces the data table, parsed
  entirely client-side.
- **Clear All** button for the data table.
- **"Compare All Models On This Data"** — fits all four models (including a
  fresh neural network) on the current data in one click and renders a
  ranked table by R², with the best fit marked; any model that can't fit the
  current data (e.g. too few points for a cubic) shows its error in that row
  instead of breaking the whole comparison.

Verified: div tags balance (51/51), the whole-site `validate.ps1` still
passes (18 files, 0 issues) after these changes, and — since there's no
Node.js in this environment to actually execute the JS — cross-checked every
single `getElementById` call in the page against the HTML's actual `id`
attributes by hand (all 30 match exactly), to rule out the one failure mode
that would silently break the whole script.

## 2026-09-18 — rebuilt 3dhtml.html as a React + Three.js cartoon portfolio room

[3dhtml.html](../3dhtml.html) previously held an unused duplicate of the
industrial-terminal `index.html` layout (no 3D content despite the filename).
Rebuilt it from scratch per request: a React 18 + Three.js scene where the
main portfolio and every sub-portfolio are physical, low-poly, toon-shaded
objects placed inside a single room — walking up to (clicking) an exhibit
opens that real portfolio page.

- **Stack**: React 18 UMD + Babel Standalone (in-browser JSX, no build step —
  matches this project's no-Node.js constraint) for the UI/HUD, and Three.js
  0.160.0 (same pinned version already used by `world.html` and
  `CADCAMCAE/viewer.html`) loaded via an import map and dynamic `import()`
  inside a `useEffect`, for the scene. No bundler.
- **Cartoon look**: hand-built toon shading — a 4-step `MeshToonMaterial`
  gradient map generated on a `<canvas>`, plus a classic backface-extrusion
  outline (inverted, slightly scaled black clone parented to every mesh) for
  the cel-shaded/ink-outline look, instead of any external toon-shader
  library.
- **The room**: a pastel museum-style room (checkerboard floor via a
  generated canvas texture, three walls, a rug, a hanging lamp fixture) with
  a directional "sun" + ambient + a warm point light, soft shadows enabled.
- **8 exhibits**, each a small procedurally-built low-poly icon on a pedestal
  (no external model files — fully generated from Three.js primitives, so
  nothing to load or break): a gear+cube for CAD/CAM/CAE, a spinning globe
  with pins for GIS & Remote Sensing, a bumpy icosahedron "brain" with
  orbiting nodes for AI/ML, a mini PCB with components for Embedded Systems,
  a torus-knot sculpture for Creative & 3D, a laptop with a canvas-drawn
  `>_` screen for Programming, a game controller for Gamer, and — mounted on
  the back wall instead of a pedestal — a glowing "portal" doorway back to
  the main 2D site.
- Every exhibit's `href` was checked against the real folder names on disk
  (`Get-ChildItem`), not assumed from memory — this caught the GIS folder
  fix below before it went into the new page.
- Interaction: raycasting against invisible hotspot meshes drives hover
  (tooltip HUD showing the real one-line description reused from the main
  page's cards) and click-to-navigate, with a drag-vs-click distance check
  so rotating the camera with the mouse never accidentally fires a
  navigation.
- Added a discovery link — "Enter The 3D Room" — next to the existing
  "Explore Specialized Portfolios" button on the main `index.html` hero, so
  the page is actually reachable instead of an orphaned file.
- Note: unlike the AI/ML lab, this page is **not** offline-only — it loads
  React, Babel, and Three.js from a CDN, same as the existing `world.html`
  and `viewer.html`. It needs an internet connection the first time it's
  opened; the page shows an explicit error screen (with a link back to the
  classic 2D site) if that load fails instead of a blank screen.

**Bug found and fixed while doing this** (unrelated to the 3D room, caught
by `validate.ps1`): the `GIS` sub-portfolio folder had been renamed on disk
to `GIS & Remote Sensing`, but both `index.html`'s portfolio card and its
footer link still pointed at the old `GIS, remote sensing` path, silently
broken. Fixed both references.

**Found but not fixed** (out of scope for this task, flagged for later):
`validate.ps1` also shows ~20 broken file references inside
`CADCAMCAE/index.html` and its STL viewer — they all expect a
`Data/SDWRKS/...` path, but the `SDWRKS` folder no longer exists; the real
files now live directly under `CADCAMCAE/Data/...` (e.g.
`Data/2d plotter/...` instead of `Data/SDWRKS/2d plotter/...`). The `Data`
folder also has several unlabeled `New folder`/`New folder (2)` directories
from what looks like a mid-reorganization, so this needs the user to confirm
the intended structure before it's remapped, rather than a blind
find-and-replace of the `SDWRKS/` prefix.

Verified: bracket balance checked (curly/paren/square all matched) since
there's no JS engine to lint against, and `validate.ps1` run twice — once to
catch the GIS regression pre-existing in the repo, once after all edits,
confirming 3dhtml.html and index.html both pass with 0 issues (the only
remaining failures are the pre-existing CADCAMCAE/Data/SDWRKS paths above).

## 2026-09-18 — 3dhtml.html: real furniture, isometric camera, one room

Follow-up request: make the room look like an actual bedroom/study instead
of an abstract museum of floating icons — bed, desk + chair, a computer on
the desk, a "library" (bookcase) with a globe on top, a window, an AC unit,
lighting, a Persian carpet, and an isometric view. Also asked to browse for
real models rather than keep hand-rolling everything.

- **Sourced real furniture models.** Searched the web, found Kenney's
  "Furniture Kit" (kenney.nl/assets/furniture-kit, CC0 — public domain, no
  attribution required, verified by reading the pack's own `License.txt`).
  Downloaded the official zip directly from kenney.nl, extracted 14 pieces
  with Python's `zipfile` (git-bash's `unzip` choked on the archive; Python
  read it fine), and copied only what's used into
  [Assets/RoomKit/](../Assets/RoomKit/): bed, desk, desk chair, an open
  bookcase, books, a computer screen/keyboard/mouse, a ceiling lamp, a desk
  lamp, a wall window, a doorway, a side table, and a potted plant. Added
  [Assets/RoomKit/CREDITS.txt](../Assets/RoomKit/CREDITS.txt) documenting
  the source and license even though CC0 doesn't require it. Inspected one
  model's raw glTF JSON with a small Python script before writing any
  loading code, to confirm these use flat per-part materials (not vertex
  colors) — that determined how the toon-shading conversion needed to work.
- **Isometric camera.** Replaced the free-orbit perspective camera with an
  `OrthographicCamera` positioned along the true isometric direction
  (offset `(1,1,1)` normalized from its target — the angle that makes
  isometric "isometric," ~54.7° from vertical). `OrbitControls` is still
  attached for a little life, but its azimuth/polar range is clamped to
  roughly ±23°/±14° around that true angle so it never stops reading as an
  isometric room.
- **One real room, not a floor of pedestals.** Furniture is grounded and
  centered generically: each loaded model's own `Box3` is used to sit it
  flush on the floor (or, for the ceiling lamp, hang it from a fixed
  height) — no hardcoded per-model dimensions, since those aren't knowable
  without opening the file in a real 3D tool. Same `Box3` trick then reads
  each surface's real top height at runtime to stack things on it (monitor
  + keyboard + mouse on the desk, books on the bookcase shelf).
- **Persian carpet.** The kit's own rug is a single flat color, so instead
  the rug is a plain `PlaneGeometry` with an ornamental medallion-and-border
  pattern drawn by hand on a `<canvas>` (nested diamonds, a gold border, a
  center medallion) — fully original programmatic art, not a traced or
  photographed real carpet design.
- **AC unit and wall clock** have no equivalent in this furniture kit, so
  those stayed hand-built primitives (unchanged approach from before). The
  wall clock's hands are wired to the real Asia/Karachi time in the render
  loop, the same convention the rest of this site already uses for its live
  clocks, rather than sitting frozen at a fixed time.
- **The 8 clickable exhibits now live inside the room** instead of standing
  on their own pedestals: the computer on the desk *is* the Programming
  hotspot; the globe (hand-built, unchanged from before) sits on top of the
  bookcase for GIS; a brain sits beside it for AI/ML; a gear and a
  torus-knot sculpture sit on the desk for CAD/CAM/CAE and Creative & 3D; a
  circuit board sits on the nightstand for Embedded Systems; a game
  controller rests on the bed for Gamer Design; and the real doorway model
  (replacing the old abstract ring "portal") is the way back to the main
  site. Same hover/click/drag-vs-click interaction code as before — only
  what each hotspot points at and sits on changed.
- Removed the now-dead `buildPedestal`, `buildPortal`, `buildLaptopIcon`,
  and `makeLabelSprite` functions from the previous version instead of
  leaving them unused in the file.
- **Fixed a real gap in `validate.ps1` while doing this**: its heuristic
  script-asset check only ever looked one folder level into `Assets/`, so
  it flagged all 14 real, correctly-referenced `Assets/RoomKit/*.glb` paths
  as broken. Extended it to search one level deeper
  (`Get-ChildItem -Recurse` under `Assets/`) before reporting a miss —
  confirmed this was the right fix by first proving on disk that all 14
  files genuinely exist at the paths the page references.

Verified: bracket balance (curly/paren/square all matched), every one of
the 14 referenced `.glb` filenames cross-checked against
`Assets/RoomKit/` on disk, and a full `validate.ps1` run showing
3dhtml.html passes with 0 issues (only the pre-existing, unrelated
CADCAMCAE/Data/SDWRKS paths remain flagged). Could not visually preview the
render in this environment — furniture rotation/orientation is a best
guess per model and may need a manual tweak once seen in a real browser.

## 2026-09-18 — 3dhtml.html: fully offline, no CDN, no Babel

The user tried opening 3dhtml.html and hit its own error screen — "Could
not start the 3D room" — because it still depended on unpkg.com for React,
Babel, and Three.js. Asked to make it usable offline.

- **Vendored every library into the project.** Downloaded React 18.2.0
  (UMD production builds), Three.js 0.160.0's core module, and its
  `OrbitControls.js` + `GLTFLoader.js` addons directly from their official
  npm packages via unpkg, into [vendor/](../vendor/). Before trusting the
  loaders, grepped their own `import` statements for further dependencies —
  found `GLTFLoader.js` pulls in one more relative file,
  `addons/utils/BufferGeometryUtils.js`, which itself needs nothing beyond
  Three.js core. Downloaded that too, so the full dependency chain is
  actually closed, not just "probably fine." Documented licenses (both MIT)
  in [vendor/LICENSES.txt](../vendor/LICENSES.txt).
- **Dropped Babel Standalone entirely** rather than vendor a ~2-3MB
  in-browser JSX compiler. Hand-converted the one JSX block (the `App`
  component's render tree — HUD, hover tooltip, loading/error screens) to
  plain `React.createElement` calls. The script tag is now a genuine
  `type="module"` with real static `import` statements for `three`,
  `OrbitControls`, and `GLTFLoader` at the top, instead of the previous
  `await import(...)` calls inside `buildScene` — same libraries, just
  resolved once at module-load instead of dynamically.
- Updated the import map to point `"three"` / `"three/addons/"` at the new
  local `./vendor/three/...` paths instead of unpkg URLs — the addon files
  themselves are unmodified and still `import ... from 'three'` internally,
  which is exactly what an import map is for.
- Rewrote the loading/error screen copy: it no longer says "needs an
  internet connection," since after this change it genuinely doesn't (the
  furniture `.glb` files were already local from the previous change).
- Confirmed with `grep` that the file now contains zero `http://`/`https://`
  references anywhere — nothing left that reaches outside the project.

Verified: bracket balance (curly/paren/square all matched after the JSX
removal), `validate.ps1` full-site run still shows 3dhtml.html at 0 issues
(same pre-existing unrelated CADCAMCAE paths as before), and manually
grepped every downloaded addon file's own `import` lines to confirm no
further undeclared dependencies were missed.

One caveat worth knowing: this still requires the page to be served over
`http://`/`https://` (a local dev server, or GitHub Pages) — the ES module
imports and the GLTFLoader's `fetch()` calls for the `.glb` files are
blocked by browsers under a raw `file://` double-click, same as the
existing `world.html` and `viewer.html` already on this site. "Offline"
here means no CDN/network calls once served, matching how the rest of the
site already runs, not literally file-double-click-able.
