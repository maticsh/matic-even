# Images and bandwidth

How fast images reach the glasses, and what they can show.

<a id="h3"></a>
## H3: Images show all 16 grey levels

**Claim.** All 16 grey steps in a PNG image are distinguishable on glass.

**Method.** The probe's test image (144 x 144) has a row of 16 grey steps along the bottom. Swipe down on the probe main page to send it.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.1, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** Seen once.

**For your app.** For real shades, or for text smaller than the firmware font, draw an image. Text has five levels that look alike ([H2](display.md#h2-text-brightness-levels-look-too-alike-to-rank-text)).

<a id="h4"></a>
## H4: A small image lands in 150 to 300 ms

**Claim.** A 144 x 144 PNG sent with `updateImageRawData` lands in 150 to 300 ms, mostly 200 to 300 ms. Even's guidance says to expect 0.5 to 2 s per frame.

**Method.** Swipe down on the probe main page. The probe times each send from the start (this includes drawing the PNG on the phone) until the SDK call resolves. The time shows on the glasses and the phone. Repeated swipes.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.1, QR sideload, iPhone, phone unlocked. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** Repeated swipes in one session. Larger images were not timed.

**For your app.** At about 250 ms a frame, a slow animation works: a stage change, or a short effect of a few frames. Full-screen video does not.

<a id="h5"></a>
## H5: Image replacement does not flicker, and rapid sends all land

**Claim.** Replacing an image does not flicker. Updates feel nothing like e-ink. Rapid repeated sends all land.

**Method.** Rapid sends from the probe main page. Each send is numbered, and each test image carries a tick that moves one cell per send, so every frame that lands shows as a change. The probe sends images one at a time through a write queue. We did not test parallel sends.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.1, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** Repeated.

**For your app.**
- Send images one at a time. Queue them, and keep one send in flight. `packages/glasses/src/infra/write-queue.ts` is a small queue that does this.
- Replace an image freely. Nothing flashes between frames.

## Open: do image sends wipe upgraded text?

In simulator 0.9.5, text that was upgraded earlier vanishes about a second after the next few image sends. It comes back only when it is sent again. Nobody has checked this on glass. See [probe P13](../probes/P13.md).
