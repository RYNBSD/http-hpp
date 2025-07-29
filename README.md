# http-hpp

A lightweight, zero-dependency middleware to prevent HTTP Parameter Pollution (HPP) by collapsing repeated query/body parameters to their last occurrence. Designed to work with raw Node.js `http` as well as popular frameworks like Express, Fastify, and Koa without changing your existing logic.

---

## Installation

```bash
npm install http-hpp
# or
yarn add http-hpp
```

---

## Quickstart (raw Node.js)

```js
import http from 'node:http';
import hpp from 'http-hpp';

const server = http.createServer((req, res) => {
  // wrap URL-encoded parser if needed, e.g. custom body collector
  hpp({ checkQuery: true, checkBody: false })(req, res, () => {
    // req.query is now de-duplicated
    console.log(req.query);
    res.end('OK');
  });
});

server.listen(3000);
```

---

## API

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import hpp, { HppOptions } from 'http-hpp';
```

### `hpp(options?: HppOptions): (req, res, next) => void`

| Option        | Type                    | Default                                 | Description                                                                   |
| ------------- | ----------------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| `checkQuery`  | `boolean`               | `true`                                  | Enable HPP protection on `req.query`.                                         |
| `checkBody`   | `boolean`               | `false`                                 | Enable HPP protection on `req.body` (form‑urlencoded only).                   |
| `accessQuery` | `<T>(req: T) => string` | default: extracts `req.url` search part | Function to retrieve raw query string.                                        |
| `accessBody`  | `<T>(req: T) => string` | default: extracts `req.url` search part | Function to retrieve raw body string (useful when framework buffers for you). |

> The middleware will parse the raw string with `new URLSearchParams(str)` and assign
> the last value for each duplicate key. No arrays or extra storage are kept.

---

## Examples

### Express.js

#### Recommended

```js
import express from 'express';
import hpp from 'http-hpp';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(hpp({ checkQuery: true, checkBody: false }));

app.post('/submit', (req, res) => {
  res.json({ query: req.query, body: req.body });
});
```

#### URL-encoded forms

```js
import express from 'express';
import hpp from 'http-hpp';

const app = express();
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(hpp({ checkQuery: true, checkBody: true }));

app.post('/submit', (req, res) => {
  // req.query and req.body have no duplicate arrays
  res.json({ query: req.query, body: req.body });
});
```

#### JSON bodies (no HPP needed)

```js
import express from 'express';
import hpp from 'http-hpp';

const app = express();
app.use(express.json({ limit: '100kb' }));
// JSON parsers pick last‑wins for duplicate keys by default
app.use(hpp({ checkQuery: true, checkBody: false }));
```

#### Multipart forms (via multer)

```js
import express from 'express';
import multer from 'multer';
import hpp from 'http-hpp';

const upload = multer();
const app = express();
app.use(hpp({ checkQuery: true, checkBody: false }));
app.post('/upload', upload.any(), (req, res) => {
  // req.files and req.body (parsed by multer) are safe
  res.send('Uploaded');
});
```

### Fastify

```js
import Fastify from 'fastify';
import hpp from 'http-hpp';

const app = Fastify();

app.addHook('preHandler', (req, reply, done) => {
  hpp({ checkQuery: true, checkBody: false })(req.raw, reply.raw, done);
});

app.get('/', (req, reply) => {
  reply.send({ query: req.query });
});

app.listen(3000);
```

### Koa

```js
import Koa from 'koa';
import koaBody from 'koa-body';
import hpp from 'http-hpp';

const app = new Koa();

app.use(async (ctx, next) => {
  await new Promise((resolve) => hpp({ checkQuery: true, checkBody: true })(ctx.req, ctx.res, resolve));
  await next();
});
app.use(koaBody({ multipart: true, urlencoded: true }));

app.use(ctx => {
  ctx.body = { query: ctx.req.query, body: ctx.req.body };
});
```

---

## Request Types & Recommendations

| Type                                | Parser                                | HPP Options                                                       | Notes                                                                   |
| ----------------------------------- | ------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `application/json`                  | `express.json()` / native JSON parser | `{ checkQuery: true }`                                            | JSON parsers already pick last value; no need for `checkBody`.          |
| `application/x-www-form-urlencoded` | `express.urlencoded()` / `koa-body`   | `{ checkQuery: true, checkBody: true }`                           | Enforce `limit` on body size to avoid DoS.                              |
| `multipart/form-data`               | `multer` / `koa-body`                 | `{ checkQuery: true }`                                            | Files handled by parser; HPP only applies to text fields in `req.body`. |
| custom raw form                     | custom stream buffer + HPP            | `{ checkQuery: true, checkBody: true, accessBody: yourAccessor }` | Provide `accessBody` to read raw body string.                           |

---

## Security & Best Practices

1. **Schema Validation**: Always follow HPP with a strict schema validator (Zod, Joi, Yup, etc.) to enforce types, ranges, and required fields.
2. **Size Limits**: For body parsing, set a maximum payload size (`limit`) to prevent memory exhaustion attacks.
3. **Content-Type Normalization**: Use the built-in `isFormUrlencoded` to robustly detect form bodies (handles `; charset=` suffixes).
4. **Parameter Whitelisting**: Optionally filter `req.query` / `req.body` by an allow-list of known keys to guard against mass assignment.
5. **Rate Limiting & Logging**: Pair with a rate-limiter or WAF and log suspicious parameter patterns for defense-in-depth.

---

## Development & Testing

```bash
npm test       # runs your test suite
npm run build   # compile CJS & ESM bundles via TypeScript
```

---

## License

MIT © Rayen Boussayed
