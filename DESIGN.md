---
name: Roadmaps on Akashi
description: The ten roadmap sites on the Akashi design system, with one identity colour per language and a monochrome shell.
colors:
  paper: "#fafafa"
  surface: "#ffffff"
  ink: "#191919"
  muted: "#6d6d6d"
  line: "#dedede"
  lead: "#4c4c4c"
  mention-surface: "#ededed"
  hover-fill: "#efefef"
  ok: "#137a4a"
  warn: "#8a5a00"
  fail: "#c0392b"
darkColors:
  paper: "#111111"
  surface: "#191919"
  ink: "#ededed"
  muted: "#9e9e9e"
  line: "#2b2b2b"
  lead: "#c2c2c2"
  mention-surface: "#262626"
  hover-fill: "#222222"
  ok: "#3dd68c"
  warn: "#f5b942"
  fail: "#ff6b6b"
typography:
  display:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: "clamp(40px, 4.5vw, 72px)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: "clamp(40px, 4.5vw, 56px)"
    fontWeight: 500
  title:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: "clamp(24px, 2.25vw, 32px)"
    fontWeight: 500
    lineHeight: 1.22
  wordmark:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontWeight: 700
  chip:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontWeight: 700
  body:
    fontFamily: "'Manrope', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "'Manrope', sans-serif"
    fontSize: "14px"
    fontWeight: 500
  mono:
    fontFamily: "'DM Mono', monospace"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  mention: "5px"
  command: "11px"
  button: "13px"
  card: "17px"
---

# Design System: Roadmaps on Akashi

The ten roadmap sites share one design system, `packages/akashi` (`@roadmaps/akashi`). This file covers only what the roadmaps add to Akashi. For the base rules (palette roles, type scale, surfaces, focus, motion) read `~/personal/viz/packages/design-system/DESIGN.md`.

## 1. Overview

The base is Akashi. Its `tokens.css` and `index.css` are copied verbatim into `packages/akashi` from `~/personal/viz/packages/design-system`. Edit them there first, then copy. Do not edit the copies.

The package adds three files on top of the base:

- `dark.css`: the dark theme. Akashi has none, so the values are authored here.
- `roadmap.css`: the shell (nav, sidebar, graph, exercises, editor frame, badges).
- `index.css` imports the fonts. Fonts are self-hosted from `@fontsource`, under the SIL Open Font License 1.1. The site loads no Google Fonts.

Each app's `src/style.css` imports the package, then sets its identity colour. Nothing else. Each app is at most 12 lines (25 for Android and iOS).

## 2. Identity colour

Each roadmap has one identity colour. It is the language's own colour. Three tokens carry it:

- `--identity`: the fill of the brand chip and the favicon.
- `--identity-ink`: the chip label. It must reach 4.5:1 on `--identity`.
- `--identity-accent`: one value per theme. It must reach 3:1 on `--paper` and on `--surface`. It is the brand hex. If the brand hex fails 3:1, use the nearest shade of the same hue that passes.

The identity colour shows in four places only:

- the brand chip and the favicon,
- the hero keyword (the `<em>` in the hero headline),
- the stroke of the up-next node in the roadmap graph,
- the current-module marker in the sidebar (`box-shadow: inset 2px 0 0 var(--identity-accent)`).

It never shows on links, buttons, focus rings, nav, or badges. Those stay monochrome.

| App | Identity | Chip label | Light accent | Dark accent |
| --- | --- | --- | --- | --- |
| ts | `#3178c6` | white | `#3178c6` | `#3178c6` |
| py | `#3776ab` | white | `#3776ab` | `#ffd43b` (Python yellow) |
| rag | `#7c3aed` | white | `#7c3aed` | `#7c3aed` |
| go | `#007d9c` | white | `#007d9c` | `#007d9c` |
| rust | `#b7410e` | white | `#b7410e` | `#b7410e` |
| kotlin | `#7F52FF` | white | `#7F52FF` | `#7F52FF` |
| swift | `#F05138` | `#191919` | `#F05138` | `#F05138` |
| android | `#3DDC84` | `#191919` | `#1c9c55` | `#3DDC84` |
| ios | `#0A84FF` | `#191919` | `#0A84FF` | `#0A84FF` |
| stats | `#be185d` | white | `#be185d` | `#d01a66` |

Python uses yellow as its dark accent so the two-tone logo still shows on the dark surface. Android's brand green is 1.71:1 on light paper, so its light accent is the darker #1c9c55 (3.39:1). Stats lightens its accent in the dark theme to keep 3:1.

## 3. Dark theme

Akashi has no dark theme. The roadmaps author one in `packages/akashi/dark.css`, scoped to `:root[data-theme='dark']`. The values are in the frontmatter (`darkColors`).

