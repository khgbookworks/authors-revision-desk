const feedbackDefinitions = [
  ["firstImpression", "First impression", "What did the opening make you expect, feel, or wonder?", "Start with the immediate reader response before explaining why."],
  ["emotionalImpact", "Emotional impact", "Where did the chapter move you, unsettle you, or leave you distant?", "Name the feeling or the absence of feeling."],
  ["characterDevelopment", "Character development", "What changed for the characters, and where did a choice feel earned or too convenient?", "For nonfiction, use this for the author's presence or the people in the story."],
  ["patterns", "Patterns noticed", "What ideas, images, structures, or repeated habits became visible?", "Notice what the book returns to, on purpose or by accident."],
  ["plotPacing", "Plot and pacing", "Where did the chapter pull you forward, slow down, rush, or resolve tension too quickly?", "Say where your attention changed."],
  ["clarity", "Clarity", "What was clear, confusing, unsupported, or open to misinterpretation?", "Mark the moment rather than making a general complaint."],
  ["readerExperience", "Overall reader experience", "What kind of reader will connect with this, and what might make another reader hesitate?", "Include the honest experience of a supportive and a skeptical reader."],
  ["suggestions", "Suggestions for improvement", "What specific change might make the chapter more effective?", "Offer something the author can consider, not an instruction they must obey."]
];

const suggestionTypes = [
  ["developmental", "Look at the larger shape"],
  ["structure", "Try a different order"],
  ["character", "Look more closely at motivation"],
  ["plot", "Build or hold the tension"],
  ["voice", "Protect the voice while revising"],
  ["clarity", "Make a moment easier to follow"],
  ["continuity", "Check the thread across chapters"],
  ["sensitivity", "Read the representation again"],
  ["line", "Consider a line level pass"],
  ["proofreading", "Save proofreading for the end"]
];

const storageKey = "authors-revision-desk-project";
const formatterStorageKey = "authors-revision-desk-formatter";
const editorStorageKey = "authors-revision-desk-editor";
const cloudStorageKey = "authors-revision-desk-cloud-project";
const makeId = () => `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const onboarding = $("#onboarding");
const desk = $("#desk");
const toast = $("#toast");

const defaultFeedback = () => Object.fromEntries(feedbackDefinitions.map(([key]) => [key, ""]));
const defaultChapter = (title, draft = "") => ({ id: makeId(), title, draft, improved: draft, feedback: defaultFeedback(), customFocus: "", authorDecision: "", suggestionTypes: [], editingPasses: [] });
const defaultFormatter = () => ({ title: "", author: "", subtitle: "", copyright: "", dedication: "", acknowledgements: "", sourceText: "", settings: { bookType: "auto", trimSize: "6x9", font: "newsreader", chapterStyle: "classic", includeFrontMatter: true, includeToc: true, includePageNumbers: true, includeRunningHeaders: false, margin: "standard", fontSize: "11.5", lineSpacing: "1.55", paragraphIndent: "0.22", gutter: "0.18" } });

let state = loadState() || { title: "", chapters: [], selectedId: null, updatedAt: null };
let formatter = loadFormatterState();
let editor = loadEditorState();
let cloudProject = loadCloudProject();
let saveTimer;

function loadCloudProject() {
  try {
    const saved = JSON.parse(localStorage.getItem(cloudStorageKey));
    return saved && saved.id && saved.ownerToken ? saved : null;
  } catch (error) {
    return null;
  }
}

function cloudSnapshot() {
  return {
    schemaVersion: 1,
    beta: state,
    editor,
    formatter,
    savedAt: new Date().toISOString()
  };
}

async function cloudRequest(path, method = "GET", payload = null, token = cloudProject?.ownerToken) {
  const headers = { "Accept": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (payload !== null) headers["Content-Type"] = "application/json";
  const response = await fetch(path, {
    method,
    headers,
    body: payload === null ? undefined : JSON.stringify(payload),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Cloud request failed (${response.status}).`);
  return data;
}

function renderCloudActions() {
  const status = $("#cloudStatus");
  const create = $("[data-cloud-create]");
  const save = $("[data-cloud-save]");
  const share = $("[data-cloud-share]");
  if (!status || !create || !save || !share) return;
  const connected = Boolean(cloudProject);
  status.textContent = connected ? `Cloud project connected · ${cloudProject.title}` : "Cloud backup is not connected";
  create.hidden = connected;
  save.hidden = !connected;
  share.hidden = !connected;
}

async function ensureCloudBackend() {
  const response = await fetch("/api/health", { cache: "no-store" });
  const health = await response.json().catch(() => ({}));
  if (!response.ok || !health.backend?.ready) {
    throw new Error("Cloud storage is not connected on this deployment yet. Your manuscript has not been uploaded. Configure the D1 and R2 bindings on Cloudflare Pages first.");
  }
}

async function createCloudProject() {
  const hasContent = state.chapters.length || editor.sourceText.trim() || formatter.sourceText.trim();
  if (!hasContent) { showToast("Open a manuscript or add editing or formatting content before creating a cloud project."); return; }
  const title = state.title || editor.title || formatter.title || "Untitled manuscript";
  try {
    await ensureCloudBackend();
    const result = await cloudRequest("/api/projects", "POST", { title, snapshot: cloudSnapshot() }, "");
    cloudProject = { id: result.project.id, title: result.project.title, ownerToken: result.ownerToken };
    localStorage.setItem(cloudStorageKey, JSON.stringify(cloudProject));
    renderCloudActions();
    showToast("Cloud project created. Your private owner key is saved in this browser.");
    alert("Your cloud project is ready. Keep this browser profile private and download a separate backup. The owner key is stored in this browser and cannot be recovered if browser data is cleared.");
  } catch (error) {
    showToast(error.message);
  }
}

async function saveCloudVersion() {
  if (!cloudProject) return createCloudProject();
  try {
    const result = await cloudRequest(`/api/projects/${encodeURIComponent(cloudProject.id)}`, "PUT", {
      label: "Saved workspace version",
      snapshot: cloudSnapshot()
    });
    showToast(`Cloud version ${result.version.versionNumber} saved.`);
  } catch (error) {
    showToast(error.message);
  }
}

async function createAuthorReviewLink() {
  if (!cloudProject) { showToast("Create a cloud project before sharing a review link."); return; }
  try {
    await saveCloudVersion();
    const result = await cloudRequest(`/api/projects/${encodeURIComponent(cloudProject.id)}/shares`, "POST", {
      role: "author_review",
      label: "Author review",
      expiresInDays: 14
    });
    const link = new URL("review.html", window.location.href);
    link.hash = new URLSearchParams({ share: result.share.id, key: result.token }).toString();
    try {
      await navigator.clipboard.writeText(link.toString());
      showToast("Private author review link copied. It expires in 14 days.");
    } catch (error) {
      prompt("Copy this private author review link. Anyone with it can view the shared manuscript and submit review decisions.", link.toString());
    }
  } catch (error) {
    showToast(error.message);
  }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || !Array.isArray(saved.chapters)) return null;
    saved.chapters = saved.chapters.map((chapter) => ({
      id: chapter.id || makeId(),
      title: chapter.title || "Untitled chapter",
      draft: typeof chapter.draft === "string" ? chapter.draft : "",
      improved: typeof chapter.improved === "string" ? chapter.improved : (typeof chapter.draft === "string" ? chapter.draft : ""),
      feedback: { ...defaultFeedback(), ...(chapter.feedback || {}) },
      customFocus: typeof chapter.customFocus === "string" ? chapter.customFocus : "",
      authorDecision: typeof chapter.authorDecision === "string" ? chapter.authorDecision : "",
      suggestionTypes: Array.isArray(chapter.suggestionTypes) ? chapter.suggestionTypes : (Array.isArray(chapter.editingTypes) ? chapter.editingTypes : []),
      editingPasses: Array.isArray(chapter.editingPasses) ? chapter.editingPasses : []
    }));
    return saved;
  } catch (error) {
    return null;
  }
}

function loadFormatterState() {
  try {
    const saved = JSON.parse(localStorage.getItem(formatterStorageKey));
    const base = defaultFormatter();
    return saved ? { ...base, ...saved, settings: { ...base.settings, ...(saved.settings || {}) } } : base;
  } catch (error) {
    return defaultFormatter();
  }
}

function defaultEditor() { return { title: "", sourceText: "", editType: "auto", brief: "", voice: "", tone: "", audience: "", protectedPhrases: "", instructions: "", segments: [], suggestions: [], generated: false, updatedAt: null }; }
function loadEditorState() {
  try {
    const saved = JSON.parse(localStorage.getItem(editorStorageKey));
    const base = defaultEditor();
    return saved ? { ...base, ...saved, segments: Array.isArray(saved.segments) ? saved.segments : [], suggestions: Array.isArray(saved.suggestions) ? saved.suggestions : [] } : base;
  } catch (error) {
    return defaultEditor();
  }
}

function persist(message = "Saved locally") {
  state.updatedAt = new Date().toISOString();
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (error) { message = "Saved for this session"; }
  const savedState = $("#savedState");
  if (savedState) savedState.textContent = message;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (savedState) savedState.textContent = "Saved locally"; }, 1300);
}

function persistFormatter(message = "Saved locally") {
  try { localStorage.setItem(formatterStorageKey, JSON.stringify(formatter)); } catch (error) { message = "Saved for this session"; }
  const savedState = $("#formatSavedState");
  if (savedState && !formatter.sourceText) savedState.textContent = message;
}

