---
name: Roadmaps
description: Dark drafting-table learning sites where the dependency graph is the drawing and one blue means "act here".
colors:
  ink-black: "#0b0e14"
  ink-black-2: "#0e1219"
  graphite-panel: "#151a23"
  graphite-panel-2: "#1b2130"
  hairline: "#242b38"
  hairline-strong: "#303948"
  paper-white: "#e7ebf3"
  paper-soft: "#c3cad6"
  slate-muted: "#8f99ab"
  cornflower-signal: "#5ea3ff"
  cornflower-lift: "#7bb3ff"
  blueprint-blue: "#3178c6"
  pass-green: "#3dd68c"
  fail-coral: "#ff6b6b"
  warn-amber: "#f5b942"
  python-yellow: "#ffd43b"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Inter, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 7.2vw, 5.4rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
    fontVariation: "'opsz' 96"
  headline:
    fontFamily: "Bricolage Grotesque, Inter, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 5vw, 3.2rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque, Inter, system-ui, sans-serif"
    fontSize: "1.55rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.1em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
  section: "3.5rem"
components:
  button-primary:
    backgroundColor: "{colors.cornflower-signal}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1rem"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.cornflower-lift}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1rem"
  button-secondary:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1rem"
  button-secondary-hover:
    backgroundColor: "{colors.graphite-panel-2}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1rem"
  cta:
    backgroundColor: "{colors.cornflower-signal}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 1.5rem"
  cta-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 1.5rem"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.pill}"
    padding: "0.35rem 0.9rem"
  chip-selected:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.pill}"
    padding: "0.35rem 0.9rem"
  badge-passed:
    backgroundColor: "rgba(61, 214, 140, 0.08)"
    textColor: "{colors.pass-green}"
    rounded: "{rounded.pill}"
    padding: "0.2rem 0.6rem"
  badge-attempted:
    backgroundColor: "rgba(245, 185, 66, 0.08)"
    textColor: "{colors.warn-amber}"
    rounded: "{rounded.pill}"
    padding: "0.2rem 0.6rem"
  badge-todo:
    backgroundColor: "transparent"
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.pill}"
    padding: "0.2rem 0.6rem"
  problem-card:
    backgroundColor: "{colors.ink-black-2}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.lg}"
    padding: "1.25rem 1.5rem 1.5rem"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.sm}"
    padding: "0.45rem 0.8rem"
  nav-link-active:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.sm}"
    padding: "0.45rem 0.8rem"
  progress-pill:
    backgroundColor: "transparent"
    textColor: "{colors.pass-green}"
    rounded: "{rounded.pill}"
    padding: "0.3rem 0.75rem 0.3rem 0.6rem"
---

# Design System: Roadmaps

Covers both apps, `apps/ts-roadmap` and `apps/py-roadmap`. They share one stylesheet; the only divergence is the brand mark color, noted under Colors.

## Overview

**Creative North Star: "The Lit Blueprint"**

The site is a dark drafting table and the dependency graph is the drawing on it. Everything else exists to keep that drawing legible: four steps of near-black grey for surfaces, hairline borders instead of shadows, and one cornflower blue that is spent only where the learner should act next. The graph literally draws itself on arrival, edge by edge, top to bottom, and that is the one authored moment. Nothing else moves for its own sake.

Density is medium and reading-first. Content columns cap at 780px for prose and 1040px for the shell. The display face, Bricolage Grotesque at its widest optical size, gives headings a slightly engineered, technical-drawing character that Inter's body text does not compete with. Code is a first-class citizen, so the mono face appears inline in headings and prose without apology.

Dark is the home scheme and the one the tokens are authored in; the light theme re-points every role rather than restyling anything. Motion is a stroke tool, not a mood. Route changes lift content in with a short stagger, test results slide in one by one, a passing badge springs, the progress counter counts. All of it is skipped under reduced motion. The system rejects gradients as decoration, glassmorphism beyond the sticky nav's blur, and any colored surface that is not a status.

**Key Characteristics:**
- Four-step tonal dark palette; borders separate, shadows almost never.
- One accent blue, rationed to "act here" and "this is next".
- Three status colors that mean exactly one thing each: green passed, amber in progress, coral failed.
- Bricolage Grotesque display over Inter body over JetBrains Mono code.
- Pills for anything clickable and small; 12 to 16px corners for containers.
- The graph draws itself; everything else moves only in response to the learner.

## Colors

A near-black blue-grey ramp with one signal blue and three status hues, all tuned for a dark scheme only.

