# Author's Revision Desk build plan

## Current development status

The following work has been implemented on the isolated `formatter-rebuild` branch. It is not deployed to production and has not been merged into `main`.

- [x] D1 schema for projects, immutable versions, private shares, review decisions, and per-project AI usage.
- [x] Pages Function API for project creation, owner-authenticated load/save, version history, share creation, and share revocation.
- [x] R2 manuscript snapshot storage and D1 metadata storage.
- [x] Private author-review page with per-suggestion accept/reject/comment and chapter comments.
- [x] Owner recovery-key export/import and cloud response inbox.
- [x] Owner-side sync of accepted/rejected decisions to the matching local editing suggestions. Original manuscript text is not changed by those decisions.
- [x] Workers AI routes for editing suggestions, chapter beta reports, and whole-book synthesis from chapter reports.
- [x] Per-project AI limits: 40 requests and 250,000 input characters per UTC day.
- [x] AI disclosure in the interface and AI-assisted report labels.
- [x] DOCX/HTML formatter import preserves supported rich text (bold, italics, headings, paragraph structure) in preview and exports.
- [x] DOCX export writes rich text runs for bold, italic, underline, superscript, and subscript.
- [x] Formatter content checks for empty sections, duplicate headings, long paragraphs, missing metadata, and contents-page setup.
- [x] CI syntax, build, schema, token, route, and formatter-control checks pass on the development branch.
- [ ] Create and bind Cloudflare D1, R2, and Workers AI resources in the Pages dashboard.
- [ ] Test the live API and the full create → save → reconnect → review → author decision → owner sync flow.
- [ ] Open exported DOCX in Microsoft Word and EPUB in an e-reader; verify PDF pagination in browser print preview.
- [ ] Test real DOCX import samples with headings, bold, italics, lists, scene breaks, and dialogue.
- [ ] Implement editor collaborator submissions and a project-level collaboration inbox.
- [ ] Complete project dashboard, project discovery, archive/delete, and version restore controls.
- [ ] Add whole-book report export and improve review-round history.
- [ ] Decide whether Google Docs integration is still required; current endpoint remains a clearly disabled stub.
- [ ] Complete browser-based responsive, accessibility, and security testing before production deployment.

## Operation sequence

1. Finish code-level formatter and backend validation on `formatter-rebuild`.
2. Configure Cloudflare bindings and deploy a branch preview only after the code checks pass.
3. Run live end-to-end tests with a sample manuscript and verify access control, saved versions, review decisions, AI limits, and exports.
4. Fix issues found in live tests; do not merge into `main` until the user approves the verified build.
5. Continue with editor collaboration, project dashboard, report exports, and remaining production QA.

---

# Author's Revision Desk TODO

## Beta reading is reader perspective and suggestion only

Acceptance criteria:

1. The app clearly labels beta reading as a reader response, not an editorial verdict.
2. AI assisted or organized feedback uses a personal, specific, human reader tone rather than stiff generic language.
3. Feedback is framed as suggestions the author can accept, question, or ignore.
4. Capturing feedback never changes the author's manuscript text.
5. The author's voice is not rewritten by the beta reading workflow.
6. The original draft remains preserved and the optional author draft is clearly marked as an author controlled working copy.
7. Feedback exports include the reader's observations, requested focus, author decision, and suggested next steps without replacing the manuscript.

## Accessible manuscript intake

Acceptance criteria:

1. Authors can paste copied text directly into a large manuscript field on phone and desktop.
2. A clipboard helper provides a clear fallback when browser clipboard permission is unavailable.
3. Authors can choose or drag and drop TXT, Markdown, HTML, DOCX, and PDF files.
4. Supported files are read in the browser and manuscript text stays off a manuscript server.
5. Import controls work with keyboard, touch, and small screens.

## Finished book formatter

Acceptance criteria:

1. A separate formatter page or mode accepts a finished, beta read, already edited manuscript that is ready for publication formatting.
2. The formatter asks how the author wants the book to look, including book type, page or trim size, typography, chapter treatment, spacing, front matter, and page numbering.
3. If the author is unsure of the book type, the formatter can recommend a professional default from the manuscript structure and keep the choice editable.
4. Formatting changes presentation only and do not rewrite, paraphrase, or change the author's words or voice.
5. The author can preview the formatted result before export.
6. The author can download the formatted book as EPUB, PDF, DOCX, DOC, and a plain HTML backup.
7. DOCX and HTML imports retain supported rich text, including bold, italics, headings, and paragraph structure.
8. The formatter works on phones and computers with clear controls and readable previews.

## Existing revision workspace

Acceptance criteria:

1. Common chapter headings split into separate chapter workspaces, with an option to add chapters manually.
2. The workspace keeps the original draft and a separate author controlled working copy for every chapter.
3. Authors or beta readers can record detailed feedback by first impression, emotional impact, character development, patterns, plot and pacing, clarity, overall reader experience, and suggestions for improvement.
4. Authors can name feedback focus areas, record an author's decision after review, select multiple improvement focuses, and add repeated editing passes.
5. Feedback and project data persist locally in the browser.
6. Feedback can be downloaded separately as Markdown for the whole manuscript or the current chapter.
7. The project can be downloaded as a JSON backup.
8. The interface retains a local browser mode without login. Optional cloud projects use owner access keys and server-side storage.
9. The project includes a self contained build output suitable for static hosting such as GitHub Pages.


## Author-controlled editing workspace

Acceptance criteria:

1. The app exposes a clearly separate Editing Workspace between beta reading and finished-book formatting.
2. Authors can paste or import TXT, Markdown, HTML, DOCX, and PDF manuscripts into the editing workspace on phones and computers.
3. Authors can choose developmental, structural, copyediting, line editing, proofreading, continuity, or sensitivity goals, or receive a professional starting recommendation.
4. The original manuscript is preserved separately and is never silently overwritten by a suggestion.
5. Each generated suggestion shows the original wording, proposed wording, reason for the suggestion, location, and pending status.
6. Authors can edit proposed wording and approve or reject each suggestion, or approve or reject all suggestions.
7. Only approved suggestions appear in the edited manuscript export; rejected and pending suggestions leave the original wording in place.
8. The app provides separate downloads for the approved manuscript as TXT, clean HTML, and Word-compatible DOC, plus an HTML comparison, a Word-compatible review document with visible insertions and deletions, and a JSON decision backup.
9. Comparison exports retain the reason for each suggested edit and clearly state that the author must review the changes in Word or Google Docs.
10. Editing state, approval status, and the original source persist locally in the browser and the layout remains usable on small screens with reduced-motion support.

## Native DOCX Track Changes and optional AI profile
Acceptance criteria:
1. The editing workspace offers a real `.docx` package rather than only HTML with visible markup.
2. The package contains Word `w:ins` and `w:del` revision elements with author, date, and revision identifiers.
3. Reasons remain available as Word comments or a companion review record.
4. Authors can define voice, tone, audience, protected phrases, and custom instructions.
5. AI suggestions are structured, labelled, pending by default, and never overwrite the original.

## Google Docs synchronization boundary
Acceptance criteria:
1. The workspace exposes a Google Docs sync path that uses an authorized server-side Workspace connector.
2. Existing-document edits use Google Docs Suggesting mode when credentials are available.
3. New-document handoff returns a Google Docs link after successful creation.
4. When no credentials are connected, the interface clearly reports that sync is unavailable and provides safe local exports instead of faking synchronization.
