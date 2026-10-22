# Relay

A small server that fetches outside data for a G2 app. The app can only call origins on its `app.json` whitelist, and store review flags every other URL string in the bundle, so the app whitelists the relay's one origin and the relay fetches the rest.

It also adds the CORS headers that many feeds and APIs leave out. It runs on Node 24 with no runtime dependencies.

## Routes

| Route | What it does |
|---|---|
| `GET /health` | Answers `{"ok":true}` |
| `GET /v1/fetch?url=<absolute url>` | Fetches the URL and answers with its body and content type |
| `OPTIONS` on any path | Answers the CORS preflight |

Every answer carries `Access-Control-Allow-Origin: *`, because the Even app's WebView has no fixed origin to name.

`/v1/fetch` passes on JSON, XML (RSS and Atom too, and any `+json` or `+xml` type), HTML and plain text. It answers 415 for any other content type, and for a response with none.

The relay's own errors come back as JSON, `{"error":"..."}`:

| Status | When |
|---|---|
| 400 | No `url`, a URL that is not absolute, a scheme other than `http` or `https`, a port other than 80 or 443, or a user name in the URL |
| 401 | `RELAY_KEY` is set and `x-relay-key` is missing or wrong |
| 403 | The host is not on `RELAY_ALLOW`, or it resolves to a private or special address |
| 415 | The content type is not one of the text types above |
| 429 | The client is over the rate limit. `Retry-After` says how many seconds to wait |
| 502 | Upstream answered with an error, sent too big a body, redirected too often or in a loop, or could not be reached |
| 504 | Upstream took longer than the time cap |

The `x-relay-cache` header says where a body came from: `miss` (upstream), `hit` (memory) or `revalidated` (memory, after upstream answered 304).

## Safety

All of it is on by default, and the tests cover each row.

| Check | What the relay does |
|---|---|
| Schemes and ports | Fetches `http` and `https` only, on ports 80 and 443 |
| Private addresses | Refuses loopback, RFC 1918, link-local (with `169.254.169.254`), `100.64.0.0/10`, IPv6 ULA and link-local, `::1`, and the other special ranges |
| When it checks | Inside the DNS lookup the socket uses, so DNS rebinding cannot get past |
| Redirects | Checks every hop again. Follows 3 hops at most, and no loops |
| Body | 2 MB at most |
| Time | 8 s for the whole fetch, redirects included |
| Rate | 60 requests a minute per client |
| Upstream hosts | Only the hosts in `RELAY_ALLOW`. Unset or empty refuses everything |
| Client headers | Sends none upstream: no cookies, no `Authorization` |
| Relayed HTML | Answers with `Content-Security-Policy: sandbox` and `nosniff`, so a page never runs on the relay's origin |

The refused ranges in full: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`, and in IPv6 `::`, `::1`, `100::/64`, `2001:db8::/32`, `fc00::/7`, `fe80::/10`, `fec0::/10` and `ff00::/8`. An IPv4 address inside an IPv6 one (mapped, NAT64 or 6to4) is checked as IPv4. When a name resolves to several addresses and one of them is refused, the relay refuses the name.

The relay logs one line at start, and unexpected errors. It logs no URLs and no client addresses.

## Settings

Every setting is an environment variable. A bad value stops the relay at start.

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8787` | The port to listen on. Most hosts set it for you |
| `HOST` | every interface | The address to listen on, for example `127.0.0.1` |
| `RELAY_ALLOW` | empty, so nothing is allowed | Upstream hosts, comma-separated: `example.com`, `*.example.com` or `*` |
| `RELAY_KEY` | off | When set, every `/v1/fetch` must send it in `x-relay-key` |
| `RELAY_MAX_BYTES` | `2097152` (2 MB) | The largest body the relay reads |
| `RELAY_TIMEOUT_MS` | `8000` | The time cap for one fetch, redirects and body included |
| `RELAY_MAX_REDIRECTS` | `3` | The most redirect hops it follows |
| `RELAY_RATE` | `60` | Requests per client per minute. `0` turns the limit off |
| `RELAY_CACHE_TTL` | `60` | Seconds a cached body stays fresh. `0` turns the cache off |
| `RELAY_CACHE_MB` | `32` | Memory for cached bodies. The oldest go first |
| `RELAY_TRUST_PROXY` | off | `1` takes the client's address from the last `X-Forwarded-For` entry |

