# Olathe Flyer Design — Handover

Three flyers, one design system, rebuilt as editable vector from the approved
12th Man sheet.

- Source: `scripts/build-olathe-flyers.mjs` → `public/templates/olathe/*.svg`
- Marks traced by: `scripts/vectorize-olathe-marks.py`
- Live as dashboard materials **45** (business), **46** (parent), **47** (district)

---

## 1. What separates ours from the approved sheet

Everything below is a DELIBERATE change. If a reviewer says "this doesn't match
the original", these are the intended reasons why.

| # | Original | Ours | Why |
|---|---|---|---|
| 1 | "HOW LOCALVIP HELPS IT GROW" | **"WHAT DOES LOCALVIP ADD"** | Asks the question a business owner is actually asking |
| 2 | Olathe West benefits / Customers can be rewarded / Your business can benefit | **Customers come back / Reward the ones you already have / Reach the wider local network** | The original argued the programme's merits — two of its three points weren't even about the business. Ours argues the operator's gain |
| 3 | "THE RELATIONSHIP CONTINUES AND THE IMPACT CAN GROW BEYOND THE DAY." | **"CHOOSE YOUR SLOWER DAY AND GIVE PEOPLE A REASON TO WALK IN WHEN YOU WANT THEM."** | Replaces a sentiment with a lever the owner controls |
| 4 | "CHOOSE YOUR GIVEBACK DAY" on every version | **Audience-specific close** (see §4) | One sheet was doing three jobs |
| 5 | "SAME COMMUNITY. / SAME GENEROSITY. / MORE WAYS TO WIN." | **"YOUR BUSINESS. / OUR COMMUNITY. / MORE WAYS TO WIN."** | The original footer said nothing changes; the business needs to see what it gets |
| 6 | QR burnt into the artwork | **Blank labelled QR zone** | Otherwise it is one flyer per campaign. The dashboard stamps the right code per school |
| 7 | Owl and apple on opaque white boxes | **Marks placed with no plate** | The white rectangles show against the #fbfbfb page |
| 8 | One sheet, Olathe West only | **Three audiences, district-wide school version** | Avoids a separate flyer per campus |

---

## 2. Shared design system — all three must match on this

**Page**: 1050 × 1500. Rounded white card on `#fbfbfb` with a thin dark edge
(`#0b1c33`, 3px, rx 18, inset 10px). Not a hard rectangular border.

**Colour**

| Token | Hex | Use |
|---|---|---|
| NAVY | `#12305c` | Panel headers, CTA band |
| GOLD | `#f7a81b` | Arrow, panel borders, rules, QR frame, SCAN ME bar |
| INK | `#12294c` | Headlines, section headers, icons |
| BODY | `#2a3c55` | Supporting copy |

**Type** — see §5 for the unresolved question.

- Headlines / section headers / CTA / footer labels — Montserrat ExtraBold (800)
- Supporting copy and labels — Montserrat Regular (400)
- Branding and emphasis — Montserrat Bold (700)

**Structure, top to bottom** — identical on all three:

1. Header lockup — mark left, org name centred as a block beside it, vertical
   divider, LOCALVIP + POWERED BY LOCALVIP right
2. Headline, two lines, centred, tight leading
3. Subtitle with short gold rules flanking it (they must NOT cross the text)
4. Two panels joined by the gold **KEEP IT GOING** arrow
   - Left — "THE GIVEBACK DAY YOU ALREADY KNOW": three steps, icon plus 2–3
     lines, small pale grey connector arrows between them
   - Right — three icons in a row with **gold dashes between them at icon
     mid-height**, labels under each, a gold bracket collecting all three, then
     an arrow down into the gold-bordered outcome box
5. Reassurance strip — mark, gold vertical rule, "NOTHING CHANGES ABOUT WHY WE
   DO THIS." plus three lines
6. Dark CTA band — QR block left (gold frame, SCAN ME bar with phone glyph),
   vertical divider, single-line headline, two rows with circled icons and gold
   underlines, starred footnote
7. Footer — three items, icon plus label, thin dividers

**Icons** — roughly 5px stroke line art, with **solid** people and chart marks.
Left column ~56px, right column ~78px. Thin 3px line icons read as unfinished;
this was a specific correction.

**Density** — no dead space. Panels end just after their content. This was the
single biggest thing making earlier drafts read weaker than the original.

---

## 3. QR zone

Blank and labelled "PLACE QR CODE HERE". The guide is inset 6px **inside** the
zone so the stamped code covers it completely — drawn on the boundary it
survives as a dashed ring around the finished QR.