function persistEditor(message = "Saved locally") {
  editor.updatedAt = new Date().toISOString();
  try { localStorage.setItem(editorStorageKey, JSON.stringify(editor)); } catch (error) { message = "Saved for this session"; }
  const savedState = $("#editSavedState");
  if (savedState) savedState.textContent = message;
}

function wordCount(text = "") { return text.trim() ? text.trim().split(/\s+/).length : 0; }
function escapeHtml(value = "") { return String(value).replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char])); }
function showToast(message) { toast.textContent = message; toast.classList.add("is-visible"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 3000); }
function slug(value) { return (value || "manuscript").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "manuscript"; }
function downloadFile(filename, content, type = "text/plain") { const blob = content instanceof Blob ? content : new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 700); }

function editTypeLabel(type) { return ({ developmental: "developmental review", structural: "structure and pacing", copyedit: "copyediting", line: "line editing", proofreading: "proofreading", continuity: "continuity check", sensitivity: "sensitivity review" }[type] || type); }
function recommendEditType(text) {
  const lower = text.toLowerCase();
  if (/\b(teh|recieve|alot|could of|should of|would of)\b| {2,}|\s+[,.!?;:]/i.test(text)) return "proofreading";
  if (/chapter|part|scene|act|argument|thesis/i.test(lower) && text.length > 12000) return "structural";
  return "copyedit";
}
function effectiveEditType() { return editor.editType === "auto" ? recommendEditType(editor.sourceText) : editor.editType; }
function editTypeReason(type) { return ({ developmental: "Review the larger promise, character or argument here before changing sentences.", structural: "Check whether this section arrives in the strongest order and carries the reader forward.", continuity: "Check names, dates, details, timeline, and promises against the rest of the manuscript.", sensitivity: "Read this passage with the intended audience and lived experience in mind before deciding what to revise." }[type] || "The desk found a conservative wording or mechanics change to consider. Check that it fits your voice before approving it."); }
function proposeMechanicalEdit(text, type) {
  let proposed = text;
  const reasons = [];
  const change = (pattern, replacement, reason) => {
    const matches = proposed.match(pattern);
    const count = matches ? matches.length : 0;
    proposed = typeof replacement === "function" ? proposed.replace(pattern, (...args) => replacement(...args)) : proposed.replace(pattern, replacement);
    if (count) reasons.push(`${reason} (${count} ${count === 1 ? "place" : "places"})`);
  };
  change(/[ \t]{2,}/g, " ", "Repeated spaces were reduced");
  change(/[ \t]+([,.;:!?])/g, "$1", "Spaces before punctuation were removed");
  change(/([,.;:!?])([A-Za-z])/g, "$1 $2", "Missing spaces after punctuation were restored");
  change(/\b([A-Za-z][A-Za-z’'-]*)[ \t]+\1\b/gi, "$1", "A repeated word was reduced");
  change(/\bteh\b/gi, "the", "A common spelling error was corrected");
  change(/\brecieve\b/gi, "receive", "A common spelling error was corrected");
  change(/\balot\b/gi, "a lot", "A common spelling error was corrected");
  if (type === "copyedit") {
    change(/\bin order to\b/gi, "to", "A wordy phrase was shortened without changing the meaning");
    change(/\bdue to the fact that\b/gi, "because", "A wordy phrase was made more direct");
  }
  if (type === "line") {
    change(/\bat this point in time\b/gi, "now", "A familiar phrase was made more direct");
    change(/\bin the event that\b/gi, "if", "A wordy phrase was made more direct");
  }
  return { proposed, reasons };
}
function splitEditSegments(text) { return text.split(/\n\s*\n/).map((segment) => segment.trim()).filter(Boolean); }
function tokenise(text) { return text.match(/\s+|[A-Za-z0-9’'-]+|[^A-Za-z0-9\s]/g) || []; }
function renderInlineDiff(original, proposed) {
  if (original === proposed) return `<span class="diff-note">No wording has been proposed yet. Edit the suggestion box below if you want to add one manually.</span>`;
  const before = tokenise(original); const after = tokenise(proposed); let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let endBefore = before.length - 1; let endAfter = after.length - 1;
  while (endBefore >= start && endAfter >= start && before[endBefore] === after[endAfter]) { endBefore -= 1; endAfter -= 1; }
  return `${escapeHtml(before.slice(0, start).join(""))}<del>${escapeHtml(before.slice(start, endBefore + 1).join(""))}</del><ins>${escapeHtml(after.slice(start, endAfter + 1).join(""))}</ins>${escapeHtml(before.slice(endBefore + 1).join(""))}`;
}
function composeEditedText() { return editor.segments.map((segment, index) => { const suggestion = editor.suggestions.find((item) => item.index === index); return suggestion?.status === "approved" ? suggestion.proposed : segment; }).join("\n\n"); }
function suggestionStatusLabel(status) { return status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending decision"; }

function splitManuscript(text) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const headingPattern = /^(?:(?:chapter|part|prologue|epilogue)\b[^\n]*|[A-Z][A-Z\s0-9:'’,-]{5,})$/gim;
  const matches = [...normalized.matchAll(headingPattern)].filter((match) => match.index !== 0 || /chapter|part|prologue|epilogue/i.test(match[0]));
  if (!matches.length) return [defaultChapter("Manuscript", normalized)];
  const chapters = [];
  const preface = normalized.slice(0, matches[0].index).trim();
  if (preface) chapters.push(defaultChapter("Opening material", preface));
  matches.forEach((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    chapters.push(defaultChapter(match[0].trim().replace(/\s+/g, " "), normalized.slice(start, end).trim()));
  });
  return chapters;
}

function createProject(title, text) {
  const chapters = splitManuscript(text);
  if (!chapters.length) { showToast("Add some manuscript text first."); return; }
  state = { title: title.trim() || "Untitled manuscript", chapters, selectedId: chapters[0].id, updatedAt: null };
  persist();
  renderApp();
  showToast(`${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"} ready for a reader perspective.`);
  $("#workspace").scrollIntoView({ behavior: "smooth" });
}

function selectedChapter() { return state.chapters.find((chapter) => chapter.id === state.selectedId) || state.chapters[0]; }
function renderApp() {
  const hasProject = state.chapters.length > 0;
  onboarding.hidden = hasProject;
  desk.hidden = !hasProject;
  $("#workspaceHeading").textContent = hasProject ? state.title : "Start a new beta read";
  if (hasProject) { renderChapterRail(); renderCurrentChapter(); }
}

function renderChapterRail() {
  $("#chapterList").innerHTML = state.chapters.map((chapter) => `<button class="chapter-button ${chapter.id === state.selectedId ? "is-active" : ""}" type="button" data-chapter-id="${escapeHtml(chapter.id)}">${escapeHtml(chapter.title)}<small>${wordCount(chapter.improved || chapter.draft)} words${chapter.improved && chapter.improved !== chapter.draft ? " · author copy" : ""}</small></button>`).join("");
  $("#chapterCount").textContent = `${state.chapters.length} ${state.chapters.length === 1 ? "chapter" : "chapters"}`;
  const changed = state.chapters.filter((chapter) => chapter.improved && chapter.improved !== chapter.draft).length;
  $("#completionCount").textContent = `${Math.round((changed / state.chapters.length) * 100)}% author copies changed`;
  $$('[data-chapter-id]').forEach((button) => button.addEventListener("click", () => { state.selectedId = button.dataset.chapterId; persist(); renderChapterRail(); renderCurrentChapter(); }));
}

function renderCurrentChapter() {
  const chapter = selectedChapter();
  if (!chapter) return;
  $("#chapterHeading").textContent = chapter.title;
  $("#chapterMeta").textContent = `${wordCount(chapter.draft)} original words · ${wordCount(chapter.improved)} author copy words`;
  $("#draftText").value = chapter.draft;
  $("#improvedText").value = chapter.improved;
  $("#draftWords").textContent = `${wordCount(chapter.draft)} words`;
  $("#improvedWords").textContent = `${wordCount(chapter.improved)} words`;
  $("#generalFeedback").value = chapter.feedback.general || "";
  $("#customFeedbackFocus").value = chapter.customFocus || "";
  $("#authorDecision").value = chapter.authorDecision || "";
  $("#feedbackFields").innerHTML = feedbackDefinitions.map(([key, label, question, help]) => `<div class="feedback-group"><label for="feedback-${key}">${label}</label><span class="feedback-help">${question}</span><span class="feedback-help feedback-human-help">${help}</span><textarea class="feedback-input" id="feedback-${key}" data-feedback-key="${key}" placeholder="Write what you actually noticed..."></textarea></div>`).join("");
  feedbackDefinitions.forEach(([key]) => { $(`#feedback-${key}`).value = chapter.feedback[key] || ""; });
  renderSuggestionPlan();
  updateSuggestionBrief();
  bindCurrentChapter();
}

function bindCurrentChapter() {
  $("#draftText").oninput = (event) => { selectedChapter().draft = event.target.value; $("#draftWords").textContent = `${wordCount(event.target.value)} words`; $("#chapterMeta").textContent = `${wordCount(event.target.value)} original words · ${wordCount(selectedChapter().improved)} author copy words`; persist(); };
  $("#improvedText").oninput = (event) => { selectedChapter().improved = event.target.value; $("#improvedWords").textContent = `${wordCount(event.target.value)} words`; $("#chapterMeta").textContent = `${wordCount(selectedChapter().draft)} original words · ${wordCount(event.target.value)} author copy words`; persist(); renderChapterRail(); };
  $$('[data-feedback-key]').forEach((field) => field.oninput = (event) => { selectedChapter().feedback[event.target.dataset.feedbackKey] = event.target.value; persist(); updateSuggestionBrief(); });
  $("#generalFeedback").oninput = (event) => { selectedChapter().feedback.general = event.target.value; persist(); updateSuggestionBrief(); };
  $("#customFeedbackFocus").oninput = (event) => { selectedChapter().customFocus = event.target.value; persist(); updateSuggestionBrief(); };
  $("#authorDecision").oninput = (event) => { selectedChapter().authorDecision = event.target.value; persist(); updateSuggestionBrief(); };
  $$('[data-editor-tab]').forEach((tab) => tab.onclick = () => switchEditor(tab.dataset.editorTab));
}

function renderSuggestionPlan() {
  const chapter = selectedChapter();
  if (!chapter) return;
  $("#editingOptions").innerHTML = suggestionTypes.map(([key, label]) => `<label class="editing-option"><input type="checkbox" data-suggestion-type="${key}" ${chapter.suggestionTypes.includes(key) ? "checked" : ""}><span>${label}</span></label>`).join("");
  $("#editingPasses").innerHTML = (chapter.editingPasses || []).map((pass, index) => `<div class="editing-pass" data-pass-index="${index}"><div class="editing-pass-head"><strong>Suggestion ${index + 1}</strong><button class="quiet-button" type="button" data-remove-pass="${index}">Remove</button></div><input class="text-input" data-pass-title="${index}" value="${escapeHtml(pass.title || "")}" placeholder="Name a possible change to consider"><textarea class="feedback-area" data-pass-notes="${index}" placeholder="Why might this help, and what would you want to protect?">${escapeHtml(pass.notes || "")}</textarea></div>`).join("");
  $$('[data-suggestion-type]').forEach((field) => field.onchange = (event) => { const types = new Set(selectedChapter().suggestionTypes || []); event.target.checked ? types.add(event.target.dataset.suggestionType) : types.delete(event.target.dataset.suggestionType); selectedChapter().suggestionTypes = [...types]; persist(); updateSuggestionBrief(); });
  $$('[data-pass-title]').forEach((field) => field.oninput = (event) => { selectedChapter().editingPasses[Number(event.target.dataset.passTitle)].title = event.target.value; persist(); updateSuggestionBrief(); });
  $$('[data-pass-notes]').forEach((field) => field.oninput = (event) => { selectedChapter().editingPasses[Number(event.target.dataset.passNotes)].notes = event.target.value; persist(); updateSuggestionBrief(); });
  $$('[data-remove-pass]').forEach((button) => button.onclick = () => { selectedChapter().editingPasses.splice(Number(button.dataset.removePass), 1); persist(); renderSuggestionPlan(); updateSuggestionBrief(); });
}

function switchEditor(view) {
  $$('[data-editor-tab]').forEach((tab) => { const active = tab.dataset.editorTab === view; tab.classList.toggle("is-active", active); tab.setAttribute("aria-selected", String(active)); });
  $$('[data-writing-panel]').forEach((panel) => { panel.hidden = panel.dataset.writingPanel !== view; panel.classList.toggle("is-active", panel.dataset.writingPanel === view); });
}

function updateSuggestionBrief() {
  const chapter = selectedChapter();
  if (!chapter) return;
  const filled = feedbackDefinitions.filter(([key]) => (chapter.feedback[key] || "").trim());
  const hasAny = filled.length || (chapter.feedback.general || "").trim() || (chapter.customFocus || "").trim() || (chapter.authorDecision || "").trim() || (chapter.suggestionTypes || []).length || (chapter.editingPasses || []).length;
  if (!hasAny) { $("#revisionBrief").textContent = "Add your own reader response above to create a clear suggestion brief."; return; }
  const observations = filled.map(([key, label]) => { const excerpt = chapter.feedback[key].trim().replace(/\s+/g, " "); return `${label.toLowerCase()}: ${excerpt.length > 180 ? `${excerpt.slice(0, 177)}...` : excerpt}`; });
  const selected = (chapter.suggestionTypes || []).map((key) => suggestionTypes.find(([type]) => type === key)?.[1]).filter(Boolean);
  const parts = [];
  if (observations.length) parts.push(`As a reader, I noticed ${observations.join(" ")}`);
  if (chapter.feedback.general) parts.push(`The wider feeling was: ${chapter.feedback.general.trim().replace(/\s+/g, " ").slice(0, 260)}`);
  if (chapter.customFocus) parts.push(`The requested focus is ${chapter.customFocus.trim().replace(/\s+/g, " ")}`);
  if (selected.length) parts.push(`Possible things to consider are ${selected.join(", ")}`);
  if (chapter.editingPasses?.some((pass) => pass.title)) parts.push(`The reader also noted these possible passes: ${chapter.editingPasses.map((pass) => pass.title).filter(Boolean).join(", ")}`);
  if (chapter.authorDecision) parts.push(`The author's decision after reading is ${chapter.authorDecision.trim().replace(/\s+/g, " ")}`);
  $("#revisionBrief").textContent = `${parts.join(". ")}. These are suggestions to sit with, not instructions and not changes to the manuscript.`;
}

function switchView(view) {
  $$(".app-view").forEach((section) => { section.hidden = section.dataset.view !== view; });
  $$('[data-view-switch]').forEach((button) => { if (button.matches("button")) { const active = button.dataset.viewSwitch === view; button.classList.toggle("is-active", active); button.setAttribute("aria-selected", String(active)); } });
  if (view === "formatter") renderFormatter();
  if (view === "editing") renderEditingWorkspace();
}

function feedbackMarkdown(chapter) {
  const lines = [`# Reader feedback: ${state.title}`, "", `## ${chapter.title}`, "", "This is reader perspective and suggestion only. No feedback in this report has been applied to the manuscript.", "", `Original word count: ${wordCount(chapter.draft)}`, `Author's copy word count: ${wordCount(chapter.improved)}`, ""];
  feedbackDefinitions.forEach(([key, label, question]) => { lines.push(`### ${label}`, "", `_${question}_`, "", chapter.feedback[key] || "No reader note recorded.", ""); });
  lines.push("### General reader letter", "", chapter.feedback.general || "No general reader letter recorded.", "", "### Requested feedback focus", "", chapter.customFocus || "No extra focus recorded.", "", "### Author's decision after review", "", chapter.authorDecision || "No decision recorded yet.", "", "### Possible next steps", "", (chapter.suggestionTypes || []).map((key) => suggestionTypes.find(([type]) => type === key)?.[1]).filter(Boolean).join(", ") || "No next step selected.", "", "### Reader suggested passes", "", (chapter.editingPasses || []).map((pass, index) => `${index + 1}. ${pass.title || "Untitled suggestion"}${pass.notes ? `: ${pass.notes}` : ""}`).join("\n") || "No additional suggestions recorded.", "", "### Manuscript status", "", "The source wording remains separate. Any author copy changes are author controlled.");
  return lines.join("\n");
}
function allFeedbackMarkdown() { return [`# Reader feedback: ${state.title}`, "", "This report contains reader perspective and suggestions only. It does not rewrite the manuscript.", "", ...state.chapters.map(feedbackMarkdown)].join("\n\n---\n\n"); }
function manuscriptText(chapter) { return chapter.improved || chapter.draft; }
function allManuscriptText() { return state.chapters.map((chapter) => manuscriptText(chapter)).join("\n\n\n"); }
function scopeChapter() { const scope = $("#exportScope"); return scope && scope.value === "current" ? selectedChapter() : null; }

async function extractFileText(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (["txt", "md", "markdown"].includes(extension)) return file.text();
  if (["html", "htm"].includes(extension)) {
    const raw = await file.text();
    const doc = new DOMParser().parseFromString(raw, "text/html");
    return doc.body?.innerText || doc.documentElement.innerText || raw;
  }
  if (extension === "docx") {
    if (!window.mammoth) throw new Error("DOCX reader is still loading. Try again in a moment, or paste the text instead.");
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (extension === "pdf") {
    if (!window.pdfjsLib) throw new Error("PDF reader is still loading. Try again in a moment, or paste the text instead.");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join("\n\n");
  }
  throw new Error("Please use TXT, Markdown, HTML, DOCX, or PDF.");
}

async function readFileInto(file, target, titleTarget, statusMessage = "File loaded.") {
  if (!file) return;
  showToast(`Reading ${file.name} in your browser...`);
  try {
    const text = await extractFileText(file);
    if (!text.trim()) throw new Error("No selectable text was found in this file.");
    target.value = text;
    if (titleTarget && !titleTarget.value.trim()) titleTarget.value = file.name.replace(/\.[^.]+$/, "");
    if (statusMessage) showToast(statusMessage);
    return text;
  } catch (error) {
    showToast(error.message || "This file could not be read. Try copying its text into the editor.");
    return "";
  }
}

function updateEditingRecommendation() {
  const recommendation = $("#editRecommendation");
  if (!editor.sourceText) { recommendation.textContent = "Load a manuscript and the desk will suggest a sensible starting pass."; return; }
  const type = recommendEditType(editor.sourceText);
  recommendation.textContent = editor.editType === "auto" ? `A sensible starting point is ${editTypeLabel(type)}. You can choose another pass.` : `You chose ${editTypeLabel(editor.editType)}. The original will remain untouched until you approve a change.`;
}

function renderEditingWorkspace() {
  $("#editTitle").value = editor.title || "";
  $("#editInput").value = editor.sourceText || "";
  $("#editType").value = editor.editType || "auto";
  $("#editBrief").value = editor.brief || "";
  $("#editVoice").value = editor.voice || "";
  $("#editTone").value = editor.tone || "";
  $("#editAudience").value = editor.audience || "";
  $("#editProtected").value = editor.protectedPhrases || "";
  $("#editInstructions").value = editor.instructions || "";
  updateEditingRecommendation();
  const suggestions = $("#editSuggestions");
  const toolbar = $("#editToolbar");
  const exportBox = $("#editingExport");
  if (!editor.generated) {
    $("#editingSummary").innerHTML = `<strong>Your original stays untouched.</strong><span>Load a manuscript, choose a pass, and start when you are ready. Every suggestion will show the reason for the change.</span>`;
    suggestions.innerHTML = "";
    toolbar.hidden = true;
    exportBox.hidden = true;
    return;
  }
  const approved = editor.suggestions.filter((item) => item.status === "approved").length;
  const rejected = editor.suggestions.filter((item) => item.status === "rejected").length;
  const pending = editor.suggestions.length - approved - rejected;
  $("#editingSummary").innerHTML = `<strong>${editor.suggestions.length} ${editor.suggestions.length === 1 ? "suggestion" : "suggestions"} from a ${escapeHtml(editTypeLabel(effectiveEditType()))} pass.</strong><span>${approved} approved · ${rejected} rejected · ${pending} pending. Only approved changes appear in the edited manuscript download.</span>`;
  toolbar.hidden = false;
  exportBox.hidden = false;
  suggestions.innerHTML = editor.suggestions.map((item, index) => `<article class="edit-suggestion ${item.status}" data-edit-index="${index}"><div class="edit-suggestion-head"><div><span class="suggestion-number">${String(index + 1).padStart(2, "0")}</span><strong>${suggestionStatusLabel(item.status)}</strong></div><span class="edit-location">Section ${item.index + 1}${item.source === "ai" ? " · AI suggestion" : " · desk suggestion"}</span></div><div class="edit-diff" aria-label="Suggested change">${renderInlineDiff(item.original, item.proposed)}</div><label class="field-label" for="edit-proposed-${index}">Proposed wording</label><textarea class="feedback-area edit-proposed" id="edit-proposed-${index}" data-edit-proposed="${index}">${escapeHtml(item.proposed)}</textarea><div class="edit-reason"><strong>Why this is suggested</strong><span>${escapeHtml(item.reason)}</span></div><div class="edit-suggestion-actions"><button class="button button-primary" type="button" data-approve-edit="${index}">Approve</button><button class="button button-quiet" type="button" data-reject-edit="${index}">Reject</button></div></article>`).join("");
  $$('[data-edit-proposed]').forEach((field) => field.oninput = (event) => { const item = editor.suggestions[Number(event.target.dataset.editProposed)]; item.proposed = event.target.value; item.status = "pending"; persistEditor(); renderEditingWorkspace(); });
  $$('[data-approve-edit]').forEach((button) => button.onclick = () => { editor.suggestions[Number(button.dataset.approveEdit)].status = "approved"; persistEditor(); renderEditingWorkspace(); });
  $$('[data-reject-edit]').forEach((button) => button.onclick = () => { editor.suggestions[Number(button.dataset.rejectEdit)].status = "rejected"; persistEditor(); renderEditingWorkspace(); });
}

function startSuggestedEdit() {
  const source = $("#editInput").value.trim();
  if (!source) { showToast("Load or paste a manuscript before starting an edit."); $("#editInput").focus(); return; }
  editor.title = $("#editTitle").value.trim() || "Untitled editing project";
  editor.sourceText = source;
  editor.editType = $("#editType").value;
  editor.brief = $("#editBrief").value.trim();
  const type = effectiveEditType();
  editor.segments = splitEditSegments(source);
  editor.suggestions = [];
  editor.segments.forEach((segment, index) => {
    const mechanical = ["copyedit", "line", "proofreading"].includes(type) ? proposeMechanicalEdit(segment, type) : { proposed: segment, reasons: [] };
    const changed = mechanical.proposed !== segment;
    if (changed || !["copyedit", "line", "proofreading"].includes(type)) {
      const reason = mechanical.reasons.join(". ") || editTypeReason(type);
      editor.suggestions.push({ id: makeId(), index, original: segment, proposed: mechanical.proposed, reason: editor.brief ? `${reason} Author's brief: ${editor.brief}` : reason, status: "pending" });
    }
  });
  editor.generated = true;
  persistEditor("Suggestions saved locally");
  renderEditingWorkspace();
  $("#editing").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast(editor.suggestions.length ? `${editor.suggestions.length} suggested changes are ready for your decision.` : "No automatic changes were found. The manuscript remains untouched.");
}

function editingComparisonHtml() {
  const title = escapeHtml(editor.title || "Editing comparison");
  const rows = editor.suggestions.map((item, index) => `<article class="comparison-item"><h2>Suggestion ${index + 1} · Section ${item.index + 1} · ${escapeHtml(suggestionStatusLabel(item.status))}</h2><div class="comparison-diff">${renderInlineDiff(item.original, item.proposed)}</div><h3>Reason for suggesting this edit</h3><p>${escapeHtml(item.reason)}</p></article>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>body{font:15px/1.6 Arial,sans-serif;color:#20352e;max-width:800px;margin:40px auto;padding:0 24px}h1{font:400 34px Georgia,serif}h2{font-size:16px;border-top:1px solid #ccd5cc;padding-top:20px}.comparison-item{margin:28px 0}.comparison-diff{background:#f7f2e8;padding:18px;white-space:pre-wrap}del{background:#f4c5bd;color:#7c2418;text-decoration:line-through}ins{background:#cfe8d4;color:#145a31;text-decoration:none}h3{font-size:12px;text-transform:uppercase;letter-spacing:.08em}p{color:#53665c}</style></head><body><h1>${title}</h1><p>This is a suggested-edit review. The original manuscript is preserved. Approve or reject each suggestion; only approved changes are included in the edited manuscript.</p>${rows}</body></html>`;
}
function editedManuscriptHtml() {
  const title = escapeHtml(editor.title || "Edited manuscript");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px/1.7 Georgia,serif;color:#20352e;max-width:760px;margin:40px auto;padding:0 24px}h1{font:400 34px Georgia,serif;margin-bottom:40px}.manuscript p{margin:0 0 1em;text-indent:1.5em}.manuscript p:first-child{text-indent:0}</style></head><body><h1>${title}</h1><div class="manuscript">${textBlocksHtml(composeEditedText(), "copyedit")}</div></body></html>`;
}
function editingReviewDoc() { return editingComparisonHtml().replace(/<title>.*?<\/title>/, `<title>${escapeHtml(editor.title || "Editing review")}</title>`); }
function downloadEditedManuscript() { downloadFile(`${slug(editor.title)}-edited-manuscript.txt`, composeEditedText(), "text/plain"); showToast("Approved manuscript download started."); }
function downloadEditedHtml() { downloadFile(`${slug(editor.title)}-edited-manuscript.html`, editedManuscriptHtml(), "text/html"); showToast("Edited HTML download started."); }
function downloadEditedDoc() { downloadFile(`${slug(editor.title)}-edited-manuscript.doc`, editedManuscriptHtml(), "application/msword"); showToast("Edited DOC download started."); }
function downloadEditingComparison() { downloadFile(`${slug(editor.title)}-suggested-edits.html`, editingComparisonHtml(), "text/html"); showToast("Comparison download started."); }
function downloadEditingReviewDoc() { downloadFile(`${slug(editor.title)}-word-review.doc`, editingReviewDoc(), "application/msword"); showToast("Word review download started."); }
function xmlEscape(value = "") { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char])); }
function wordRuns(text, deleted = false) { return `<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`; }
function docxParagraph(text, revision = null, commentId = null) {
  if (!revision) return `<w:p>${wordRuns(text)}</w:p>`;
  const author = "Author's Revision Desk";
  const date = new Date().toISOString();
  const commentStart = commentId === null ? "" : `<w:commentRangeStart w:id="${commentId}"/>`;
  const commentEnd = commentId === null ? "" : `<w:commentRangeEnd w:id="${commentId}"/>`;
  const reference = commentId === null ? "" : `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${commentId}"/></w:r>`;
  return `<w:p>${commentStart}<w:del w:id="${revision.id}" w:author="${xmlEscape(author)}" w:date="${date}">${wordRuns(revision.original, true).replace("<w:t", "<w:delText")}</w:del><w:ins w:id="${revision.id + 1000}" w:author="${xmlEscape(author)}" w:date="${date}">${wordRuns(revision.proposed)}</w:ins>${commentEnd}${reference}</w:p>`;
}
async function downloadNativeTrackChanges() {
  if (!window.JSZip) { showToast("DOCX helper is still loading. Try again in a moment."); return; }
  if (!editor.generated) { showToast("Start an editing pass before exporting Word revisions."); return; }
  const zip = new window.JSZip();
  const title = editor.title || "Editing review";
  const comments = [];
  const body = editor.segments.map((segment, index) => {
    const item = editor.suggestions.find((suggestion) => suggestion.index === index);
    if (!item || item.status === "rejected" || item.original === item.proposed) return docxParagraph(segment);
    const commentId = comments.length;
    comments.push({ id: commentId, reason: item.reason });
    return docxParagraph(segment, { ...item, id: commentId + 1 }, commentId);
  }).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const commentsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${comments.map((comment) => `<w:comment w:id="${comment.id}" w:author="Author's Revision Desk" w:date="${new Date().toISOString()}"><w:p>${wordRuns(`Reason for suggestion: ${comment.reason}`)}</w:p></w:comment>`).join("")}</w:comments>`;
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("word/document.xml", documentXml); zip.file("word/comments.xml", commentsXml);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="character" w:styleId="CommentReference"><w:name w:val="Comment Reference"/></w:style></w:styles>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>Author's Revision Desk</dc:creator><cp:lastModifiedBy>Author's Revision Desk</cp:lastModifiedBy></cp:coreProperties>`);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  downloadFile(`${slug(title)}-track-changes.docx`, blob, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); showToast("Native Word Track Changes download started.");
}
function downloadEditingBackup() { downloadFile(`${slug(editor.title)}-editing-backup.json`, JSON.stringify({ ...editor, editedText: composeEditedText(), syncNote: "Google Docs synchronization requires an authorized server bridge." }, null, 2), "application/json"); showToast("Editing backup download started."); }
async function startAiEdit() {
  const source = editor.sourceText || $("#editInput").value.trim();
  if (!source) { showToast("Load or paste a manuscript before running the AI suggestion pass."); return; }
  const button = $("[data-start-ai-edit]");
  button.disabled = true;
  button.textContent = "Checking AI availability…";
  try {
    const healthResponse = await fetch("/api/health", { cache: "no-store" });
    const health = await healthResponse.json();
    if (!healthResponse.ok || !health.features?.builtInAI) {
      showToast("Built-in AI is not enabled yet. Your manuscript has not been sent to an AI service. Local conservative suggestions remain available.");
      return;
    }
    editor.title = $("#editTitle").value.trim() || editor.title || "Untitled editing project";
    editor.sourceText = source;
    editor.segments = splitEditSegments(source);
    const payload = { title: editor.title, text: source, editType: effectiveEditType(), brief: editor.brief, voice: editor.voice, tone: editor.tone, audience: editor.audience, protectedPhrases: editor.protectedPhrases, instructions: editor.instructions };
    button.textContent = "Preparing suggestions…";
    const response = await fetch("/api/ai-edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "The secure AI service could not complete this request.");
    editor.suggestions = (data.suggestions || []).map((item, index) => ({ id: makeId(), index: Number.isInteger(item.index) ? item.index : index, original: item.original || editor.segments[index] || "", proposed: item.proposed || editor.segments[index] || "", reason: item.reason || "AI suggestion. Check it against your voice before approving.", confidence: item.confidence || "unrated", source: "ai", status: "pending" }));
    editor.generated = true;
    persistEditor("AI suggestions saved locally");
    renderEditingWorkspace();
    showToast(`${editor.suggestions.length} AI suggestions are ready for your decision.`);
  } catch (error) {
    showToast(`${error.message} Local conservative suggestions are still available.`);
  } finally {
    button.disabled = false;
    button.textContent = "Run optional AI suggestion pass";
  }
}
function googleDocIdentifier(value) { const match = String(value || "").match(/\/document\/d\/([\w-]+)/); return match ? match[1] : String(value || "").trim(); }
async function googleSync(action) {
  const docId = googleDocIdentifier($("#googleDocId").value);
  if (!docId && action === "sync") { showToast("Add a Google Doc ID or URL first."); return; }
  const status = $("#googleSyncStatus"); status.textContent = "Checking the authorized Google Workspace bridge…";
  try {
    const healthResponse = await fetch("/api/health", { cache: "no-store" });
    const health = await healthResponse.json();
    if (!healthResponse.ok || !health.features?.googleDocs) {
      throw new Error("Google Docs integration is not enabled yet. Your manuscript has not been sent to Google.");
    }
    const response = await fetch(`/api/google-docs/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: docId, title: editor.title, sourceText: editor.sourceText, suggestions: editor.suggestions }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Google Workspace is not connected to this preview.");
    status.textContent = data.message || "Google Docs synchronization completed."; if (data.url) window.open(data.url, "_blank", "noopener"); showToast(status.textContent);
  } catch (error) { status.textContent = `${error.message} Download the native DOCX or backup until Google Workspace is authorized.`; showToast("Google Docs sync is not connected."); }
}

function bindGlobalActions() {
  $("[data-create-project]").onclick = () => createProject($("#projectTitle").value, $("#manuscriptInput").value);
  $("[data-cloud-create]").onclick = createCloudProject;
  $("[data-cloud-save]").onclick = saveCloudVersion;
  $("[data-cloud-share]").onclick = createAuthorReviewLink;
  $("#fileInput").onchange = (event) => readFileInto(event.target.files[0], $("#manuscriptInput"), $("#projectTitle"), "File loaded. Read it over, then open the beta reading desk.");
  $("#dropZone").ondragover = (event) => { event.preventDefault(); $("#dropZone").classList.add("is-dragging"); };
  $("#dropZone").ondragleave = () => $("#dropZone").classList.remove("is-dragging");
  $("#dropZone").ondrop = (event) => { event.preventDefault(); $("#dropZone").classList.remove("is-dragging"); readFileInto(event.dataTransfer.files[0], $("#manuscriptInput"), $("#projectTitle"), "File loaded. Read it over, then open the beta reading desk."); };
  $("#dropZone").onclick = () => $("#fileInput").click();
  $("#dropZone").onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); $("#fileInput").click(); } };
  $("[data-paste-clipboard]").onclick = async () => { try { const text = await navigator.clipboard.readText(); $("#manuscriptInput").value = text; showToast(text ? "Clipboard text added. Read it over before opening the desk." : "Your clipboard is empty."); } catch (error) { showToast("Tap inside the manuscript box and paste normally. Your browser did not allow clipboard access."); $("#manuscriptInput").focus(); } };
  $("[data-new-project]").onclick = () => { if (confirm("Start a new beta reading project? Download a backup first if you want to keep this one.")) { state = { title: "", chapters: [], selectedId: null, updatedAt: null }; localStorage.removeItem(storageKey); $("#projectTitle").value = ""; $("#manuscriptInput").value = ""; renderApp(); $("#workspace").scrollIntoView({ behavior: "smooth" }); } };
  $("[data-add-chapter]").onclick = () => { const chapter = defaultChapter(`Chapter ${state.chapters.length + 1}`, ""); chapter.improved = ""; state.chapters.push(chapter); state.selectedId = chapter.id; persist(); renderChapterRail(); renderCurrentChapter(); showToast("New chapter added for reader notes."); };
  $("[data-add-editing-pass]").onclick = () => { selectedChapter().editingPasses.push({ title: "", notes: "" }); persist(); renderSuggestionPlan(); updateSuggestionBrief(); showToast("Another suggestion space is ready."); };
  $("[data-delete-chapter]").onclick = () => { if (state.chapters.length === 1) { showToast("Keep at least one chapter in the workspace."); return; } if (!confirm("Delete this chapter and its reader notes?")) return; state.chapters = state.chapters.filter((chapter) => chapter.id !== state.selectedId); state.selectedId = state.chapters[0].id; persist(); renderChapterRail(); renderCurrentChapter(); };
  $("[data-start-revision]").onclick = () => { const chapter = selectedChapter(); if (!chapter.improved) chapter.improved = chapter.draft; persist(); renderCurrentChapter(); switchEditor("improved"); showToast("Author copy opened. No reader suggestion was applied."); };
  $("[data-copy-brief]").onclick = async () => { const brief = $("#revisionBrief").textContent; try { await navigator.clipboard.writeText(brief); showToast("Reader suggestion brief copied."); } catch (error) { showToast("Select and copy the reader suggestion brief manually."); } };
  $("[data-download-feedback]").onclick = () => { const current = scopeChapter(); const content = current ? feedbackMarkdown(current) : allFeedbackMarkdown(); downloadFile(`${slug(state.title)}-reader-feedback${current ? `-${slug(current.title)}` : ""}.md`, content, "text/markdown"); showToast("Reader feedback download started."); };
  $("[data-download-project]").onclick = () => { downloadFile(`${slug(state.title)}-project-backup.json`, JSON.stringify(state, null, 2), "application/json"); showToast("Project backup download started."); };
  const exportSelect = document.createElement("select"); exportSelect.id = "exportScope"; exportSelect.className = "export-scope"; exportSelect.innerHTML = `<option value="all">Whole manuscript</option><option value="current">Current chapter</option>`;
  const exportButton = document.createElement("button"); exportButton.type = "button"; exportButton.className = "button button-quiet"; exportButton.textContent = "Download author copy"; exportButton.onclick = () => { const current = scopeChapter(); const content = current ? manuscriptText(current) : allManuscriptText(); downloadFile(`${slug(state.title)}-author-copy${current ? `-${slug(current.title)}` : ""}.txt`, content); showToast("Author copy download started."); };
  $(".feedback-actions").append(exportSelect, exportButton);

  $("#editTitle").oninput = (event) => { editor.title = event.target.value; persistEditor(); };
  $("#editInput").oninput = (event) => { editor.sourceText = event.target.value; editor.generated = false; updateEditingRecommendation(); persistEditor(); };
  $("#editType").onchange = (event) => { editor.editType = event.target.value; updateEditingRecommendation(); persistEditor(); };
  $("#editBrief").oninput = (event) => { editor.brief = event.target.value; persistEditor(); };
  $("#editVoice").oninput = (event) => { editor.voice = event.target.value; persistEditor(); };
  $("#editTone").oninput = (event) => { editor.tone = event.target.value; persistEditor(); };
  $("#editAudience").oninput = (event) => { editor.audience = event.target.value; persistEditor(); };
  $("#editProtected").oninput = (event) => { editor.protectedPhrases = event.target.value; persistEditor(); };
  $("#editInstructions").oninput = (event) => { editor.instructions = event.target.value; persistEditor(); };
  $("[data-start-editing]").onclick = startSuggestedEdit;
  $("[data-start-ai-edit]").onclick = startAiEdit;
  $("[data-edit-paste]").onclick = async () => { try { const text = await navigator.clipboard.readText(); $("#editInput").value = text; editor.sourceText = text; editor.generated = false; persistEditor(); updateEditingRecommendation(); showToast(text ? "Manuscript pasted into the editing workspace." : "Your clipboard is empty."); } catch (error) { showToast("Tap inside the editing text box and paste normally."); $("#editInput").focus(); } };
  $("#editFileInput").onchange = async (event) => { const text = await readFileInto(event.target.files[0], $("#editInput"), $("#editTitle"), "Manuscript loaded. Choose an editing pass when you are ready."); if (text) { editor.sourceText = text; editor.generated = false; persistEditor(); updateEditingRecommendation(); } };
  $("#editDropZone").ondragover = (event) => { event.preventDefault(); $("#editDropZone").classList.add("is-dragging"); };
  $("#editDropZone").ondragleave = () => $("#editDropZone").classList.remove("is-dragging");
  $("#editDropZone").ondrop = async (event) => { event.preventDefault(); $("#editDropZone").classList.remove("is-dragging"); const file = event.dataTransfer.files[0]; const text = await extractFileText(file).catch((error) => { showToast(error.message); return ""; }); if (text) { $("#editInput").value = text; $("#editTitle").value = editor.title || file.name.replace(/\.[^.]+$/, ""); editor.sourceText = text; editor.title = $("#editTitle").value; editor.generated = false; persistEditor(); updateEditingRecommendation(); showToast("Manuscript loaded into the editing workspace."); } };
  $("#editDropZone").onclick = () => $("#editFileInput").click();
  $("#editDropZone").onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); $("#editFileInput").click(); } };
  $("[data-approve-all]").onclick = () => { editor.suggestions.forEach((item) => { item.status = "approved"; }); persistEditor(); renderEditingWorkspace(); showToast("All suggested changes marked approved."); };
  $("[data-reject-all]").onclick = () => { editor.suggestions.forEach((item) => { item.status = "rejected"; }); persistEditor(); renderEditingWorkspace(); showToast("All suggested changes rejected. The original remains unchanged."); };
  $("[data-reset-edits]").onclick = () => { editor.suggestions = []; editor.generated = false; persistEditor(); renderEditingWorkspace(); showToast("Suggestions cleared. Your original manuscript is still here."); };
  $("[data-download-edited]").onclick = downloadEditedManuscript;
  $("[data-download-edited-html]").onclick = downloadEditedHtml;
  $("[data-download-edited-doc]").onclick = downloadEditedDoc;
  $("[data-download-comparison]").onclick = downloadEditingComparison;
  $("[data-download-edit-doc]").onclick = downloadEditingReviewDoc;
  $("[data-download-track-docx]").onclick = downloadNativeTrackChanges;
  $("[data-download-edit-json]").onclick = downloadEditingBackup;
  $("[data-google-sync]").onclick = () => googleSync("sync");
  $("[data-google-create]").onclick = () => googleSync("create");

  $$("[data-view-switch]").forEach((button) => button.addEventListener("click", () => { const view = button.dataset.viewSwitch; history.replaceState(null, "", view === "formatter" ? "#formatter" : view === "editing" ? "#editing" : "#workspace"); switchView(view); $(view === "formatter" ? "#formatter" : view === "editing" ? "#editing" : "#workspace").scrollIntoView({ behavior: "smooth" }); }));
  $$("[data-view-link]").forEach((link) => link.addEventListener("click", () => { const view = link.dataset.viewLink; setTimeout(() => switchView(view), 0); }));
  const menuButton = $("[data-mobile-menu]");
  menuButton.onclick = () => { const open = menuButton.getAttribute("aria-expanded") === "true"; menuButton.setAttribute("aria-expanded", String(!open)); $(".top-nav").classList.toggle("is-open", !open); menuButton.setAttribute("aria-label", open ? "Open navigation" : "Close navigation"); };
  $$(".top-nav a").forEach((link) => link.onclick = () => { menuButton.setAttribute("aria-expanded", "false"); $(".top-nav").classList.remove("is-open"); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") { menuButton.click(); menuButton.focus(); } });

  bindFormatterActions();
}

function recommendBookType(text) {
  const lower = text.toLowerCase();
  const lines = text.split("\n").filter((line) => line.trim());
  const shortLineRatio = lines.length ? lines.filter((line) => line.trim().split(/\s+/).length <= 8).length / lines.length : 0;
  if (shortLineRatio > 0.62 && lines.length > 12) return "poetry";
  if (/workbook|exercise|journal prompt|fill in|reflection question|worksheet/.test(lower)) return "workbook";
  if (/memoir|my childhood|when i was|my mother|my father/.test(lower)) return "memoir";
  if (/research|chapter summary|references|bibliography|methodology|according to/.test(lower)) return "nonfiction";
  return "novel";
}

function effectiveBookType() { return formatter.settings.bookType === "auto" ? recommendBookType(formatter.sourceText) : formatter.settings.bookType; }
function typeLabel(type) { return ({ novel: "fiction or novel", memoir: "memoir or personal narrative", nonfiction: "general nonfiction", poetry: "poetry or prose poetry", workbook: "workbook or guided journal" }[type] || type); }
function trimDimensions(trimSize) { return ({ "5x8": [5, 8], "6x9": [6, 9], "5.5x8.5": [5.5, 8.5], a5: [5.83, 8.27], "8.5x11": [8.5, 11] }[trimSize] || [6, 9]); }
function formatFont(font) { return ({ newsreader: "Newsreader, Georgia, serif", georgia: "Georgia, serif", palatino: "Palatino, 'Book Antiqua', serif", sans: "'DM Sans', Arial, sans-serif" }[font] || "Georgia, serif"); }
function formatTitleForExport() { return formatter.title.trim() || "Untitled book"; }
function escapeCssString(value = "") { return String(value).replace(/[\\\"\n\r]/g, " "); }

function updateFormatterRecommendation() {
  const recommendation = $("#formatRecommendation");
  if (!formatter.sourceText) { recommendation.textContent = "The formatter will suggest a professional default after the book is loaded."; return; }
  const type = recommendBookType(formatter.sourceText);
  recommendation.textContent = formatter.settings.bookType === "auto" ? `Based on the shape of this manuscript, a ${typeLabel(type)} treatment is a sensible starting point. You can change it.` : `You chose a ${typeLabel(formatter.settings.bookType)} treatment. Change it whenever the book asks for something else.`;
}

const formatterFieldMap = { bookType: "bookType", trimSize: "trimSize", font: "formatFont", chapterStyle: "chapterStyle", includeFrontMatter: "includeFrontMatter", includeToc: "includeToc", includePageNumbers: "includePageNumbers", includeRunningHeaders: "includeRunningHeaders", margin: "formatMargin", gutter: "formatGutter", fontSize: "formatFontSize", lineSpacing: "formatLineSpacing", paragraphIndent: "formatIndent" };

function renderFormatter() {
  $("#formatTitle").value = formatter.title;
  $("#formatAuthor").value = formatter.author;
  $("#formatSubtitle").value = formatter.subtitle || "";
  $("#formatCopyright").value = formatter.copyright || "";
  $("#formatDedication").value = formatter.dedication || "";
  $("#formatAcknowledgements").value = formatter.acknowledgements || "";
  Object.entries(formatter.settings).forEach(([key, value]) => { const field = $(`#${formatterFieldMap[key] || key}`); if (field) field.type === "checkbox" ? field.checked = Boolean(value) : field.value = value; });
  $("#formatSourceStatus").textContent = formatter.sourceText ? `${wordCount(formatter.sourceText)} words loaded locally.` : "No finished manuscript loaded yet.";
  updateFormatterRecommendation();
  if (formatter.sourceText) renderFormattedPreview();
}

function formattedSections() {
  const chapters = splitManuscript(formatter.sourceText).map((chapter, index) => ({ ...chapter, title: chapter.title || `Section ${index + 1}` }));
  return chapters.length ? chapters : [{ title: "Manuscript", draft: formatter.sourceText }];
}

function textBlocksHtml(text, type) {
  const safe = text.trim();
  if (!safe) return "";
  if (type === "poetry") return safe.split("\n").map((line) => `<div class="poem-line">${escapeHtml(line) || "&nbsp;"}</div>`).join("");
  const blocks = safe.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`).join("");
}

// Layout-only renderer: source manuscript text is never rewritten here.
function formatBookMarkup(includeDocument = false) {
  const type = effectiveBookType();
  const settings = formatter.settings;
  const sections = formattedSections();
  const title = escapeHtml(formatTitleForExport());
  const author = escapeHtml(formatter.author.trim());
  const chapterClass = settings.chapterStyle === "minimal" ? "chapter-minimal" : settings.chapterStyle === "numbered" ? "chapter-numbered" : settings.chapterStyle === "poetry" ? "chapter-poetry" : "chapter-classic";
  const frontMatter = settings.includeFrontMatter ? `<section class="title-page"><h1>${title}</h1>${formatter.subtitle ? `<p class="book-subtitle">${escapeHtml(formatter.subtitle)}</p>` : ""}${author ? `<p class="book-author">${author}</p>` : ""}</section>` : "";
  const copyright = formatter.copyright.trim() ? `<section class="front-matter copyright-page"><p>${escapeHtml(formatter.copyright).replace(/\n/g, "<br>")}</p></section>` : "";
  const dedication = formatter.dedication.trim() ? `<section class="front-matter dedication-page"><p>${escapeHtml(formatter.dedication).replace(/\n/g, "<br>")}</p></section>` : "";
  const acknowledgements = formatter.acknowledgements.trim() ? `<section class="front-matter acknowledgements-page"><h2>Acknowledgements</h2><div>${textBlocksHtml(formatter.acknowledgements, type)}</div></section>` : "";
  const toc = settings.includeToc && sections.length > 1 ? `<section class="contents"><h2>Contents</h2><ol>${sections.map((chapter, index) => `<li><a href="#chapter-${index + 1}">${escapeHtml(chapter.title)}</a></li>`).join("")}</ol></section>` : "";
  const body = sections.map((chapter, index) => `<section class="book-chapter ${chapterClass}${index === 0 ? " book-chapter-first" : ""}" id="chapter-${index + 1}"><h2>${settings.chapterStyle === "numbered" ? `${index + 1}. ` : ""}${escapeHtml(chapter.title)}</h2><div class="chapter-text">${textBlocksHtml(chapter.draft, type)}</div></section>`).join("");
  const inner = `<div class="format-book format-${type}" data-trim="${settings.trimSize}">${frontMatter}${copyright}${dedication}${toc}${acknowledgements}${body}</div>`;
  if (!includeDocument) return inner;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${formatBookCss()}</style></head><body>${inner}</body></html>`;
}
function formatBookCss() {
  const type = effectiveBookType();
  const settings = formatter.settings;
  const [pageWidth, pageHeight] = trimDimensions(settings.trimSize);
  const contentHeight = Math.max(4, pageHeight - 1.45);
  const margin = settings.margin === "narrow" ? ".55in" : settings.margin === "wide" ? ".9in" : ".7in";
  const gutter = Number(settings.gutter || 0);
  const header = settings.includeRunningHeaders ? `@top-center{content:"${escapeCssString(formatTitleForExport())}";font:8pt Arial,sans-serif;color:#777}` : "";
  const pageNumber = settings.includePageNumbers ? "@bottom-center{content:counter(page);font:8pt Arial,sans-serif;color:#777}" : "";
  const lineHeight = type === "poetry" ? "1.65" : settings.lineSpacing;
  const indent = type === "workbook" ? "0" : settings.paragraphIndent + "in";
  return `@page{size:${pageWidth}in ${pageHeight}in;margin:${margin} .72in .75in;${header}${pageNumber}}@page:left{margin-left:calc(.72in + ${gutter}in)}@page:right{margin-right:calc(.72in + ${gutter}in)}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{color:#202c28;font-family:${formatFont(settings.font)};font-size:${settings.fontSize}pt;line-height:${lineHeight}}.format-book{width:auto;max-width:none;margin:0;padding:0;background:#fff;min-height:0}.title-page{min-height:${contentHeight}in;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;break-after:page;page-break-after:always}.title-page h1{font-size:31pt;font-weight:400;line-height:1.12;margin:0 0 .35in}.book-subtitle{font-style:italic;margin:0 0 .25in}.book-author{font-family:Arial,sans-serif;font-size:10pt;letter-spacing:.12em;text-transform:uppercase}.front-matter{min-height:${contentHeight}in;break-after:page;page-break-after:always;display:flex;justify-content:center;align-items:center;text-align:center}.copyright-page{font-size:9pt;align-items:flex-end;text-align:left}.dedication-page{font-style:italic}.contents{break-after:page;page-break-after:always;padding-top:.35in}.contents h2{font-size:18pt;font-weight:400}.contents ol{padding-left:1.2em;line-height:2}.contents a{color:inherit;text-decoration:none}.book-chapter{break-before:page;page-break-before:always;padding-top:.1in}.book-chapter-first{break-before:auto;page-break-before:auto}.book-chapter h2{font-size:${settings.chapterStyle === "minimal" ? "17pt" : "22pt"};font-weight:400;line-height:1.1;margin:0 0 .42in;text-align:${settings.chapterStyle === "minimal" ? "left" : "center"}}.chapter-numbered h2{font-size:19pt}.chapter-text p{margin:0 0 .18in;text-indent:${indent};orphans:2;widows:2}.chapter-text p:first-child{text-indent:0}.poem-line{min-height:1.65em}.chapter-poetry h2{text-align:left}@media screen{body{background:#f3efe6}.format-book{max-width:6.8in;margin:0 auto;padding:0 .48in .7in;background:#fffdf8;box-shadow:0 10px 30px rgba(0,0,0,.08)}}`;
}
function renderFormattedPreview() {
  const preview = $("#formattedPreview");
  if (!formatter.sourceText) { preview.hidden = true; $("#formatPlaceholder").hidden = false; $("#formatterActions").hidden = true; return; }
  preview.innerHTML = formatBookMarkup(false);
  preview.hidden = false;
  $("#formatPlaceholder").hidden = true;
  $("#formatterActions").hidden = false;
  $("#formatSavedState").textContent = "Preview ready";
  preview.style.setProperty("--format-font", formatFont(formatter.settings.font));
  preview.classList.toggle("is-poetry", effectiveBookType() === "poetry");
}

function updateFormatterPreview() { persistFormatter(); updateFormatterRecommendation(); if (formatter.sourceText) renderFormattedPreview(); }

async function exportEpub() {
  if (!formatter.sourceText) { showToast("Load a finished manuscript first."); return; }
  if (!window.JSZip) { showToast("EPUB helper is still loading. Try again in a moment."); return; }
  const zip = new window.JSZip();
  const title = formatTitleForExport();
  const author = formatter.author.trim() || "Author";
  const sections = formattedSections();
  const body = sections.map((chapter, index) => `<section epub:type="chapter" id="chapter-${index + 1}"><h2>${formatter.settings.chapterStyle === "numbered" ? `${index + 1}. ` : ""}${escapeHtml(chapter.title)}</h2>${textBlocksHtml(chapter.draft, effectiveBookType())}</section>`).join("");
  const frontMatter = `${formatter.settings.includeFrontMatter ? `<section class="epub-title"><h1>${escapeHtml(title)}</h1>${formatter.subtitle ? `<p class="subtitle">${escapeHtml(formatter.subtitle)}</p>` : ""}${author ? `<p class="author">${escapeHtml(author)}</p>` : ""}</section>` : ""}${formatter.copyright ? `<section class="epub-front"><p>${escapeHtml(formatter.copyright).replace(/\n/g,"<br/>")}</p></section>` : ""}${formatter.dedication ? `<section class="epub-front dedication"><p>${escapeHtml(formatter.dedication).replace(/\n/g,"<br/>")}</p></section>` : ""}${formatter.acknowledgements ? `<section class="epub-front"><h2>Acknowledgements</h2>${textBlocksHtml(formatter.acknowledgements,effectiveBookType())}</section>` : ""}`;
  const xhtml = `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body>${frontMatter}${body}</body></html>`;
  const css = `body{font-family:${formatFont(formatter.settings.font)};font-size:${formatter.settings.fontSize}pt;line-height:${formatter.settings.lineSpacing};margin:5%}h1{text-align:center;font-weight:400;margin:20% 0 10%}.subtitle{text-align:center;font-style:italic}.author{text-align:center;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:.12em}.epub-title,.epub-front{break-after:page;page-break-after:always;min-height:75vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}.dedication{font-style:italic}section{page-break-before:always;margin-top:10%}h2{font-weight:400}p{text-indent:${formatter.settings.paragraphIndent}em;margin:0 0 .8em}`;
  const nav = `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><meta charset="utf-8"/><title>Contents</title></head><body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${sections.map((chapter, index) => `<li><a href="content.xhtml#chapter-${index + 1}">${escapeHtml(chapter.title)}</a></li>`).join("")}</ol></nav></body></html>`;
  const manifest = `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${makeId()}</dc:identifier><dc:title>${escapeHtml(title)}</dc:title><dc:language>en</dc:language><dc:creator>${escapeHtml(author)}</dc:creator></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="content" href="content.xhtml" media-type="application/xhtml+xml"/><item id="styles" href="styles.css" media-type="text/css"/></manifest><spine><itemref idref="content"/></spine></package>`;
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file("OEBPS/nav.xhtml", nav); zip.file("OEBPS/content.xhtml", xhtml.replace(/<br>/g, "<br/>").replace(/&nbsp;/g, "&#160;")); zip.file("OEBPS/styles.css", css); zip.file("OEBPS/content.opf", manifest);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
  downloadFile(`${slug(title)}.epub`, blob); showToast("EPUB download started.");
}

async function exportDocx() {
  if (!formatter.sourceText) { showToast("Load a finished manuscript first."); return; }
  if (!window.JSZip) { showToast("The Word export helper is still loading. Try again in a moment."); return; }
  const [pageWidth, pageHeight] = trimDimensions(formatter.settings.trimSize);
  const twips = (inches) => Math.round(inches * 1440);
  const marginTwips = formatter.settings.margin === "narrow" ? 792 : formatter.settings.margin === "wide" ? 1296 : 1008;
  const fontName = ({ newsreader: "Georgia", georgia: "Georgia", palatino: "Palatino Linotype", sans: "Arial" })[formatter.settings.font] || "Georgia";
  const halfPoints = Math.round(Number(formatter.settings.fontSize || 11.5) * 2);
  const line = Math.round(Number(formatter.settings.lineSpacing || 1.55) * 240);
  const indent = Math.round(Number(formatter.settings.paragraphIndent || 0) * 1440);
  const para = (text, style = "Normal", pageBreak = false) => {
    const runs = String(text).split("\n").map((part, index) => `<w:r><w:t xml:space="preserve">${xmlEscape(part)}</w:t>${index < String(text).split("\n").length - 1 ? "<w:br/>" : ""}</w:r>`).join("");
    return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${pageBreak ? "<w:pageBreakBefore/>" : ""}</w:pPr>${runs}</w:p>`;
  };
  const blocks = [];
  if (formatter.settings.includeFrontMatter) {
    blocks.push(para(formatTitleForExport(), "Title"));
    if (formatter.subtitle) blocks.push(para(formatter.subtitle, "Subtitle"));
    if (formatter.author) blocks.push(para(formatter.author, "Author"));
    blocks.push(para("", "Normal", true));
  }
  if (formatter.copyright) blocks.push(para(formatter.copyright, "SmallText", true));
  if (formatter.dedication) blocks.push(para(formatter.dedication, "Dedication", true));
  const sections = formattedSections();
  if (formatter.settings.includeToc && sections.length > 1) {
    blocks.push(para("Contents", "Heading1", true));
    sections.forEach((chapter) => blocks.push(para(chapter.title, "Normal")));
  }
  if (formatter.acknowledgements) {
    blocks.push(para("Acknowledgements", "Heading1", true));
    formatter.acknowledgements.split(/\n\s*\n/).filter(Boolean).forEach((p) => blocks.push(para(p.trim())));
  }
  sections.forEach((chapter, index) => {
    blocks.push(para(chapter.title, "Heading1", index > 0 || blocks.length > 0));
    chapter.draft.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).forEach((p) => blocks.push(para(p)));
  });
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks.join("")}<w:sectPr><w:pgSz w:w="${twips(pageWidth)}" w:h="${twips(pageHeight)}"/><w:pgMar w:top="${marginTwips}" w:right="1037" w:bottom="${marginTwips}" w:left="1037" w:header="450" w:footer="450" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="${halfPoints}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="${line}" w:lineRule="auto"/><w:ind w:firstLine="${indent}"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr><w:pPr><w:jc w:val="center"/><w:spacing w:after="360"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:i/><w:sz w:val="26"/></w:rPr><w:pPr><w:jc w:val="center"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Author"><w:name w:val="Author"/><w:pPr><w:jc w:val="center"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="420" w:after="300"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="SmallText"><w:name w:val="Small Text"/><w:rPr><w:sz w:val="18"/></w:rPr><w:pPr><w:ind w:firstLine="0"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Dedication"><w:name w:val="Dedication"/><w:rPr><w:i/></w:rPr><w:pPr><w:jc w:val="center"/></w:pPr></w:style></w:styles>`;
  const zip = new window.JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("word/document.xml", documentXml);
  zip.file("word/styles.xml", stylesXml);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  downloadFile(`${slug(formatTitleForExport())}.docx`, blob);
  showToast("Word document download started. Review pagination in Word before print production.");
}

function exportDoc() { if (!formatter.sourceText) { showToast("Load a finished manuscript first."); return; } downloadFile(`${slug(formatTitleForExport())}.doc`, formatBookMarkup(true), "application/msword"); showToast("DOC download started."); }
function exportHtml() { if (!formatter.sourceText) { showToast("Load a finished manuscript first."); return; } downloadFile(`${slug(formatTitleForExport())}.html`, formatBookMarkup(true), "text/html"); showToast("HTML download started."); }
async function exportPdf() {
  if (!formatter.sourceText) { showToast("Load a finished manuscript first."); return; }
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("Your browser blocked the print window. Allow popups, then try again.");
    return;
  }
  const printHtml = formatBookMarkup(true).replace(
    "</head>",
    "<style>@media print{html,body{background:#fff!important}.format-book{max-width:none!important;box-shadow:none!important}}</style></head>"
  );
  let printStarted = false;
  const startPrint = () => {
    if (printStarted) return;
    printStarted = true;
    printWindow.focus();
    printWindow.print();
  };
  printWindow.addEventListener("load", startPrint, { once: true });
  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
  if (printWindow.document.readyState === "complete") startPrint();
  showToast("Print view opened. Choose Save as PDF in your browser's print dialog.");
}

function bindFormatterActions() {
  const formatTitle = $("#formatTitle");
  const formatAuthor = $("#formatAuthor");
  formatTitle.oninput = () => { formatter.title = formatTitle.value; updateFormatterPreview(); };
  formatAuthor.oninput = () => { formatter.author = formatAuthor.value; updateFormatterPreview(); };
  [["formatSubtitle","subtitle"],["formatCopyright","copyright"],["formatDedication","dedication"],["formatAcknowledgements","acknowledgements"]].forEach(([id,key]) => { const field = $(`#${id}`); field.oninput = () => { formatter[key] = field.value; updateFormatterPreview(); }; });
  $("#bookType,#trimSize,#formatFont,#chapterStyle,#includeFrontMatter,#includeToc,#includePageNumbers,#includeRunningHeaders,#formatMargin,#formatGutter,#formatFontSize,#formatLineSpacing,#formatIndent").forEach((field) => field.onchange = () => { const key = Object.entries(formatterFieldMap).find(([, id]) => id === field.id)?.[0] || field.id; formatter.settings[key] = field.type === "checkbox" ? field.checked : field.value; updateFormatterPreview(); });
  $("#formatFileInput").onchange = async (event) => { const text = await readFileInto(event.target.files[0], $("#formatSourceStatus"), null, ""); if (text) { formatter.sourceText = text; if (!formatter.title.trim()) formatter.title = event.target.files[0].name.replace(/\.[^.]+$/, ""); persistFormatter(); renderFormatter(); showToast("Finished manuscript loaded. Choose your format, then preview it."); } };
  $("#formatDropZone").ondragover = (event) => { event.preventDefault(); $("#formatDropZone").classList.add("is-dragging"); };
  $("#formatDropZone").ondragleave = () => $("#formatDropZone").classList.remove("is-dragging");
  $("#formatDropZone").ondrop = async (event) => { event.preventDefault(); $("#formatDropZone").classList.remove("is-dragging"); const file = event.dataTransfer.files[0]; const text = await extractFileText(file).catch((error) => { showToast(error.message); return ""; }); if (text) { formatter.sourceText = text; if (!formatter.title.trim()) formatter.title = file.name.replace(/\.[^.]+$/, ""); persistFormatter(); renderFormatter(); showToast("Finished manuscript loaded."); } };
  $("#formatDropZone").onclick = () => $("#formatFileInput").click();
  $("#formatDropZone").onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); $("#formatFileInput").click(); } };
  $("[data-format-paste]").onclick = async () => { try { const text = await navigator.clipboard.readText(); if (!text) { showToast("Your clipboard is empty."); return; } formatter.sourceText = text; persistFormatter(); renderFormatter(); showToast("Finished manuscript pasted. Choose your format, then preview it."); } catch (error) { showToast("Tap inside the book formatter after copying your text, or choose a file instead."); } };
  $("[data-format-preview]").onclick = () => { if (!formatter.sourceText.trim()) { showToast("Load the finished manuscript before previewing it."); return; } persistFormatter(); renderFormattedPreview(); $("#formattedPreview").scrollIntoView({ behavior: "smooth", block: "start" }); };
  $("[data-download-epub]").onclick = exportEpub;
  $("[data-download-doc]").onclick = exportDoc;
  $("[data-download-docx]").onclick = exportDocx;
  $("[data-download-pdf]").onclick = exportPdf;
  $("[data-download-html]").onclick = exportHtml;
  $("[data-download-format-backup]").onclick = () => { downloadFile(`${slug(formatTitleForExport())}-format-backup.json`, JSON.stringify(formatter, null, 2), "application/json"); showToast("Format backup download started."); };
}

function renderInitialView() {
  const directFormatterRoute = window.location.pathname.replace(/\/$/, "").endsWith("/formatter");
  const directEditingRoute = window.location.pathname.replace(/\/$/, "").endsWith("/editing");
  const view = directFormatterRoute || window.location.hash.toLowerCase().startsWith("#formatter") ? "formatter" : directEditingRoute || window.location.hash.toLowerCase().startsWith("#editing") ? "editing" : "beta";
  switchView(view);
}

bindGlobalActions();
renderCloudActions();
renderApp();
renderFormatter();
renderEditingWorkspace();
renderInitialView();
window.addEventListener("hashchange", () => switchView(window.location.hash.toLowerCase().startsWith("#formatter") ? "formatter" : window.location.hash.toLowerCase().startsWith("#editing") ? "editing" : "beta"));