- The first visit follows `prefers-color-scheme`.
- The toggle stores `localStorage.theme`. Only `'light'` and `'dark'` are stored. Any other value falls back to the OS setting.
- The theme stays monochrome. There is no blue tint in the surfaces.
- The primary button is a light gradient, `#f4f4f4` to `#dedede`, with a `#141414` label. In the light theme it is the Akashi dark gradient with a white label.
- The sticky nav uses a translucent `--nav-bg`, with the same blur as the base.

The boot script in `index.html` sets `data-theme` before first paint.

## 4. Status colours

Three statuses: green for passed, amber for in progress, coral for failures. Each has a text colour and a tinted background (`--ok-bg`, `--warn-bg`, `--fail-bg`). Every text colour must reach 4.5:1 on its own tint, in both themes.

Status is never colour alone. Every status has an icon and a word: a check and "Passed", a dot and "In progress", an X and the failure text. A status colour is never used as decoration in prose or headings.

Badges are tinted, not filled. The text carries the colour. The border is the status colour at reduced opacity, or no border.

## 5. Roadmap graph

The graph is an SVG layered DAG. Its geometry (rows, node positions, edges) lives in `apps/*-roadmap/src/graph.ts`. The CSS only paints it.

- Nodes are `--surface` rectangles with a `--line` stroke and an `--ink` label.
- Done nodes get an `--ok` stroke and an `--ok` check disc. Edges from done nodes are `--ok` at 55% opacity.
- The up-next node gets an `--identity-accent` stroke. It is the only identity colour in the graph.
- Undone edges are `--line-strong`.
- Hover fills the node with `--hover-fill` and strokes it `--ink`.
- Keyboard focus draws an `--ink` stroke, 2.5px wide, on every node state (up next and done included). There is no blue focus ring. The editor frame gets a 2px solid `--ink` ring when focused.

On a small screen the graph scrolls sideways. Its minimum width is 760px.

## 6. Editor

The editor is Monaco. Its theme is rebuilt from the tokens on every theme change (`syncEditorTheme` in `editor.ts`). Monaco needs resolved colours, so each token is read with `getComputedStyle` and normalised to `#rrggbb` first. Minified CSS shortens hex values (`#fff`), and browsers can report `rgb()`. Monaco accepts only six-digit hex, so the code converts both.

| Monaco key | Token |
| --- | --- |
| `editor.background`, `editorGutter.background` | `--surface` |
| `editor.foreground`, `editorLineNumber.activeForeground`, `editorCursor.foreground` | `--ink` |
| `editorLineNumber.foreground` | `--muted` |
| `editor.lineHighlightBackground` | `--hover-fill` |
| `editor.selectionBackground` | `--mention-surface` |

The editor font is DM Mono at 14px. Monaco measures characters when it starts, so the editor calls `remeasureFonts()` after `document.fonts.load('400 14px "DM Mono"')` resolves.

Syntax colours are Monaco's own: `vs` in the light theme and `vs-dark` in the dark theme. The roadmaps do not restyle them.

## 7. Motion

Motion lives in `apps/*-roadmap/src/motion.ts`, on GSAP with `power3.out` and a 0.6s default. It has four moves:

- `enter`: route content rises 14px with a 0.06s stagger, then the graph edges draw in top to bottom.
- `reveal`: test result rows rise 6px one after another.
- `pop`: a badge that changes state scales from 0.6 with `back.out(2.5)`.
- `count`: a number tweens to its value with snapping. Used for progress.

Akashi's CSS transitions run 180ms on the fade and enter easings. Every GSAP move returns early under `prefers-reduced-motion: reduce`, and the Akashi base sets transitions to near zero under the same query.

## 8. Do's and Don'ts

### Do

- Use the identity colour in the four places in section 2, and nowhere else.
- Keep text on `--hover-fill` and `--mention-surface` at `--lead`. Use `--muted` on the base surfaces only.
- Put every status in an icon and a word.
- Set both themes in every token block. A new colour needs a dark value.
- Run `npm run check:design` after changing a colour. It checks the tokens, the identity colours and the WCAG contrast of every pair, for every roadmap. Add `--dist` after a build.

### Don't

- Don't add coloured glows. Akashi has no glows, and the roadmaps add none.
- Don't add large shadows to cards. Use a 1px `--line` border and a tonal step.
- Don't put the identity colour on a control, a link, a focus ring or a badge.
- Don't use `--muted` text on `--hover-fill` or `--mention-surface`. It drops below 4.5:1. Use `--lead`.
- Don't hard-code a hex value in a component. Use a token.
- Don't load fonts from Google Fonts. The fonts are in the package.
