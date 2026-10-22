# GitHub repo metadata

What to set on `maticsh/matic-even` by hand or with `gh`, so the repo shows up in GitHub search and its links preview
well. Nothing here applies itself. A maintainer reviews it, then runs the commands below.

The words match the site's `<head>` (`site/lib/seo.mjs`) and the `description` and `keywords` in each
`package.json`. Change them together.

## Description

231 characters. GitHub allows 350.

> Open-source toolkit and field notes for building Even Realities G2 glasses apps: findings measured on real glasses,
> TypeScript packages for the glasses and the phone, test tools, a demo app, and skills and a plugin for Claude Code.

## Homepage

https://even.matic.sh

## Topics

18 of GitHub's 20, all lowercase:

`even-realities` `even-g2` `even-realities-g2` `g2` `smart-glasses` `ar-glasses` `hud` `evenhub` `even-hub`
`glasses-app` `wearables` `toolkit` `typescript` `claude-code` `claude-code-plugin` `agent-skills` `llms-txt`
`field-notes`

Left out: `mcp`, because the repo ships no MCP server. Add it if one lands. `sdk` is out too: the packages sit on
top of Even's SDK, and the topic would say they replace it.

## Social preview

Upload `site/assets/og.png` (1200 x 630, about 40 KB) in the repo's **Settings > General > Social preview**. GitHub
has no API or `gh` command for this image. GitHub suggests 1280 x 640 and takes anything from 640 x 320 up,
so 1200 x 630 works. `site/og.mjs` redraws the image.

## Commands

Run from any directory, signed in to `gh` with admin on the repo:

```sh
gh repo edit maticsh/matic-even \
  --description "Open-source toolkit and field notes for building Even Realities G2 glasses apps: findings measured on real glasses, TypeScript packages for the glasses and the phone, test tools, a demo app, and skills and a plugin for Claude Code." \
  --homepage "https://even.matic.sh"

gh repo edit maticsh/matic-even \
  --add-topic even-realities,even-g2,even-realities-g2,g2,smart-glasses,ar-glasses,hud,evenhub,even-hub,glasses-app \
  --add-topic wearables,toolkit,typescript,claude-code,claude-code-plugin,agent-skills,llms-txt,field-notes
```

Check the result:

```sh
gh repo view maticsh/matic-even --json description,homepageUrl,repositoryTopics
```

## npm

The `description`, `keywords`, `homepage` and `bugs` in `packages/*/package.json` reach npm with the next publish of
each package. npm search reads them from the published version, so the current pages keep the old text until then.
