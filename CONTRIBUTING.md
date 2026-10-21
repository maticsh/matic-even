# Contributing

This repo holds findings that someone measured on real hardware, and the packages and apps built on them. Every finding must say how you measured it, so anyone can check it.

## Add a finding

Open an issue with the "Finding" form first, or send a pull request. **We accept pull requests for findings only in the format below.** A pull request that leaves out a field goes back for changes.

1. Pick the topic file in `docs/findings/` that fits. If none fits, say so in the pull request.
2. Take the next free ID. The last ID is H23, so the next one is H24. IDs never change, and we never reuse one.
3. Add the finding to the end of the topic file, in this format:

```md
## H24: A short claim in plain words

**Claim.** What is true, with numbers and units. One idea per sentence.

**Method.** How you measured it. Which probe page or which code, which gestures, what you watched or logged.
Someone else must be able to repeat it from this paragraph.

**Setup.** Glasses model and firmware version. Even app version. SDK version. Phone model and OS version.
Install type (QR sideload, private build or beta build). Phone locked or unlocked.

**Date.** YYYY-MM-DD.

**Confidence.** How many times you saw it, and who saw it.

**For your app.** One to three rules a developer can follow.
```

4. Add a row to the findings table in `README.md`.
5. If you have a raw log, attach it to the pull request or the issue. Trim it to the part that matters. Remove anything personal first.

### What a finding needs

| Field | Required | Notes |
|---|---|---|
| Claim | Yes | Numbers carry units. Say "not timed" or "unknown" where that is true |
| Method | Yes | Enough detail to repeat |
| Device and firmware | Yes | Firmware from the Even app's device page. Write "not recorded" if you did not note it |
| Even app version | Yes | |
| SDK version | Yes | `@evenrealities/even_hub_sdk` version |
| Phone and OS | Yes | For example "iPhone, iOS 26.1" |
| Date | Yes | The day you measured it |
| Who saw it | Yes | Your GitHub handle, or "anonymous" |
| Raw log | If you have one | CSV from the probe, or console output |

### Change an existing finding

- If your result disagrees with a finding, open an issue with the "Finding" form. Give your setup in full. A different firmware or phone is a useful result.
- We keep the old result and add yours with its own setup and date.
- Fix typos and broken links with a plain pull request.

## Report a probe result

The open questions are in `docs/probes/`. Each one has steps and a list of what to record.

1. Run the probe app ([apps/probe/README.md](apps/probe/README.md)).
2. Follow the steps in the probe's file.
3. Open an issue with the "Probe result" form. Fill in every field the probe asks for.
4. Attach the CSV log from `apps/probe/logs/` if the probe uses one.

When the results answer the question, we turn them into a finding with a new H number, and credit the people who ran it.

## Change the code

The packages and apps are one npm workspace. Node 24 or later.

```sh
npm ci
npm run check        # typecheck and test every package and app
```

- Before you send a pull request, run `npm run check`, then `npm run build`, `node scripts/urls.ts apps/<app>` and `npm run pack` for any app you changed. CI runs the same steps from a fresh clone.
- In the workspace, the apps, the tests and the site load the packages' TypeScript source (the `@maticsh/source` export condition). `npm ci` also builds each package's `dist/`, which npm ships and which the apps' `vite.config.ts` loads. If you change a package's exports or files, run `npm run pack:check`.
- Add a test for new logic. The tests run on `FakeBridge` from `@maticsh/testing`, so they need no glasses.
- Comments say what the code does, and cite a finding (`docs/findings/<topic>.md#hN`) for a hardware trap.
- Keep URL strings out of app bundles ([docs/review/urls.md](docs/review/urls.md)).
- Turn sensors off on the exit events ([docs/review/sensors.md](docs/review/sensors.md)).

## Style

- Plain words, short sentences, active voice. One idea per sentence.
- Every number has a unit. Every measurement has a date.
- No guesses stated as facts. "Seen once" and "unknown" are fine.

## License

By contributing, you agree that your contribution is licensed under the MIT License in [LICENSE](LICENSE).
