# Author's Revision Desk

A private, browser based manuscript workspace for authors, beta readers, and finished-book formatting.

## Two separate modes

### Beta Reading

The beta reading workspace is for reader perspective only. It helps a reader or author record what the chapter made them feel, expect, question, and suggest. Feedback is deliberately framed as something the author can consider, question, or ignore.

The app does not apply reader notes to the manuscript. It does not silently rewrite the author's voice. The original draft remains separate from the author's optional working copy, which the author edits manually if they choose.

Feedback downloads are available as Markdown for the whole manuscript or the current chapter. They include reader observations, the requested feedback focus, the author's decision after review, and possible next steps without replacing the manuscript text.

### Book Formatter

The Book Formatter is intended for a finished manuscript that has already been beta read and edited. It asks for presentation choices such as:

* book type, with a professional recommendation when the author chooses automatic selection
* trim or page size
* book font
* chapter treatment
* title page, contents page, and page number styling

Formatting changes presentation only. It does not paraphrase, proofread, shorten, or change the author's wording.

The formatter can export:

1. EPUB
2. DOC compatible Word HTML
3. PDF through the direct browser PDF helper, with a print and Save as PDF fallback
4. HTML
5. Formatting preferences and source text as a JSON backup

## Import and privacy

Authors can paste text or choose TXT, Markdown, HTML, DOCX, and PDF files. DOCX and text based PDF files are read in the browser. Scanned PDFs that contain only images need OCR before import.

This is a client side app. Manuscript text, feedback, formatting preferences, and revisions are stored in the browser's local storage. No login or manuscript server is required. Authors should download a project or format backup before clearing browser data.

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

## GitHub Pages

GitHub Pages is configured to publish the `main` branch from the repository root. The public app is available at:

https://khgbookworks.github.io/authors-revision-desk/

The app uses relative asset paths so it works from the repository subpath. The formatter is available inside the app at `#formatter` and through the managed `/formatter` route.

## Project structure

`index.html` contains the beta reading and formatter views. `styles.css` contains the responsive editorial interface. `app.js` contains manuscript parsing, chapter navigation, suggestion capture, author-controlled copies, formatter preferences, preview generation, local persistence, and downloads. `manus-routes.json` declares the app routes. `build.js` creates the static `dist/` output.
