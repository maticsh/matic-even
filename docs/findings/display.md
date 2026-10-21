# Display

Where the display sits, how bright text behaves, how to alert, and how pages change.

Images are in [images.md](images.md). Fonts and scripts are in [fonts.md](fonts.md).

<a id="h1"></a>
## H1: Blink a small, solid shape to alert

**Claim.** A dense, solid cluster of lit pixels catches the eye. A small filled sprite at the screen edge works best. Thin text strokes that blink read as flicker. Density matters more than the total count of lit pixels.

Styles compared:

| Style | What changes | Frame | Result |
|---|---|---|---|
| `hard` | Header `textColor` 4 to 0 and back | 400 ms | Works |
| `blank` | Header text on and off | 400 ms | Works |
| `soft` | Header `textColor` 4 to 1 and back | 400 ms | Fails. It reads like ordinary flicker from the room |
| Bar | A full-width `█` bar | Not recorded | Reads as aggressive |
| `edge` | A 48 x 48 tree sprite in the corner, on and off | 500 ms | Works. It is the low-ink middle ground between text and a full bar. The tester liked it best |

**Method.** Probe main page. Each tap runs the next blink style. The tester judged whether each style catches the eye of someone deep in other work. The `edge` sprite uses 500 ms frames because an image takes about 250 ms to land ([H4](images.md#h4-a-small-image-lands-in-150-to-300-ms)).

**Setup.** Even G2, SDK 0.0.16, probe 0.1.1 and 0.1.2, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** Compared once, by one person.

**For your app.**
- Alert with a small, dense, filled shape at the screen edge.
- As a backup, blink text with `hard` or `blank`.
- Do not use `soft`. People read it as noise.

**Trap found with this probe.** After a `hard` blink, the header stayed dim. The probe's renderer merged two queued updates to the header: "restore at level 4", then a later update with no colour. The merge lost the colour. If you batch text updates per container, keep a queued colour when a later update sets none. The renderer in `packages/glasses/src/infra/renderer.ts` does this. The probe test "runs every blink style without leaving the screen changed" checks it.

<a id="h2"></a>
## H2: Text brightness levels look too alike to rank text

**Claim.** All five `textColor` levels (0 to 4) render, and level 0 is visible. In normal use the levels look close together. They do not give a useful hierarchy.

**Method.** Probe Text levels page (tap, then hold, then pick Text levels). It shows one row at each level.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.1, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** One session on the levels page.

**For your app.**
- Leave text at the default level. Users set overall brightness in the OS.
- Keep `textColor` changes for alerts ([H1](#h1-blink-a-small-solid-shape-to-alert)).
- Rank text by position, spacing, borders and glyph weight.
- When you need real shades, draw them in an image ([H3](images.md#h3-images-show-all-16-grey-levels)).

<a id="h18"></a>
## H18: The display sits above the line of sight

**Claim.** The display sits in the upper part of the view, above the line of sight. You refocus your eyes to read it. The hands-free wake is a head tilt up of about 30°. The display never covers what you look at. When you look up at it, your eye lands in its middle.

**Method.** Observation from daily wear. No instrument.

**Setup.** Even G2. Firmware not recorded.

**Date.** 2026-10-04.

**Confidence.** One wearer's report.

**For your app.**
- Put the thing people look up for in the centre of the display.
- If your app reads head pitch from the IMU ([H13](sensors.md#h13-the-imu-is-an-accelerometer-in-g)), expect a tilt up each time the wearer reads the display. A rule such as "head up by 10° or more" fires on every glance at the display.

<a id="h20"></a>
## H20: A page rebuild cannot animate

**Claim.** `rebuildPageContainer` swaps the layout at once. A box that should "grow" into a new layout shows a flicker, then the new layout.

Two more traps showed up in the same work:
- A page rebuilt with empty text, then filled in with an upgrade, shows the fill as a second jump.
- The page builder in Matic's kit refused a page before sending it, because its text held characters that the firmware font lacks. The text was a news story. It held invisible zero-width spaces and word joiners (U+200B, U+2060). The page builder checks every glyph against Even's `pretext` font data. We did not test what the firmware does with such a page on create.

**Method.** Seen on glass while building a reader app. Its reader view opens with a page rebuild. Not timed.

**Setup.** Even G2, SDK 0.0.16, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-05.

**Confidence.** Seen on glass in one app.

**For your app.**
- Do not plan transitions between layouts. Each rebuild is a cut.
- Build the new page with its text already in it.
- Strip characters the font lacks before you build a page. `missingGlyphs` in `packages/glasses/src/domain/budget.ts` finds them with `@evenrealities/pretext`.

<a id="h21"></a>
## H21: Overflowing text scrolls in firmware

**Claim.** A full-screen text container that captures input and holds more text than fits scrolls on swipe. The firmware does the scrolling. Taps still reach the app.

**Unknown.** Whether the firmware sends an event when the scroll reaches the end. Nobody has seen one yet.

**Method.** Seen on glass in the same reader app's reader view.

**Setup.** Even G2, SDK 0.0.16, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-05.

**Confidence.** Seen on glass in one app.

**For your app.**
- For long text, one capturing text container gives you scrolling with no code.
- Do not depend on an end-of-scroll event until someone records one. If you see one, [report it](../../CONTRIBUTING.md).
