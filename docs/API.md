# ForceOrg-40k — REST API Reference

The self-hosted instance's HTTP API is the single integration surface for
external systems. Everything runs on infrastructure you control (see
[`docs/DEPLOYMENT.md`](DEPLOYMENT.md)); there is no shared backend behind it,
so any integration target is your own ForceOrg server.

- **Base URL:** `http://<your-host>:4000/api` (configurable via `PORT`)
- **Content type:** `application/json` (except photo uploads, `multipart/form-data`)
- **Schema:** machine-readable OpenAPI 3.1 — [`docs/OPENAPI.yaml`](OPENAPI.yaml)
- **Types:** request/response shapes are generated from `packages/types` —
  external consumers can use the published TypeScript types directly.

## Transport rules

- **CORS** — browsers may only call the API from the origin in `CORS_ORIGIN`
  (default `http://localhost:3000`). Server-to-server calls are unaffected.
- **Rate limit** — 300 requests per 15-minute window per IP on all `/api`
  routes. Exceeding it returns HTTP 429 (`RATE_LIMITED` topic below).

## Authentication

Read endpoints are public. Write endpoints require a JWT:

```
Authorization: Bearer <token>
```

- **Algorithm:** HS256
- **Secret:** your instance's `JWT_SECRET` (see `apps/api/.env`)
- **Claims:** `sub` (user id, required), `email` (optional), standard
  `iat`/`exp` expiry

Any client holding a token signed with the instance's `JWT_SECRET` can manage
rosters as that `sub`. There is no third-party identity provider in the loop —
you mint tokens for your own users and integrations.

**Minting a token** (e.g. for an external system that syncs rosters):

```bash
node -e "console.log(require('jsonwebtoken').sign(
  { sub: 'USER_PROFILE_UUID' },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
))"
```

Two requirements on the `sub` claim:

1. it must be a **UUID** — roster rows key on `user_profiles.id` (Prisma
   `@db.Uuid`); an arbitrary string fails with a database error, and
2. a matching **`user_profiles` row must exist** (`sub` → `user_id` foreign
   key). Until the local signup endpoint lands, provision the profile row
   directly in the database (see `packages/db-client/prisma/schema.prisma`).

Requests with a missing token on protected routes return HTTP 401
`UNAUTHORIZED`; invalid/expired tokens return HTTP 401 `TOKEN_INVALID`.

## Endpoints

<details>
<summary>Health</summary>

### `GET /health`

Liveness probe. Returns the service version and timestamp.

```bash
curl http://localhost:4000/api/health
```

```json
{ "success": true, "data": { "status": "operational", "version": "1.0.0", "timestamp": "2026-10-05T12:00:00.000Z" } }
```

</details>

### Catalog (public, read-only)

#### `GET /datasheets`

Datasheets with their weapons, abilities, wargear rules, and leader
relations. Supports pagination and filters.

| Query param | Type | Description |
|---|---|---|
| `factionId` | string | Filter by faction (e.g. `adeptus_astartes`) |
| `role` | string | Filter by battlefield role (`CHARACTER`, `BATTLELINE`, …) |
| `page` | int | Page number (default `1`) |
| `limit` | int | Page size (default `50`) |

Successful responses carry `meta`: `{ page, totalPages, totalCount }`.

#### `GET /datasheets/:id`

Single datasheet with full relations (adds `bodyguardsFor`).

#### `GET /stratagems`

| Query param | Type | Description |
|---|---|---|
| `phase` | string | `COMMAND`/`MOVEMENT`/`SHOOTING`/`CHARGE`/`FIGHT`/`ANY` |
| `category` | string | `CORE` or `DETACHMENT` |
| `detachmentId` | string | Detachment filter |

#### `GET /weapons`

Full weapon registry, `name` ascending.

#### `GET /changelog`

Balance-change feed and Wahapedia ETL sync records. Public.

### Rosters (JWT required)

All roster routes operate **as the token's `sub`** — rosters are owned by
user id and queries are always scoped to it. Ownership is enforced on every
read and write (foreign rosters return `NOT_FOUND`).

| Method & path | Purpose |
|---|---|
| `GET /rosters` | List your rosters (newest first) |
| `GET /rosters/:id` | One roster, including its unit media records |
| `POST /rosters` | Create a roster |
| `PUT /rosters/:id` | Update metadata / `rosterPayload` (partial; omitted fields keep current values) |
| `DELETE /rosters/:id` | Delete a roster, cascading its media |

**`POST /rosters` request body:**

```json
{
  "name": "Ultramarines 1st Company",
  "factionId": "adeptus_astartes",
  "detachmentPrimary": "1st Company Task Force",
  "detachmentSecondary": null,
  "pointsLimit": 2000,
  "detachmentPointsLimit": 3,
  "factionThemeOverride": "ultramarines",
  "rosterPayload": { "units": [], "totalPoints": 0, "detachmentPointsUsed": 0 }
}
```

Only `name` and `factionId` plus `detachmentPrimary` are required in practice
(missing fields default server-side); `rosterPayload` is the client-defined
unit selection (array of unit instances, ids referencing datasheet ids).
`rulesetVersionId` is set by the server (`11.1.0-2026-Q3`).

#### `POST /rosters/:id/audit` (JWT required)

Runs the rules-compliance audit for one of your rosters — points shifts and
detachment quota adherence against the current ruleset. Returns an
`AuditResult` (`isCompliant`, `discrepancies[]` with `severity`/`category`).

### Media (JWT required)

Photos process through Sharp and store in the instance's own S3-compatible
storage (SeaweedFS/MinIO/etc. — local by default; never a public bucket
unless you point `S3_ENDPOINT` at one).

#### `POST /rosters/:rosterId/units/:unitInstanceId/media`

- `multipart/form-data`
- File field: any (first file is used; the web app sends `miniature_photo`)
- Also accepted via `POST /media/upload` with `rosterId` and `unitInstanceId`
  form fields
- Accepts `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`
- Max size 10 MB
- Must belong to the token's `sub`; the response contains a `media` record
  (`imageUrl`, `thumbnailUrl`, `storageKeyPrefix`) plus a `processing` block
  with the generated card/thumbnail dimensions

#### `DELETE /rosters/:rosterId/units/:unitInstanceId/media`

Deletes the stored variants and DB record for that unit. Also available as
`DELETE /media/:id` using the media record id.

## Response envelope

Every endpoint wraps its payload in a common envelope:

```json
{ "success": true, "data": { "…": "…" }, "meta": { "…": "…" } }
```

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Roster not found." } }
```

The web app's own consumption of this envelope lives in
`apps/web/src/lib/api.ts`.

### Error codes

| Code | Meaning |
|---|---|
| `UNAUTHORIZED` | Missing `Authorization` header (401) |
| `TOKEN_INVALID` | Bad or expired JWT (401) |
| `NOT_FOUND` | Unknown route, datasheet, or foreign roster (404) |
| `INVALID_PARAMS` / `NO_FILE` | Malformed request or missing upload file (400) |
| `RATE_LIMIT_EXCEEDED` | Over 300 req/15 min from one IP (429) |
| `INTERNAL_ERROR` / `DB_ERROR` / `UPLOAD_ERROR` / `AUDIT_ERROR` | Server-side failure (500) |

## Versioning

The API is currently unversioned (single consumer, pre-1.0). Breaking changes
will be announced in the repo changelog; the OpenAPI file is the source of
truth for the current surface.
