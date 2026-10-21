# Fonts and scripts

The G2 has one firmware font. The SDK has no size control. These findings cover how it looks and which scripts it can show.

<a id="h8"></a>
## H8: The simulator makes glyphs look heavier than they are

**Claim.** On glass, `●`, `▲` and `▼` look balanced next to the font's letters. The simulator makes them look heavier.

**Method.** Observation on glass and in the simulator. The probe's action bar uses these glyphs (`blink ●   image ▼   sense ▲   exit ●●`).

**Setup.** Even G2, SDK 0.0.16, probe 0.1.x, QR sideload, iPhone. Simulator version not recorded. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** Seen once.

**For your app.** Judge glyph weight on glass. Do not thin out symbols because they look heavy in the simulator.

<a id="h9"></a>
## H9: The firmware font reads a little large

**Claim.** The firmware font reads a little large on glass. The SDK has no font size control.

**Method.** Observation on glass.

**Setup.** Even G2, SDK 0.0.16, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** One person's opinion.

**For your app.** Plan your text for the size it is. For smaller text, draw it on the phone and send it as an image ([H3](images.md#h3-images-show-all-16-grey-levels), [H23](#h23-the-firmware-font-has-no-hindi-send-it-as-an-image)).

<a id="h23"></a>
## H23: The firmware font has no Hindi. Send it as an image

**Claim.**
- The firmware font has no Devanagari. The glasses accept a text upgrade that holds Hindi. The Latin in it shows. Every Devanagari character drops, with no error. The simulator does the same.
- Even's `@evenrealities/pretext` package agrees. Its font chain is Latin, then Cyrillic and Greek, then CJK. It has no Devanagari, Bengali, Tamil, Arabic, Hebrew or Thai.
- Chinese text renders in the firmware font.
- Hindi drawn on the phone and sent as an image renders well.

Image sizes, judged on glass:

| Script | Size | Result |
|---|---|---|
| Chinese | 12 px | Legible, but dense characters (量, 讓) merge |
| Chinese | 16 px, 20 px | Read well. The tester preferred these |
| Hindi | 14 px | Legible |
| Hindi | 18 px | Reads best. It matches the size of the firmware's English text |

**Method.** Probe Scripts page (tap, then hold, then pick Scripts). The left half has six rows in the firmware font. Each row starts with a Latin letter, so a row whose script is missing still shows its letter. The rows mount with only the letter, then the full text goes out as a text upgrade. The right half holds the same text drawn by the phone's own font engine, as images at several sizes. The phone page shows the reference text to compare against.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.4, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-09.

**Confidence.** One session on glass.

**For your app.**
- Check every string with `pretext` before you send it. `missingGlyphs` in `packages/glasses/src/domain/budget.ts` does this.
- For Hindi and the other missing scripts, draw the text on the phone into a canvas and send it as an image. Use about 18 px for Hindi.
- For Chinese drawn as an image, use 16 or 20 px.
- A missing glyph fails with no error, so test every language you list in `app.json`.
