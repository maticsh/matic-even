# Review: no URL strings off the whitelist

**The rule.** Even Hub review scans your built bundle for URL-shaped strings. It flags every one that is not in the network whitelist in `app.json`. It flags a URL even if your app never calls it.

**What it cost.** Review rejected one of our apps twice for this in October 2026. It flagged:
- The addresses of its starter feeds, written in the app.
- A scheme it added to typed input. The code built `https://${...}` from what the user typed. Review flags the start of a template like this too.
- Its demo data.

## What review counts as a URL

- A string literal such as `"https://example.com/feed.xml"`.
- The start of a template literal such as `` `https://${host}/feed` ``.
- Strings anywhere in the bundle: your code, your data and your dependencies.

In our submissions, review did not flag XML namespace strings such as `http://www.w3.org/2000/svg`. They are names, and the app never fetches them.

## The relay pattern

Keep every outside URL off the bundle. Give the app one origin to talk to, and let a server do the rest.

1. **One whitelisted origin.** Write it down once, in one file, and put the same origin in `app.json`:

   ```ts
   /** Must match the network whitelist in app.json. */
   export const API_BASE = 'https://api.your-app.example'
   ```

   ```json
   "permissions": [
     { "name": "network", "desc": "Fetches your feeds.", "whitelist": ["https://api.your-app.example"] }
   ]
   ```

2. **Outside URLs live on the server or in user data.**
   - A starter list of addresses comes from a server route, such as `GET /v1/starter`.
   - The user types an address. The app stores it as data and sends it to the server. The app does not build a URL from it.
   - The server adds a missing scheme. The app never writes `https://` in front of anything.

3. **Demo data stays out of the production build.** Keep it behind `import.meta.env.DEV`, so Vite drops it.

4. **The server refuses private addresses.** Your server now fetches any URL a user sends, so it must not reach your own network. A safe server does this:
   - It accepts `http` and `https` on ports 80 and 443 only.
   - It refuses private addresses (localhost, the LAN, VPN ranges, cloud metadata). It checks inside the DNS lookup, so DNS rebinding cannot slip past.
   - It checks every redirect again.
   - It caps the size of each response body and the time of each request.
   - It limits how many requests each client can send a minute.

   [apps/relay](../../apps/relay/README.md) is a server that does all of this, ready to copy.

## Whitelist shape and CORS

- The whitelist entry must be a full origin: `https://` plus the host, with no path and no wildcard. Add a `wss://` origin for a socket.
- The server must still send CORS headers. The whitelist does not bypass CORS. If `curl` works and the WebView fails, suspect CORS.

## Run the check

A scanner ships in `@maticsh/testing` as the `maticsh-urls` bin, and in this repo at `scripts/urls.ts`. The repo script needs Node 24 and no install. Run either on your app folder after `vite build`, before you pack:

```sh
npx maticsh-urls <app-folder>        # in an app with @maticsh/testing installed
node scripts/urls.ts <app-folder>    # in this repo
```

It reads the whitelist from `<app-folder>/app.json`, scans `<app-folder>/dist` and `<app-folder>/src`, and exits with code 1 on any error. It checks five rules:

| Rule | Level | What it finds |
|---|---|---|
| `url-not-whitelisted` | error | A URL string in the bundle that is not on the whitelist |
| `whitelist-shape` | error | A whitelist entry that is not a bare `https://` or `wss://` origin |
| `whitelist-unused` | warning | A whitelisted origin that the bundle never names |
| `network-permission-empty` | error | A `network` permission with no whitelist |
| `fetch-origin` | error | An absolute URL in `fetch`, `WebSocket` or `EventSource` in source, with an origin not on the whitelist |

Fix each error: remove the URL, move it to your server, or put it behind `import.meta.env.DEV`. The probe's CI runs this check on every push.
