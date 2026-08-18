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
| 9 | "MAKE ONE GIVEBACK DAY / THE START OF SOMETHING BIGGER." + "Bring in your community." | **"MAKE YOUR SLOWEST DAY / THE ONE THEY COME BACK FOR."** + "You pick the day you want busier. LocalVIP helps you give local families an additional reason to choose you — and to come back." | The original headline was the school ASKING the business for something. Now leads on the lever the owner controls, matching what the right panel promises |
| 10 | Reassurance: "You're still supporting Olathe West and helping our kids." | **"NOTHING CHANGES ABOUT HOW YOU RUN YOUR BUSINESS."** (business sheet only) | That is why the SCHOOL does this. Correct on the parent and district sheets; on a business flyer it answers a question the owner never asked |
| 11 | Owl repeated in the reassurance strip | **Heart with OW inside** (Olathe West sheets) | The owl already appears in the header a few inches above |

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
| Headline | MAKE YOUR SLOWEST DAY / THE ONE THEY COME BACK FOR. | YOUR NEXT LOCAL PURCHASE / CAN SUPPORT OLATHE WEST. | TURN COMMUNITY TRUST / INTO REPEATABLE LOCAL SUPPORT. |
| Reassurance mark | Heart with OW | Heart with OW | District apple |
| Reassurance | NOTHING CHANGES ABOUT HOW YOU RUN YOUR BUSINESS. | NOTHING CHANGES ABOUT WHY WE SHOW UP. | YOU KEEP THE RELATIONSHIPS. WE ADD THE ENGINE. |
| CTA close | **ONGOING CONNECTION. MORE WAYS TO WIN.** | **YOUR FAMILY. MORE WAYS TO MAKE AN IMPACT.** | **YOUR SCHOOL. MORE WAYS TO GROW.** |
| Audience | Business owners | Parents and supporters | Principals, ADs, district leaders |

The district sheet is deliberately **Olathe Public Schools**, not Olathe West, so
it works across campuses without a flyer per school.

---

## 4b. COPY RULE — the reader acts, LocalVIP helps

The single most common defect in this collateral, and the one that keeps
creeping back. Copy inherited from the approved sheet is written in the
**school's** voice, because that is who commissioned it. On the business flyer
that voice argues the wrong side.

**The rule: the reader is the one doing the thing. LocalVIP helps.**

