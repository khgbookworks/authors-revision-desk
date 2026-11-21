# Author's Revision Desk expansion plan

## Product direction

The app will have two clearly separated modes. **Beta Reading** is for reader perspective only. Its output will be framed as personal, specific suggestions rather than authoritative edits, and the book text will remain unchanged. **Book Formatter** is for a finished, already revised manuscript. It will format the wording as supplied, never silently rewrite it, and export a professional reading file.

## Design choice

Three possible directions were considered:

1. Editorial archive workspace, 0.07 probability: quiet paper surfaces, forest green navigation, coral annotations, and a bookish serif display face.
2. Modern publishing tool, 0.06 probability: bright white panels, blue controls, and a compact dashboard grid.
3. Literary studio, 0.04 probability: dark ink canvas, warm brass controls, and a full screen writing focus.

Chosen direction: **Editorial archive workspace**.

### Core principles

1. Keep the distinction between suggestion and editing visible at every important action.
2. Treat the author's wording as source material, never as content to be silently improved.
3. Make professional defaults helpful without removing author choice.
4. Keep manuscript text local in the browser and make exports explicit.

### Color philosophy

Warm paper and sage surfaces make the tool feel private and readable. Forest green signals trust and preservation. Coral marks reader observations and decisions without looking like an error state.

### Layout paradigm

Use a long editorial desk with strong horizontal section breaks and a rail for manuscript context, then move the formatter into a clean, step based page panel rather than a dense application dashboard.

### Signature elements

1. Coral editorial marks for feedback and formatting choices.
2. Serif book titles and work surfaces that feel like a reading room.
3. Small uppercase labels that make workflow stage and file ownership clear.

### Interaction philosophy

Buttons should describe the author's intent in plain language. The beta mode should offer suggestions and export, not a rewrite button. The formatter should preview the final shape before downloading and keep a visible note that text is unchanged.

### Animation

Use only small lift and fade transitions for buttons, panels, and toast messages. Respect reduced motion preferences. No decorative motion should compete with manuscript reading.

### Typography system

Use Newsreader for bookish headlines, chapter titles, and preview pages. Use DM Sans for controls, labels, file states, and explanatory notes. Keep body copy open and short enough to scan on a phone.

### Brand essence

A private revision desk for authors who want useful reader response and professional exports without surrendering their voice. Personality: candid, careful, author led.

### Brand voice

Headlines should be direct and reassuring. Example lines: “A reader's response, not a verdict.” and “Format the finished book without changing a word.”

### Wordmark and logo

Retain the existing circular italic R mark as a simple editorial seal beside the Author's Revision Desk wordmark.

### Signature brand color

Forest green #1f4338 is the ownable anchor, with coral #a94736 reserved for reader notes and active decisions.

## Implementation

1. Extend the existing single page into two switchable application views: `#workspace` for beta reading and `#formatter` for finished book formatting.
2. Add a mode switch and clear disclaimer in the beta reading panel: feedback is reader perspective and suggestions only; the original manuscript is never changed by feedback capture.
3. Keep the original and improved text tabs, but relabel the improved tab as an optional author draft and remove language that implies the beta reader or AI has edited the book.
4. Add a local feedback generator based on the user's supplied reader notes and prompts. It must produce a suggestion brief that preserves the user's wording and must not modify chapter text.
5. Add formatter state persisted separately in local storage. Support TXT, Markdown, HTML, DOCX, and PDF import in the browser.
6. Ask for book type, page or trim size, typography, chapter treatment, spacing, front matter, and page numbering. If book type is left at automatic, recommend a default based on the manuscript structure while keeping every choice editable.
7. Generate a formatted HTML preview with the source manuscript wording unchanged. Export EPUB through JSZip, DOC through a standards compatible Word HTML file, and PDF through the browser print dialog with a clearly labeled Save as PDF action.
8. Keep all text and settings local to the browser. Add a backup export for formatter settings and source text.
9. Update the route manifest to include `/formatter` as a declared page route and keep the static build contract intact.

## Project structure

The existing static project remains intentionally small:

* `index.html` owns the semantic shell, beta workspace, formatter page, and CDN helpers.
* `app.js` owns local state, chapter feedback, reader suggestion framing, formatter preferences, preview generation, and exports.
* `styles.css` owns the editorial visual system and responsive states for both modes.
* `manus-routes.json` declares `/` and `/formatter` for managed preview.
* `build.js` copies the static source into `dist/` for publication.


## Author-controlled editing workspace

The third mode, `/editing`, sits between beta reading and finished-book formatting. It accepts the same browser-side manuscript imports, stores a separate editing project in local storage, and keeps the source text immutable. Authors choose an editing goal or allow a conservative recommendation. Mechanical passes can propose limited wording changes; developmental, structural, continuity, and sensitivity passes produce review notes that authors can refine rather than claiming to replace a specialist editor.

Each suggestion stores its source segment, proposed wording, reason, location, and status. The author can edit the proposed wording, approve or reject it individually, approve or reject all, and download only the approved result. HTML and Word-compatible review exports show deletions, insertions, reasons, and statuses so a client can review the paper trail in a document editor. JSON preserves the complete decision record. The visual system extends the editorial archive style with coral change marks, green approval states, responsive cards, small lift transitions, and reduced-motion support.
