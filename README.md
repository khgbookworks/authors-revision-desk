# Author's Revision Desk

A private, browser based manuscript review workspace for authors and beta readers.

## What it does

The app lets an author import or paste a manuscript, automatically split common chapter headings, record beta reader feedback under consistent professional lenses, keep an original draft beside an improved version, and download the results separately.

Available downloads include:

1. Feedback report as Markdown for the whole manuscript or the current chapter.
2. Improved manuscript as plain text for the whole manuscript or the current chapter.
3. Project backup as JSON so the author can restore the workspace in another browser.

## Privacy

This is a client side app. Manuscript text, feedback, and revisions are stored in the browser's local storage. No login or manuscript server is required. Authors should download a project backup before clearing browser data.

## Local development

```bash
npm start
```

The preview server uses port 3000. To build the static distribution:

```bash
npm run build
```

The published output is in `dist/`.

## GitHub

The Webdev project is saved to its managed Git remote. To place the code in a personal GitHub repository, connect the project through the Manus GitHub integration or push the project files to a repository with GitHub Pages enabled. The static `dist/` output can be hosted by GitHub Pages, Netlify, Cloudflare Pages, or another static host without a backend.