### The allowlist

- `example.com` allows that host only.
- `*.example.com` allows any name under it, such as `feeds.example.com` and `a.b.example.com`. It does not allow `example.com` itself, so list both if you need both.
- `*` allows any public host.

Use `*` only when your users add their own URLs, such as feeds they pick. It makes the relay an open proxy to the public web. Anyone who finds its address can fetch through it, and your server's address takes the blame for what they fetch. The private-address checks, the caps and the rate limit still hold. Watch your bandwidth.

### The key

`RELAY_KEY` keeps casual callers out. It is not a secret: a key bundled into an app is readable by anyone who unpacks the app. Do not use it to protect anything that matters.

### Behind a proxy

Most hosts put a proxy in front of your server. Then every request seems to come from the proxy, and all clients share one rate limit. Set `RELAY_TRUST_PROXY=1` so the relay reads the client's address from `X-Forwarded-For`. Set it only behind a proxy that writes that header, or clients can fake their address.

### The cache

The cache lives in memory, by URL. A body stays fresh for `RELAY_CACHE_TTL` seconds. After that the relay asks upstream with the body's `ETag` and `Last-Modified`, and keeps the copy when upstream answers 304. When a client sends `If-None-Match` with the current `ETag`, the relay answers 304. A restart empties the cache.

## Run it locally

Node 24 or later. From this folder:

```sh
npm install
npm test
RELAY_ALLOW=example.com node src/main.ts
```

In a second terminal:

```sh
curl -i localhost:8787/health
curl -i "localhost:8787/v1/fetch?url=https%3A%2F%2Fexample.com%2F"
```

`npm run dev` restarts the relay when a file changes.

## The app side

1. Put the relay's origin in `app.json`, and nothing else:

   ```json
   "permissions": [
     { "name": "network", "desc": "Fetches your feeds through our server.", "whitelist": ["https://relay.your-app.example"] }
   ]
   ```

2. Write the origin once, in one file, and call the relay with the URL as data:

   ```ts
   /** Must match the network whitelist in app.json. */
   export const RELAY = 'https://relay.your-app.example'

   export async function fetchText(u: string): Promise<string> {
     const res = await fetch(`${RELAY}/v1/fetch?url=${encodeURIComponent(u)}`)
     if (!res.ok) throw new Error(`relay answered ${res.status}`)
     return res.text()
   }
   ```

   The URLs themselves stay out of the bundle. They come from the user, or from a route on your server. [docs/review/urls.md](../../docs/review/urls.md) explains why.

3. Build the app, then run the URL scan that store review runs, in the app's folder:

   ```sh
   npx maticsh-urls
   ```

## Deploy it

The relay runs on any host that runs Node 24 or a container. Set `RELAY_ALLOW`, and the host's `PORT` if it does not set one.

This `Dockerfile` is in this folder:

```dockerfile
FROM node:24-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
USER node
EXPOSE 8787
CMD ["node", "src/main.ts"]
```

The relay has no runtime dependencies, so the image needs no `npm install`.

Start node directly, as the `CMD` does. Then the host's stop signal (`SIGTERM`) reaches the relay itself, which finishes the requests in flight and exits with code 0. Under `npm start`, npm takes the signal and exits with code 143, and some hosts report that as a crash.

## Use it as a template

Copy this folder on its own:

```sh
npx degit maticsh/matic-even/apps/relay my-relay && cd my-relay && npm install
```

Then set your own `name` in `package.json`, and your app's name in `USER_AGENT` in `src/fetch.ts`, so upstream owners can tell who is calling.

| File | What it holds |
|---|---|
| `src/main.ts` | Reads the settings and listens |
| `src/config.ts` | The environment variables and their defaults |
| `src/server.ts` | The routes, CORS, the key, the rate limit and the cache |
| `src/guard.ts` | The URL, port and address checks, and the guarded DNS lookup |
| `src/fetch.ts` | One upstream fetch: redirects, the size cap and the time cap |
| `src/limit.ts` | The per-client rate limit |
| `src/cache.ts` | The in-memory cache |
| `tests/` | The tests, against a fake upstream and a fake DNS. They never touch the real network |

## License

MIT
