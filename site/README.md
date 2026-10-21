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

## How it builds

`build.mjs` is a Node script. Node runs the packages' TypeScript as it is.

The page has four numbered sections, each with subsections: 01 Components (glasses UI, phone UI, test tools), 02 Probe
& findings (the probe app, findings, open questions, store review), 03 AI (skills, the Claude Code plugin, get started
with AI) and 04 Build (the demo app, get started by hand, contribute). The outline is `SECTIONS` in `build.mjs`. The
contents card, the top bar and every number come from it, and each subsection keeps the id it had before the page had
sections.

| Part of the page | Comes from |
|---|---|
| Glasses UI | `samples/*.ts` run against `@maticsh/glasses`. The build draws what they export as inline SVG (`lib/draw.mjs`), and shows each file beside its picture |
| Phone UI | `live/phone.ts`, bundled by Vite into `dist/assets/phone.js`. It draws `@maticsh/phone`'s parts with the package's own code and stylesheet, each in a shadow root |
| The demo app, the probe | The PNGs in `assets/`, taken by `capture.mjs` |
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
- `assets/*.png`: the frames and the phone page from `capture.mjs`.
- `live/catalog.ts`: the phone parts on the page, their names and what they are for.
