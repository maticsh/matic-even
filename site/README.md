# site

even.matic.sh: one page that scrolls through the whole project. It is built from the repo itself, so the page and
the repo never disagree.

## Build and serve

The site is one workspace in the repo's npm workspace. Node 24 or later. From the repo root:

```sh
npm ci
npm run build --workspace site     # writes site/dist/
node site/serve.mjs                # http://127.0.0.1:5700/
node site/serve.mjs --host 0.0.0.0 --port 5710
```

`site/dist/` is static files with relative links, so any static host or path serves it. Beside `index.html` the
build writes `setup.md` and `setup.txt` (both `docs/ai/setup.md` as it is) and `llms.txt`, an index of the docs for AI
tools. A host should serve `.md` and `.txt` as `text/plain`, so a browser shows them; `serve.mjs` does.

For search and link previews it also writes `robots.txt` and `sitemap.xml` (the page, dated by the build), and the
page's `<head>` carries the title, description, canonical link, Open Graph and Twitter tags and JSON-LD from
`lib/seo.mjs`. The build stops if any of them is missing, if an image URL is not absolute, or if the JSON-LD does not
parse. Those tags and the sitemap use `SITE_URL`.

## The share images

`og.mjs` draws `assets/og.png` (1200 x 630, the link preview and GitHub's social preview), `assets/og-square.png`
(1200 x 1200) and the PNG icons with Playwright, from an HTML card in the page's look and `assets/checklist.png`.
The PNGs are checked in, so the build needs no browser. Run it when the title, the line or the frame changes, and
read the images before you commit them.

```sh
node site/og.mjs                                   # the system font
node site/og.mjs --font path/to/Inter-Regular.woff2   # closer to San Francisco on Linux
```

## How it builds

`build.mjs` is a Node script. `npm run build` runs it with `--conditions=@maticsh/source`, so Node loads the packages' TypeScript source rather than their `dist/`, and runs it as it is.

The page has four numbered sections, each with subsections: 01 Components (glasses UI, phone UI, test tools, the demo
app, the relay server), 02 Probe & findings (the probe app, findings, open questions, store review), 03 AI (skills, the
Claude Code plugin) and 04 Get started (with AI, by hand, contribute). The outline is `SECTIONS` in `build.mjs`. The
contents card, the top bar and every number come from it, and each subsection keeps the id it had before the page had
sections.

| Part of the page | Comes from |
|---|---|
| Glasses UI | `samples/*.ts` run against `@maticsh/glasses`. The build draws what they export as inline SVG (`lib/draw.mjs`), and shows each file beside its picture |
| Phone UI | `live/phone.ts`, bundled by Vite into `dist/assets/phone.js`. It draws `@maticsh/phone`'s parts with the package's own code and stylesheet, each in a shadow root |
| The demo app, the probe | The PNGs in `assets/`, taken by `capture.mjs` |
| How the demo is built | `docs/architecture.md`: the diagram open, each other part folded |
| Relay server | `apps/relay/README.md`: its first paragraphs, the Safety table, and the code blocks from "The app side" and "Use it as a template" |
| Test tools | `samples/fake-bridge.ts`, `manifest.ts` and `urls.ts`, run with Node. The page shows what they print |
| Findings, review, open questions, the probe's guide, contributing | The markdown in `docs/`, `apps/probe/README.md` and `CONTRIBUTING.md` |
| AI | Each `skills/skills/*/SKILL.md` (its name, the first sentence of its description, its headings), the two plugin manifests, `skills/README.md`'s "Next to Even's plugin", and `docs/ai/setup.md` with Copy buttons |
| Counts | The files, and the Exports tables in the package READMEs |

Links between markdown files become anchors on the page. Finding anchors are short (`#h12`), and so are probe
anchors (`#p3`). A link to any other file in the repo goes to GitHub. The repo URL is the `REPO` constant at the top
of `build.mjs`, with the page's own URL, `SITE_URL`, beside it. Probe issue numbers go in `PROBE_ISSUES` once the
issues exist. The build fails on a link to a missing file, a missing anchor, a duplicate id, or a relative link to a
file that is not in `dist/`.

## The pictures from the simulator

`capture.mjs` starts Checklist and the probe on dev servers, opens each in Even's simulator, drives Checklist to a
ticked state and re-inks each glasses frame as graphite on the page grey. It also takes Checklist's phone page at 390
wide. It stops everything it started. Run it when the demo or the probe changes how it looks, and check in the PNGs.

```sh
node site/capture.mjs              # needs xvfb-run with no display, and Playwright's Chromium
```

## Files

- `assets/site.css`: the stylesheet, on matic.sh's tokens.
- `assets/favicon.svg`: matic.sh's favicon.
- `assets/*.png`: the frames and the phone page from `capture.mjs`; `og.png`, `og-square.png`, `apple-touch-icon.png`
  and `favicon-32.png` from `og.mjs`.
- `lib/seo.mjs`: the search and share tags, robots.txt and sitemap.xml, and the check on them.
- `live/catalog.ts`: the phone parts on the page, their names and what they are for.
