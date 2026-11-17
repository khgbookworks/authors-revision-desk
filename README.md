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

## GitHub Pages

The repository includes a GitHub Actions workflow that builds `dist/` and deploys it to GitHub Pages on every push to `main`. The app uses relative asset paths so it works from a repository subpath.

## Project structure

`index.html` contains the author onboarding flow and workspace structure. `styles.css` contains the responsive editorial interface. `app.js` contains manuscript parsing, chapter navigation, feedback capture, revision editing, local persistence, and downloads. `build.js` creates the static `dist/` output.