### Primary
- **Cornflower Signal** (#5ea3ff): links, the primary button, the hero CTA, the "next up" graph node stroke, the focus ring, and the highlighted word in the hero headline. It means "act here". Lifts to **Cornflower Lift** (#7bb3ff) on hover.
- **Blueprint Blue** (#3178c6): the TypeScript brand mark and the faint radial glow behind the hero at 22% alpha. Never used for interactive elements. The Python app swaps the mark to a blue-on-yellow chip using **Python Yellow** (#ffd43b) on the same Blueprint Blue.

### Neutral
- **Ink Black** (#0b0e14): page background and the text color on blue buttons.
- **Ink Black 2** (#0e1219): the exercise card, playground output, table headers. One step above the page.
- **Graphite Panel** (#151a23): panels, code blocks, the editor, nav hover and active state, graph nodes. The workhorse surface.
- **Graphite Panel 2** (#1b2130): hover state for panels and graph nodes. The lightest surface.
- **Hairline** (#242b38): default 1px border on every container and divider.
- **Hairline Strong** (#303948): buttons, ghost CTA, kbd caps, focused editor, and the graph's undone edges.
- **Paper White** (#e7ebf3): headings, primary text, the selected filter chip's fill.
- **Paper Soft** (#c3cad6): article body and exercise descriptions. Reading text is one step below heading text on purpose.
- **Slate Muted** (#8f99ab): secondary text, labels, inactive nav, breadcrumbs, hints.

### Status
- **Pass Green** (#3dd68c): passed badges, completed nodes and edges, the progress pill, done modules in the sidebar.
- **Warn Amber** (#f5b942): in-progress badges and playground warnings.
- **Fail Coral** (#ff6b6b): failed test rows and error output. Only ever paired with the X icon.

### Light theme
The same roles re-pointed for a light scheme, selected by `data-theme="light"` on the root element and persisted in `localStorage.theme`. The boot script in `index.html` sets it before first paint from storage or `prefers-color-scheme`. Surfaces invert their order: page **#f4f6f9**, lifted card and output **#ffffff**, panel **#eaeef4**, panel hover **#dfe5ee**; borders **#d5dbe5** and **#bfc8d6**; text **#121722**, reading text **#2c3546**, muted **#5b6676**. The accent deepens to **#2f6fd6** (hover **#4a84e3**) with white text so it passes contrast on pale surfaces. Status deepens the same way: green **#158f5a**, amber **#a86b00**, coral **#d43d3d**. Nav blur, hero glow, selection, CTA glow, and the card shadow each have a light variant token; nothing else changes. The Monaco theme swaps to a `vs` base with the panel color as its background.

### Named Rules
**The One Signal Rule.** Cornflower Signal appears on at most one primary action per viewport plus links and the next node. If two things are blue, one of them is wrong.

**The Status Is Not Decoration Rule.** Green, amber, and coral only ever report the state of the learner's work. No green headings, no amber highlights, no coral warnings in prose.

**The Tint, Don't Fill Rule.** Status backgrounds are the status color at 8% alpha with a 40% alpha border, never a solid fill. Text carries the color.

## Typography

**Display Font:** Bricolage Grotesque (with Inter, system-ui)
**Body Font:** Inter (with system-ui, -apple-system, Segoe UI)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, Menlo, Consolas)

**Character:** Engineered but warm. Bricolage at optical size 96 has quirky ink traps and a compact width that reads like lettering on a drawing sheet; Inter underneath is invisible in the good way. The mono face is loaded once and used everywhere code or a number-as-identifier appears, including inside headings.

### Hierarchy
- **Display** (800, clamp(2.6rem, 7.2vw, 5.4rem), 1.02, -0.035em, opsz 96): the home hero only. One word is colored Cornflower Signal.
- **Headline** (700, clamp(2.1rem, 5vw, 3.2rem), 1.1, -0.02em): page and module titles.
- **Title** (700, 1.55rem article h2 / 1.6rem section h2 / 1.15rem module card title): section breaks inside articles and the Try it / Exercises sections.
- **Body** (400, 16px, 1.65): article prose in Paper Soft, max 780px column. The hero lead runs at 1.15rem and hub leads at 1.1rem in Slate Muted, capped at 62ch.
- **Label** (600, 0.72rem to 0.8rem, 0.1em tracking, uppercase): sidebar summary and stage headings on the Learn page. Slate Muted only.
- **Mono** (400 to 500, 13.5px in blocks, 0.88em inline): code blocks, inline code, test output, module numbers, kbd caps.

### Named Rules
**The Balanced Heading Rule.** Every h1 to h3 uses `text-wrap: balance`, negative tracking, and zero margin by default. Spacing is applied by the parent, never the heading.

**The Tabular Number Rule.** Any count that can change (progress, exercise totals, pager positions) uses tabular figures so it never shifts layout when it updates.

## Layout

Single centered column at 1040px with 1.25rem side gutters. Pages with a sidebar widen to 1320px and split into a 240px sticky module list plus a fluid main column with a 3rem gap. Reading content inside main caps at 780px; the hero caps at 820px; the roadmap graph at 1000px.

The sticky nav is 60px tall and blurs the page behind it at 82% Ink Black. The sidebar sticks 76px from the top and scrolls internally.

Vertical rhythm is rem-based and generous: 3.5rem between the article and the Try it and Exercises sections, 4rem above the Next footer, 2.75rem above article h2s, 1rem between paragraphs. The hero pads 5.5rem above and 3rem below.

Below 900px the sidebar becomes a collapsible details block above the content, the brand name and progress denominator hide, keyboard hints hide, the graph scrolls horizontally with a 760px minimum width, and module cards drop their third column so meta stacks under the summary.

## Elevation & Depth

Tonal layering does the work. Four dark surfaces (Ink Black, Ink Black 2, Graphite Panel, Graphite Panel 2) plus two hairline strengths express every level from page to hovered panel. Shadows exist in exactly two places: under the exercise card, so the thing the learner types into sits slightly proud of the page, and as a soft blue glow under the hero CTA.

### Shadow Vocabulary
- **Card lift** (`box-shadow: 0 8px 24px -12px rgba(0,0,0,0.6), 0 2px 6px -2px rgba(0,0,0,0.4)`): the exercise problem card only.
- **CTA glow** (`box-shadow: 0 6px 20px -8px rgba(94,163,255,0.7)`): the hero primary CTA only.
- **Focus ring** (`box-shadow: 0 0 0 2px #0b0e14, 0 0 0 4px #5ea3ff`): every focusable element, drawn as a double ring so it reads on any surface. Inset variant on list rows.
- **Current marker** (`box-shadow: inset 2px 0 0 #5ea3ff`): the active module in the sidebar.

### Named Rules
**The Two Shadows Rule.** New surfaces get a hairline border and a tonal step, not a shadow. The exercise card and hero CTA are the only lifted objects.

## Shapes

Two families. Anything small and clickable is a full pill (999px): buttons, the CTA pair, filter chips, status badges, the progress pill. Anything that contains content is softly rounded: 8px for nav links, sidebar rows, and focus rings; 12px for code blocks, the editor, the output pane, and exercise list containers; 16px for the exercise card. Graph nodes are 176 by 46 rectangles with a 12px radius. Inline code takes 6px, kbd caps 5px with a heavier bottom border for a keycap feel.

Borders are always 1px Hairline at rest, stepping to Hairline Strong for interactive edges and to Cornflower Signal on hover or focus. No dashed borders, no double borders, no border-only accents in other hues.

Icons are one stroke family: 24-unit viewBox, 2px round-capped strokes, `1em` square, sitting at `-0.15em` on the baseline. Filled shapes are limited to the play triangle and the in-progress dot.

## Components

### Buttons
- **Shape:** full pill (999px), 0.5rem by 1rem padding, 600 weight at 0.9rem, icon plus label with a 0.45rem gap.
- **Primary:** Cornflower Signal fill, Ink Black text and border. Hover lifts to Cornflower Lift. Used for Run and Run tests.
- **Secondary:** Graphite Panel fill, Paper White text, Hairline Strong border. Hover swaps to Graphite Panel 2 and a blue border. Used for Reset.
- **Active / Disabled:** active scales to 0.98. Disabled drops to 60% opacity, sets a progress cursor, and spins its icon at 0.8s linear.
- **Hero CTA:** the primary shape at 0.85rem by 1.5rem with the CTA glow; hover raises it 1px and nudges the arrow 3px right. Its ghost sibling is transparent with a Hairline Strong border that turns blue on hover.

### Chips
- **Style:** pill, 0.35rem by 0.9rem, 500 weight at 0.9rem, Hairline border, Slate Muted text.
- **State:** hover brightens text to Paper White and the border to Hairline Strong. Selected inverts to a Paper White fill with Ink Black text. Used only as status filters on the Exercises page.

### Badges
- **Style:** pill, 0.2rem by 0.6rem, 600 weight at 0.75rem, icon plus word.
- **Passed:** Pass Green text, 40% green border, 8% green tint, check icon.
- **In progress:** Warn Amber text, 40% amber border, 8% amber tint, dot icon.
- **To do:** Slate Muted text, Hairline border, no icon.

### Cards / Containers
- **Exercise card:** 16px corners, Ink Black 2 fill, Hairline border, 1.25rem by 1.5rem padding, card lift shadow. Holds the title with its badge, description, editor, action bar, and results.
- **Exercise list:** 12px corners, Graphite Panel fill, Hairline border, rows separated by Hairline, rows hover to Graphite Panel 2.
- **Code block / editor / output:** 12px corners, Graphite Panel fill (output uses Ink Black 2), Hairline border, 1rem by 1.25rem padding, mono at 13.5px. The editor is 200px tall and shows a mono "Loading editor…" placeholder while Monaco boots.
- **Module list:** no container; rows separated by Hairline, each a three-column grid of mono zero-padded number, title plus summary, and meta.

### Inputs / Fields
The only input is the Monaco editor. Its container border steps from Hairline to Hairline Strong on focus-within. The editor theme is vs-dark with the background pinned to Graphite Panel so it sits flush with its frame.

### Navigation
- **Top bar:** sticky, 60px, blurred Ink Black at 82%, Hairline bottom border. Brand is a 26px rounded mark plus the word Roadmap in the display face. Links are Slate Muted at 0.95rem, 500 weight, 8px corners, hover and current state fill Graphite Panel and brighten to Paper White. A progress pill in Pass Green sits at the far right.
- **Sidebar:** uppercase label summary, then a list of module rows at 0.9rem in Slate Muted. Done rows turn green, the current row fills Graphite Panel with a 2px blue inset marker on the left. Below 900px it collapses into a bordered details block with a chevron.
- **Breadcrumbs:** Slate Muted at 0.9rem with a slash separator.
- **Next footer:** Hairline top border, "Next up" label in Slate Muted, then bold blue links with a right arrow. On exercise pages it becomes a two-sided pager with title over module name.

### Roadmap Graph
The signature component. An SVG layered DAG at 960 units wide: one row per dependency level, 104 units apart, nodes spread evenly across each row. Nodes are Graphite Panel rectangles with a Hairline stroke and Paper White 14px label; hover brightens to Graphite Panel 2 with a blue stroke; the next module carries a 2px blue stroke at rest; done modules get a green stroke and a green check disc in the corner. Edges are 2px cubic beziers in Hairline Strong, turning 55% green once their source module is done. On page load edges draw from a `pathLength` of 1 and nodes rise 10px into place, staggered top to bottom over about 0.8s.

### Motion
Easing everywhere is `cubic-bezier(0.2, 0.7, 0.2, 1)` in CSS and `power3.out` in GSAP. CSS transitions run 0.15s for color and border, 0.2s for transforms. GSAP handles entrances: route content rises 14px with a 0.06s stagger; results rows rise 6px with a 0.05s stagger over 0.35s; a changed badge scales from 0.6 with `back.out(2.5)`; counters tween with snapping. Every GSAP entrance is skipped when `prefers-reduced-motion: reduce` matches.

## Do's and Don'ts

### Do:
- **Do** separate surfaces with a 1px Hairline border and one tonal step, not a shadow.
- **Do** put every small clickable thing in a full pill and every content container in 12px or 16px corners.
- **Do** spend Cornflower Signal on one primary action per view, plus links and the next graph node.
- **Do** set counts in tabular figures and let changing numbers tween rather than snap.
- **Do** keep reading text in Paper Soft and headings in Paper White.
- **Do** guard every entrance animation with a reduced-motion check.
- **Do** make the same shell change in both apps; the stylesheet is shared by copy.

### Don't:
- **Don't** introduce a second accent hue. Blueprint Blue is a brand mark and a background glow, not an interactive color.
- **Don't** use green, amber, or coral for anything other than the state of the learner's work.
- **Don't** add shadows to panels, lists, code blocks, or nav. The exercise card and hero CTA are the only lifted objects.
- **Don't** fill status badges solid. Tint at 8%, border at 40%, color the text.
- **Don't** add hover motion to graph nodes or list rows beyond a color or stroke change.
- **Don't** hard-code a color outside the token block. Both themes must stay complete; a new color gets a dark and a light value or it does not ship.
