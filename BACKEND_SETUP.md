# Cloud backend setup

The application has Cloudflare Pages Function routes for persistent projects, immutable version snapshots, private collaboration links, author review decisions, and optional Workers AI processing. Project storage requires D1 and R2. AI tools additionally require the Workers AI binding. Until the required bindings are connected, the browser-only workspace remains available and the health endpoint reports which services are ready.

## Required Cloudflare resources

Create these resources in the same Cloudflare account as the Pages project:

1. **D1 database** named `authors-revision-desk`.
2. **R2 bucket** named `authors-revision-desk-manuscripts`.

From a terminal with Wrangler authenticated to the correct Cloudflare account:

```bash
npx wrangler d1 create authors-revision-desk
npx wrangler r2 bucket create authors-revision-desk-manuscripts
```

Apply the schema:

```bash
npx wrangler d1 execute authors-revision-desk --remote --file=migrations/0001_manuscript_workspace.sql
```

## Bind resources to Cloudflare Pages

In Cloudflare:

1. Open **Workers & Pages** and select the `authors-revision-desk` Pages project.
2. Open **Settings → Functions → Bindings**.
3. Add a D1 database binding with variable name **DB**, selecting `authors-revision-desk`.
4. Add an R2 bucket binding with variable name **MANUSCRIPTS**, selecting `authors-revision-desk-manuscripts`.
5. Add a Workers AI binding with variable name **AI** if you want the AI editing and beta-reading tools. Pages Functions receive this binding through the dashboard.
6. Save the bindings and redeploy the Pages project so the Functions receive them.

Do not put database credentials, owner keys, or share keys in source code or GitHub. D1 and R2 are accessed through Cloudflare's server-side bindings.

## Backend routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Reports D1, R2, and Workers AI binding readiness |
| POST | `/api/projects` | Creates a project and returns its owner key once |
| GET | `/api/projects/:id` | Loads the current project version, version list, and author responses; add `?versionId=...` to retrieve an older version |
| PUT | `/api/projects/:id` | Saves a new immutable project version |
| POST | `/api/projects/:id/shares` | Creates a time-limited author-review or editor link |
| DELETE | `/api/projects/:id/shares?shareId=...` | Revokes a collaboration link |
| DELETE | `/api/projects/:id` | Archives a project and revokes all active collaboration links |
| GET | `/api/reviews/:shareId` | Loads the shared review snapshot |
| POST | `/api/reviews/:shareId` | Stores an author's accept, reject, or comment decision, or an editor's proposed wording and reason depending on the link role |
| POST | `/api/ai-edit` | Authenticated, structured AI editing suggestions |
| POST | `/api/beta-read` | Authenticated chapter-level beta-reading report |
| POST | `/api/beta-read/book` | Whole-book synthesis from saved chapter reports |

All project and review routes require a bearer key. Only SHA-256 hashes of those keys are stored in D1. Keys are generated from cryptographically secure random bytes and returned once. Review links should carry the secret in a URL fragment, then send it in the Authorization header; fragments are not sent to the server in ordinary HTTP requests.

Manuscript snapshots are stored as JSON objects in R2. D1 stores project metadata, version pointers, share permissions, and review decisions. Each save creates a new version rather than overwriting the previous snapshot.

## Current boundary

The browser now includes cloud-copy creation, manual version saves, recovery-key export/import, version restore, a local multi-project dashboard for recovery keys connected in that browser, project archiving, author-review links, editor collaboration links, an author review page, and an owner response inbox. Editor proposals can be imported into the owner's pending editing queue. The dashboard is not yet an account-wide cross-device project list; it depends on the recovery keys stored in the current browser. AI chapter reports, whole-book synthesis, and editing suggestions are connected to authenticated endpoints and are saved as new cloud versions after generation. Each project is limited to 40 AI requests and 250,000 input characters per UTC day; this is not an account-wide spending cap or a guaranteed dollar ceiling. Workers AI is metered, so monitor usage and billing in Cloudflare.

The Cloudflare resources still need to be created and bound in the dashboard. Do not treat the backend as production-ready until the live binding checks, access-control tests, AI quota behavior, review-decision round-trip, and full manuscript restore have passed.