| Wrong | Right |
|---|---|
| "LocalVIP gives local families a reason to choose you" | "LocalVIP **helps you give** local families an **additional** reason" |
| "LocalVIP makes it easier for everyday local choices to create value" | "LocalVIP helps **the choices you already make** go further" |
| "Bring in your community" (asks the business for effort) | "You pick the day you want busier" (the owner's lever) |
| "Help our community keep winning" (asks, and is vague) | "LocalVIP helps those everyday choices do more for Olathe West" |

"Additional" is load-bearing. A business with regulars already has reasons
people choose them; claiming to supply *the* reason overstates it.

**Also: make no claim about prices, margins or cost.** The business funds the
cashback it advertises, so "keep your margins" would be false. "Nothing changes
about how you run your day" is both true and the thing an owner is actually
wary of changing.

**Where each voice is correct:**

- "Supporting Olathe West and helping our kids" — right for **parents** and
  **district**, wrong for **business**
- The district sheet already passes: "You keep the relationships. We add the
  engine." / "Your school remains at the center."

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
- **The OW heart is COMPOSED, not official.** The owl and the district apple are
  traced from real marks; the heart-with-OW is built from a heart glyph plus
  lettering because no official asset was supplied. If a real one turns up,
  trace it and swap it in.
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

---

## 9. BRIEF — two more sets, from the six reference options

Six reference designs supplied 2026-08-18. What to take, and the decision that
gates the work.

### 9.1 BLOCKING DECISION — photography

Two of the six references (Option 2 in both sets) are **photo-led heroes**:
team on the field, crowd under lights, families with the OW flag. Set 2 Option 3
also uses a photo strip.

**These cannot be built as SVG templates.** `@napi-rs/canvas` drops nested
`<image>` elements silently (§6) — the hero would render blank in the stamped
output while looking perfect in a browser preview. This is not a styling
problem; it is the same failure that already cost several rounds.

Pick one before designing:

| Option | Consequence |
|---|---|
| **A — keep SVG templates** | No photography. Vector/illustrative only. Everything works today, QR stamping unchanged |
| **B — browser-based render** | Photography works, full design freedom. Requires replacing the QR stamp path with a headless-browser renderer |
| **C — pre-rasterised PNG templates** | Photography works, QR stamping works today (PNG templates already render — the original artwork does). Cost: no longer editable vector, and text is baked in |

**C is the pragmatic answer if photography matters**, because PNG source
templates already stamp correctly — that is exactly how the original approved
artwork worked before the vector rebuild.

### 9.2 What is worth taking from the references

Ranked by how much they add:

1. **Numbered step badges** (`01 02 03`) with connecting arrows — Set 2 Opt 1.
   Clearer sequence than the current unnumbered icon rows.
2. **The comparison block** — "TRADITIONAL GIVEBACK DAYS **vs** WITH LOCALVIP",
   Set 2 Opt 1. The single strongest idea in the six: it makes the *delta*
   explicit rather than describing the programme. Fits our two-panel structure
   directly.
3. **The three-circle benefit diagram** — Olathe West / Customers / Your
   business, Set 2 Opt 2. Shows the three-way split better than a row of icons,
   and matches how the economics actually work.
4. **Four-column icon row** with a wide gold band beneath — Set 1 Opt 3.
5. **Handwritten script accents** — "Let's work together!", "We'll handle the
   promotion. You focus on your business." Warmth without extra copy. Needs a
   script face (Caveat / Kalam are OFL) added to the embedded set.
6. **Gold CTA block** rather than navy — Set 1 Opt 2. Higher contrast on the
   action.
7. **Torn-paper section edges** — Set 1 Opt 2. Cheap in SVG, adds texture.
8. **"LOCAL VIP" with the map-pin O** — appears in all six. Confirm whether this
   is the current brand lockup; our sheets use plain LOCALVIP.

### 9.3 Copy angles worth keeping

These reference headlines are stronger than what we shipped and follow §4b:

- "YOU KNOW GIVEBACK DAYS. **THIS ONE WORKS HARDER.**" — leads from what they
  already do
- "YOU'VE GIVEN BACK TO OUR KIDS. **NOW GIVING BACK CAN GIVE BACK TO YOU.**" —
  reciprocity; strongest emotional angle of the six
- "**BUSINESSES LIKE YOURS MAKE OUR COMMUNITY STRONGER.**" — flattery-led open
- "SAME GENEROSITY. **BETTER ECONOMICS.**" — best sub-head in the set

Note "GENEROSITY SHOULDN'T BE ONE-WAY" (Set 2 Opt 2) — the clearest statement of
the business case anywhere in the references.

### 9.4 Open question

"Two more sets" is ambiguous. A set has meant *three audiences*
(business / parent / district). The references are *three visual options for one
audience*. Confirm which before building — the difference is 6 flyers versus 6
variants of the business sheet.

---

## 10. SOLVED — high-quality PNG rendering with real fonts

Decision taken 2026-08-18: **move off SVG-as-the-deliverable to high-quality
PNG.** This resolves §6 entirely.

Headless Chrome renders the embedded `@font-face` correctly, unlike
`@napi-rs/canvas`. Rendering the SVG through Chrome produces a print-resolution
PNG with real Montserrat, and PNG templates already stamp QR codes correctly.

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu \
  --hide-scrollbars --force-device-scale-factor=2 --window-size=1050,1500 \
  --default-background-color=ffffff \
  --screenshot=out.png "file:///ABSOLUTE/PATH/TO/flyer.svg"
```

Output: **2100 × 3000** PNG. Raise `--force-device-scale-factor` to 3 or 4 for
larger print sizes. The SVG stays as the editable source; PNG becomes the
artifact that ships.

**This also unblocks photography** (§9.1 option C) — a Chrome-rendered template
can contain photos, because the drop only happens in the napi-rs rasteriser.

### 10.1 Defects this immediately exposed

The fallback font was NARROWER than Montserrat, so it hid these. All four are
real and must be fixed before the PNGs ship:

1. **Right-panel labels collide** — "Reward the ones" and "Reach the wider" run
   together as "oneReach". The three columns are spaced for the narrower
   fallback; they need wider gutters or shorter labels.
2. **Reassurance heading overflows the page** — "NOTHING CHANGES ABOUT HOW YOU
   RUN YOUR BUSINESS." runs off the right edge. Needs a smaller size, a `fit`
   width, or a two-line break.
3. **Subtitle is far too small** relative to the headline now that both render
   properly.
4. **The SCAN ME phone glyph renders as tofu** (□). It is a text glyph, not a
   path — replace it with the vector `phone` glyph already in `G`.

**Every previous layout judgement in this document was made against the fallback
font and is therefore suspect.** Re-check spacing decisions from a Chrome render,
not from a napi-rs PNG.
