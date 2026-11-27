# Author's Revision Desk

A private, browser based manuscript workspace for authors, beta readers, and finished-book formatting.

## Three separate modes

### Beta Reading

The beta reading workspace is for reader perspective only. It helps a reader or author record what the chapter made them feel, expect, question, and suggest. Feedback is deliberately framed as something the author can consider, question, or ignore.

The app does not apply reader notes to the manuscript. It does not silently rewrite the author's voice. The original draft remains separate from the author's optional working copy, which the author edits manually if they choose.

Feedback downloads are available as Markdown for the whole manuscript or the current chapter. They include reader observations, the requested feedback focus, the author's decision after review, and possible next steps without replacing the manuscript text.

### Author-Controlled Editing

The Editing Workspace is for authors who want to take a manuscript through a specific editing pass after beta reading. Choose developmental review, structure and pacing, copyediting, line editing, proofreading, continuity, or sensitivity review. Automatic browser-side suggestions are deliberately conservative for mechanical passes; broader passes create review notes rather than pretending to replace a specialist editor.

The original manuscript is preserved. Each suggested change has a visible before-and-after comparison, an explanation of why it was suggested, an editable proposed wording field, and separate Approve and Reject controls. Only approved changes appear in the edited manuscript download. Pending and rejected suggestions leave the original wording in place.

Editing exports include the approved manuscript as TXT, clean HTML, and Word-compatible DOC, plus a browser-readable HTML comparison, a Word-compatible review document with visible insertions and deletions, and a JSON backup containing the original, proposed wording, reasons, and approval status. The Word-compatible review is designed for opening in Word or importing into Google Docs; authors should still review and approve changes in their document editor because this static app does not connect to a live Google Docs or Word account.

### Book Formatter

The Book Formatter is intended for a finished manuscript that has already been beta read and edited. DOCX and HTML imports preserve supported rich text such as bold, italics, headings, and paragraph structure in the formatter preview and exports. The formatter also runs content-level checks for empty sections, duplicate headings, unusually long paragraphs, and missing metadata; final pagination still needs a manual print-preview check. It asks for presentation choices such as:

* book type, with a professional recommendation when the author chooses automatic selection
* trim or page size
* book font
* chapter treatment
* title page, contents page, and page number styling

Formatting changes presentation only. It does not paraphrase, proofread, shorten, or change the author's wording.

The formatter can export:

1. EPUB
2. DOCX with supported rich text
3. DOC compatible Word HTML
4. PDF through the browser print and Save as PDF flow
5. HTML
6. Formatting preferences and source text as a JSON backup

## Import and privacy

Authors can paste text or choose TXT, Markdown, HTML, DOCX, and PDF files. DOCX and text based PDF files are read in the browser. Scanned PDFs that contain only images need OCR before import.

The app retains browser-local storage as a working mode. The Cloudflare backend adds persistent project snapshots in R2, project and version metadata in D1, private access keys, revocable collaboration links, and author review decisions. Cloud storage is not considered active until the D1 and R2 bindings are configured. The health endpoint reports that state instead of pretending that local storage is cloud backup. Authors should keep a separate export backup as well.

If an AI reader has supplied notes, treat those notes as unverified suggestions rather than as a human reader's final judgment. The app keeps the wording of those notes and does not present them as an editorial verdict.

## Local development

```bash
npm start
```

The preview server uses port 3000. To build the static distribution:

```bash
npm run build
```

The published output is in `dist/`.

## Cloudflare Pages development

The active development branch is `formatter-rebuild`. The production Pages branch, existing GitHub Pages deployment, and `main` branch are being kept unchanged while this build is tested.

- Build command: `npm run build`
- Build output directory: `dist`
- Cloudflare Pages Functions live in the root `functions/` directory.
- `GET /api/health` reports D1, R2, and optional Workers AI binding readiness.
- `POST /api/ai-edit` provides authenticated editing suggestions.
- `POST /api/beta-read` provides an authenticated chapter-level reader report.
- `POST /api/beta-read/book` synthesizes the available chapter reports into a whole-book assessment.
- Google Docs routes remain explicit unavailable stubs until an authorized integration is configured.
- The browser checks service readiness and requires a cloud project owner key before sending manuscript text to Workers AI.

Do not disable the existing GitHub Pages workflow or merge this development branch until the Cloudflare Pages build, live API, manuscript restore, author review, AI usage limits, and exports have been tested.

## GitHub Pages

GitHub Pages is configured to publish the `main` branch from the repository root. The public app is available at:

https://khgbookworks.github.io/authors-revision-desk/

The app uses relative asset paths so it works from the repository subpath. The Editing Workspace is available at `#editing` and through the managed `/editing` route. The formatter is available inside the app at `#formatter` and through the managed `/formatter` route.

## Project structure

`index.html` contains the beta reading, author-controlled editing, and formatter views. `styles.css` contains the responsive editorial interface. `app.js` contains manuscript parsing, chapter navigation, suggestion capture, approval tracking, comparison generation, author-controlled copies, formatter preferences, preview generation, local persistence, and downloads. `manus-routes.json` declares the app routes. `build.js` creates the static `dist/` output.

## Native Word revisions, AI profiles, and Google Docs

The editing workspace now includes a native `.docx` export with OOXML `w:ins` and `w:del` revision elements, revision author/date metadata, and Word comments containing the reason for each proposed change. Rejected suggestions remain unchanged; pending and approved suggestions are represented in the review package so the author can decide in Word. The existing HTML review remains a readable companion export.

Authors can optionally define the voice to protect, editing tone, intended audience, protected phrases or spellings, and custom instructions. AI output is intended to remain a suggestion and stay pending until the author approves it. The development branch includes authenticated Workers AI endpoints for chapter beta-reading, whole-book synthesis from chapter reports, and structured editing suggestions. AI runs only when the author starts an action, requires a cloud project and the Pages Workers AI binding, and is subject to per-project daily limits. Reports are labeled AI-assisted and should be reviewed by a human before sharing. The live Cloudflare binding and model behavior still need end-to-end testing.

Google Docs controls are not connected in the Cloudflare migration branch yet. The interface checks the service status before sending manuscript text, and the API returns an explicit unavailable response until an authorized integration is implemented. Native DOCX, HTML, and JSON exports remain available.


## Persistent Cloudflare backend

The backend schema and Pages Function routes are in this branch. Follow [BACKEND_SETUP.md](BACKEND_SETUP.md) to create the D1 database, R2 bucket, apply the migration, and connect the `DB`, `MANUSCRIPTS`, and optional `AI` bindings. The app now includes manual cloud-copy creation, immutable cloud version saves, private author-review link creation, and a review page for accepting, rejecting, or commenting on proposed edits and chapters. The API also includes authenticated Workers AI endpoints for chapter-level beta reports, whole-book synthesis from those reports, and editing suggestions. AI is optional and requires the Pages Workers AI binding. It is not called automatically: the author starts each report or editing pass. Per-project daily limits apply, and generated feedback is labeled AI-assisted. The API is not production-ready until live Cloudflare bindings, review decisions, owner-side decision retrieval, revocation, AI quota behavior, and full manuscript round-trip have been tested end to end.