Stored on materials 45/46/47 as `x 10.29 / y 81.07 / size 14.67` (percent).
Verified: the stamp lands pixel-exact on the zone.

---

## 4. Per-audience differences

| | Business (45) | Parent (46) | District (47) |
|---|---|---|---|
| Mark | Olathe West owl | Olathe West owl | Olathe Public Schools apple |
| Org line | OLATHE WEST / 12TH MAN / FOOTBALL BOOSTER CLUB | OLATHE WEST | OLATHE PUBLIC SCHOOLS |
| Right panel | Repeat visits, reward existing customers, wider network, slow-day lever | Connect, shop local, grow impact | Easy activation, local alignment, room to grow |
| CTA close | **ONGOING CONNECTION. MORE WAYS TO WIN.** | **YOUR FAMILY. MORE WAYS TO MAKE AN IMPACT.** | **YOUR SCHOOL. MORE WAYS TO GROW.** |
| Audience | Business owners | Parents and supporters | Principals, ADs, district leaders |

The district sheet is deliberately **Olathe Public Schools**, not Olathe West, so
it works across campuses without a flyer per school.

---

## 5. UNRESOLVED — the headline typeface

The stated brand spec is:

- **Bebas Neue Bold/Regular** — headlines, section headers, CTA
- **Montserrat** — supporting copy and labels
- **Montserrat Bold/SemiBold** — branding and emphasis

But the approved artwork's headline is a **wide geometric sans**, not a
condensed one — it reads as Montserrat Bold/ExtraBold. Bebas Neue is tall and
narrow, and setting the headline in it produced a visibly different letterform
from the approved sheet.

The current build uses **Montserrat ExtraBold** for headlines because that is
what the artwork looks like. **Someone needs to confirm which is correct.** If
the spec is right, the artwork was not built to it.

Also: Google Fonts ships **Bebas Neue Regular only** — there is no Bold cut. Any
"Bebas Neue Bold" must come from a licensed file or be synthesised by stroking
the glyph in its own colour.

---

## 6. Technical constraints that SHAPED the design

These are not preferences. They are hard limits of the render pipeline.

**No raster images, anywhere.** `@napi-rs/canvas` silently DROPS nested
`<image>` elements, base64 data URIs included. It does not error — it renders
nothing. A raster logo therefore looks correct in a browser preview and vanishes
from the printed flyer. This is why the marks are traced to paths, and why the
supplied photography stays on the landing page and in the video instead.

**Fonts cannot be applied to SVG text by the rasteriser.** Measured three ways —
base64 `@font-face`, a CSS class in `<style>`, and a `font-family` attribute with
`GlobalFonts.registerFromPath`. All three render as fallback. Browsers DO honour
the embedded `@font-face` (verified: `MontRegular`, `MontBold`, `MontXBold` all
report `loaded`).

> **Consequence — still an open blocker.** The template previews correctly in a
> browser, but the QR-stamped OUTPUT goes through the rasteriser and comes out in
> fallback fonts. Options: stamp the QR in a browser-based renderer,
> pre-rasterise at print resolution with fonts baked in, or convert all text to
> paths at build time.

> **Do not judge these flyers from server-rendered PNGs** — they show fallback
> fonts. Use a browser. Several rounds of rework were wasted on exactly this.

**Trace quality.** `vectorize-olathe-marks.py` paints regions
**largest-area-first**, not lightest-first. Painting light-to-dark buried the
white eye highlights under the navy surrounding them and turned the owl into a
grey blob. It also upsamples 4× and median-blurs the anti-alias halos before
k-means, otherwise the clusters describe edge blends instead of the real palette.

---

## 7. Known gaps against the approved sheet

Honest list of what is still not identical:

- **Icons are reconstructions**, matched for weight and silhouette, not the
  original icon files. If the source icons exist they should drop straight in.
- **Headline typeface** — see §5.
- The final density pass (subtitle rules, panel and CTA tightening) shipped
  without a fresh visual check. The numbers are sound; it has not been eyeballed.

---

## 8. Rebuild

```bash
python scripts/vectorize-olathe-marks.py
```

```bash
node scripts/build-olathe-flyers.mjs
```

Run the trace step only if the source marks change.

Fonts live at `public/templates/olathe/fonts/` — Montserrat 400/700/800 and
Bebas Neue Regular, all SIL OFL and legal to embed and redistribute.

The original approved raster artwork is in the same folder as `*.png`. It has the
correct look, but the pre-revision copy and the white-plated logos.
