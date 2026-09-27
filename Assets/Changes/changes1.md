# Changes Log — Certifications & CV Added to Sub-Portfolios

**Task:** "analyze all and add the relevant certifications and cv in other portfolios as well" — extend the Certifications + CV pattern already used on the root `index.html` and `Assets/resume/cv.html` into each of the field-specific sub-portfolios, filtering the 67 real certifications from `Assets/PDF Files/Imaad_Yameen_Certifications.pdf` down to what's actually relevant per field.

**Scope decision:** Applied to the 6 professional/technical portfolios only — **AI & ML, CADCAMCAE, 3D & Graphics Designer, Embedded Systems & Circuitry, GIS & Remote Sensing, Programming**. Skipped **Gamer** (personal, non-professional) and **Claude Code** (an AI-collaboration changelog, not a skills portfolio) since a certifications/CV section wouldn't fit either page's purpose.

Every added section:
- Matches that portfolio's own existing visual design system (its own card/grid classes, colors, fonts) rather than a generic bolted-on block.
- Links to `../../Assets/resume/cv.html` (opens in a new tab) with the label "View full CV & all certifications →".
- Was added as a new nav-bar link and a new `<section>` placed just before the page's Contact section.

## AI & ML (`Portfoilos/AI & ML/index.html`)
Added `#certifications` section using the existing `.row` / `.card` grid. 6 certs:
- Fundamentals of Deep Learning — NVIDIA (Dec 2025)
- AI for Beginners — HP LIFE (Aug 2025)
- Critical Thinking in the AI Era — HP LIFE (Jun 2026)
- Image Generation with AI Training Course — Simplilearn (Nov 2025)
- Generative AI Content Creation — Adobe (Jul 2025)
- Python Application Development — MindLuster (Aug 2026)

## CADCAMCAE (`Portfoilos/CADCAMCAE/index.html`)
Added `#certifications` section (numbered "04", following the page's existing 01/02/03 pattern) using the `.gallery-grid` / `.gallery-card` style. 6 certs:
- SLA 3D Printing — Sinterit (May 2026)
- Solidworks MasterClass — BGMC Group (Feb 2026)
- SOLIDWORKS Advanced Sketching & Reference Geometry — Dassault Systèmes (Jan 2026)
- SOLIDWORKS Foundations: Sketching & Extrusion — Dassault Systèmes (Jul 2025)
- FEM — Linear, Nonlinear Analysis & Post-Processing — Coursera (Jun 2025)
- 3D Printing — HP LIFE (Mar 2025)

## 3D & Graphics Designer (`Portfoilos/3D & Graphics Desginer/index.html`)
Added `#certifications` section (numbered "04", following 01/02/03) using the `.glass-card` grid. 6 certs:
- SLA 3D Printing — Sinterit (May 2026)
- 3D Printing — HP LIFE (Mar 2025)
- Image Generation with AI Training Course — Simplilearn (Nov 2025)
- Generative AI Content Creation — Adobe (Jul 2025)
- Create an Infographic in Canva — Coursera (Jul 2024)
- Create a Promotional Video using Canva — Coursera (Jun 2024)

## Embedded Systems & Circuitry (`Portfoilos/Embeded Systems & Circuitry/index.html`)
Added `#certifications` section using the `.card.chip` style, forced to a 2-column row instead of 3. **Only 2 certs shown, deliberately** — the 67-certification list has genuinely little that's specific to embedded/hardware work, and padding it out with unrelated certs would misrepresent the list. The section says so explicitly on the page:
- How to Get Into Robotics — University of Leeds (Jul 2025)
- Python Application Development — MindLuster (Aug 2026) — noted as used for MCU scripting & data logging

## GIS & Remote Sensing (`Portfoilos/GIS & Remote Sensing/index.html`)
Added `#certifications` section using the `.row` / `.card` grid. 6 certs:
- Fundamentals of Open Source GIS — MindLuster (Aug 2026)
- Climate Risk Screening for Development Planning — Pakistan Engineering Council (Sep 2026)
- Climate Risk Assessment & Resilience Planning — National Productivity Organization (Aug 2026)
- SDG Indicators Under FAO Custodianship — FAO (Aug 2026)
- Drones for Environmental Science — Duke University (Jul 2025)
- Life Cycle Assessment — National Productivity Organization (Aug 2026)

## Programming (`Portfoilos/Programming/index.html`)
Added `#certifications` section (numbered "05_certifications", following the page's existing 01–04 pattern) styled as a terminal window (`cat certifications.txt`) to match this portfolio's unique code-editor aesthetic, instead of generic cards. 4 certs:
- Python Application Development — MindLuster (Aug 2026)
- HTML — Sololearn (Sep 2022)
- Becoming an SAP Professional — SAP (Jul 2025)
- Build a Free Website with WordPress — Coursera (Jun 2024)

## Verification
- Ran a tag-balance check (`div`, `section`, `article`, `p`, `h2`, `h3`, `h4`, `a`) across all 6 edited files — all balanced, no mismatches.
- Ran `Validation & Testing/qc_report.ps1` — same pre-existing 21-defect baseline (19 Critical CADCAMCAE broken STL/SLDPRT links pending the user's own CAD folder reorg, 2 Minor heuristic false positives). No new defects introduced by these changes.
- Every `../../Assets/resume/cv.html` link resolves correctly from each portfolio's 2-levels-deep location.

## Not committed/pushed
Per earlier instruction in this session ("i will push it myself"), these changes were left uncommitted for the user to review and push themselves.
