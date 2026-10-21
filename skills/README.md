# matic-even: a Claude Code plugin for Even Realities G2 apps

This folder is a Claude Code plugin. It teaches Claude how to build, test and ship apps for Even
Realities G2 glasses on the Even Hub platform.

It holds two skills:

| Skill | What it does |
|---|---|
| `even-g2` | The platform: app shape, hardware, display, containers and limits, input and its traps, device APIs, lifecycle, networking, `app.json`, the dev loop, the simulator automation API, facts measured on a real G2, store review, version state, and where the sources disagree. `references/sdk.md` has the SDK signatures and enums. |
| `even-g2-preflight` | A checklist to run before you pack a build for review: URL scan, manifest lint, sensors off at exit, store listing, then `evenhub pack` with an exact `--sdk-ver`. |

Claude loads a skill when your request matches it. You can also call one by name, such as
`/matic-even:even-g2-preflight`.

## Install

To try it for one session, clone the repo and point Claude Code at this folder:

```sh
git clone https://github.com/maticsh/matic-even matic-even
claude --plugin-dir matic-even/skills
```

To install it for good, add the repo's marketplace, then install the plugin from it. From your shell:

```sh
claude plugin marketplace add maticsh/matic-even
claude plugin install matic-even@matic-even
```

Inside a Claude Code session:

```
/plugin marketplace add maticsh/matic-even
/plugin install matic-even@matic-even
```

On an older Claude Code, or for other options, see Claude Code's plugin docs:
https://code.claude.com/docs/en/discover-plugins.

## Next to Even's plugin

Even Realities publishes its own Claude Code plugin,
[`everything-evenhub`](https://github.com/even-realities/everything-evenhub). Install both. This plugin
adds what we learned on glass and at review. Use Even's for scaffolds and walk-throughs.

| Topic | `everything-evenhub` | `matic-even` |
|---|---|---|
| Scaffold a new app | `quickstart`, `template` | Points to them. Adds Matic's demo app as a template. |
| SDK reference | `sdk-reference` (full walk-through) | A short reference checked against the SDK 0.0.16 `.d.ts` |
| Containers, limits, fonts | `glasses-ui`, `design-guidelines`, `font-measurement` | The same limits, plus the char and byte split, and the scripts the font lacks |
| Input | `handle-input` | Both tap envelopes, long press that users can rebind, one swipe read as several |
| Foreground events | `handle-input` reads EXIT as "app went to the background" | On a G2, OS overlays fire ENTER and EXIT while the page stays mounted. Treat both as checkpoints. |
| Device features | `device-features` | IMU units and pace measured on glass, wear detection as a user setting |
| Background state | `background-state` (`setBackgroundState`) | Notes that SDK 0.0.16 does not export it |
| Simulator | `test-with-simulator`, `simulator-automation` | A loop an agent can run alone, headless Linux, where the simulator and glass differ |
| Build and pack | `build-and-deploy`, `cli-reference` | `--sdk-ver`, CLI 0.2.0's new commands |
| Store review | Not covered | What reviewers check, the URL scan, the public privacy policy, and the `even-g2-preflight` skill |
| Measured facts | Not covered | Findings H1 to H23 from a real G2, each with a method and a confidence level |
| Packages | Not covered | `@maticsh/glasses`, `@maticsh/testing`, `@maticsh/phone` and the demo app `apps/checklist`, mapped to the traps they remove |

The packages are not on npm yet. The skills say how to use them from the repo until they are.

## Sources

The skills cite the findings and review lessons in this repo as `docs/findings/<topic>.md#hN` and
`docs/review/<topic>.md`. Every number in the skills comes from Even's docs, SDK, CLI, templates and
plugin, or from those findings. If you measure something different on glass, open an issue with your
method and setup.

## License

MIT. Independent. Not affiliated with Even Realities.
