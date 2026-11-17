const feedbackDefinitions = [
  ["firstImpression", "First impression", "What did the chapter make you expect, feel, or wonder in its opening pages?", "Name the immediate reader response before explaining why."],
  ["emotionalImpact", "Emotional impact", "Where did the chapter move you, unsettle you, or leave you emotionally distant?", "Look for feeling, not only whether the point was understood."],
  ["characterDevelopment", "Character development", "What changed for the characters, and where did their choices feel earned or too convenient?", "For nonfiction, use this for real people, case studies, or the author's presence."],
  ["patterns", "Patterns noticed", "What ideas, images, structures, or repeated habits became visible as you read?", "Patterns can reveal both the book's voice and its repetitions."],
  ["plotPacing", "Plot and pacing", "Where did the chapter pull you forward, slow down, rush, or resolve tension too quickly?", "Nonfiction still needs movement, pressure, and a reason to continue."],
  ["clarity", "Clarity", "What was clear, confusing, unsupported, or open to misinterpretation?", "Mark terms, claims, transitions, and missing context."],
  ["readerExperience", "Overall reader experience", "What kind of reader will connect with this chapter, and what might make another reader hesitate?", "Include the honest experience of a supportive and skeptical reader."],
  ["suggestions", "Suggestions for improvement", "What specific change would make the chapter more effective?", "Offer a move the author can actually make on the page."]
];

const storageKey = "authors-revision-desk-project";
const defaultFeedback = () => Object.fromEntries(feedbackDefinitions.map(([key]) => [key, ""]));
const makeId = () => `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
let state = loadState() || { title: "", chapters: [], selectedId: null, updatedAt: null };
let saveTimer;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const onboarding = $("#onboarding");
const desk = $("#desk");
const toast = $("#toast");

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || !Array.isArray(saved.chapters)) return null;
    saved.chapters = saved.chapters.map((chapter) => ({
      id: chapter.id || makeId(),
      title: chapter.title || "Untitled chapter",
      draft: typeof chapter.draft === "string" ? chapter.draft : "",
      improved: typeof chapter.improved === "string" ? chapter.improved : "",
      feedback: { ...defaultFeedback(), ...(chapter.feedback || {}) }
    }));
    return saved;
  } catch (error) {
    return null;
  }
}

function persist(message = "Saved locally") {
  state.updatedAt = new Date().toISOString();
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (error) { message = "Saved for this session"; }
  $("#savedState").textContent = message;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { $("#savedState").textContent = "Saved locally"; }, 1300);
}

function wordCount(text = "") { return text.trim() ? text.trim().split(/\s+/).length : 0; }
function escapeHtml(value = "") { return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char])); }
function showToast(message) { toast.textContent = message; toast.classList.add("is-visible"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600); }

function splitManuscript(text) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const headingPattern = /^(?:(?:chapter|part|prologue|epilogue)\b[^\n]*|[A-Z][A-Z\s0-9:'’,-]{5,})$/gim;
  const matches = [...normalized.matchAll(headingPattern)].filter((match) => match.index !== 0 || /chapter|part|prologue|epilogue/i.test(match[0]));
  if (matches.length < 2) return [{ id: makeId(), title: "Manuscript", draft: normalized, improved: normalized, feedback: defaultFeedback() }];
  const chapters = [];
  const preface = normalized.slice(0, matches[0].index).trim();
  if (preface) chapters.push({ id: makeId(), title: "Opening material", draft: preface, improved: preface, feedback: defaultFeedback() });
  matches.forEach((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    const title = match[0].trim().replace(/\s+/g, " ");
    const draft = normalized.slice(start, end).trim();
    chapters.push({ id: makeId(), title, draft, improved: draft, feedback: defaultFeedback() });
  });
  return chapters;
}

function createProject(title, text) {
  const chapters = splitManuscript(text);
  if (!chapters.length) { showToast("Add some manuscript text first."); return; }
  state = { title: title.trim() || "Untitled manuscript", chapters, selectedId: chapters[0].id, updatedAt: null };
  persist(); renderApp(); showToast(`${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"} ready to review.`); $("#workspace").scrollIntoView({ behavior: "smooth" });
}

function selectedChapter() { return state.chapters.find((chapter) => chapter.id === state.selectedId) || state.chapters[0]; }
function renderApp() { const hasProject = state.chapters.length > 0; onboarding.hidden = hasProject; desk.hidden = !hasProject; $("#workspaceHeading").textContent = hasProject ? state.title : "Start a new review"; if (hasProject) { renderChapterRail(); renderCurrentChapter(); } }

function renderChapterRail() {
  $("#chapterList").innerHTML = state.chapters.map((chapter, index) => `<button class="chapter-button ${chapter.id === state.selectedId ? "is-active" : ""}" type="button" data-chapter-id="${chapter.id}">${escapeHtml(chapter.title)}<small>${wordCount(chapter.improved || chapter.draft)} words${chapter.improved && chapter.improved !== chapter.draft ? " · revised" : ""}</small></button>`).join("");
  $("#chapterCount").textContent = `${state.chapters.length} ${state.chapters.length === 1 ? "chapter" : "chapters"}`;
  const revised = state.chapters.filter((chapter) => chapter.improved && chapter.improved !== chapter.draft).length;
  $("#completionCount").textContent = `${Math.round((revised / state.chapters.length) * 100)}% revised`;
  $$('[data-chapter-id]').forEach((button) => button.addEventListener("click", () => { state.selectedId = button.dataset.chapterId; persist(); renderChapterRail(); renderCurrentChapter(); }));
}

function renderCurrentChapter() {
  const chapter = selectedChapter();
  if (!chapter) return;
  $("#chapterHeading").textContent = chapter.title;
  $("#chapterMeta").textContent = `${wordCount(chapter.draft)} original words · ${wordCount(chapter.improved)} improved words`;
  $("#draftText").value = chapter.draft;
  $("#improvedText").value = chapter.improved;
  $("#draftWords").textContent = `${wordCount(chapter.draft)} words`;
  $("#improvedWords").textContent = `${wordCount(chapter.improved)} words`;
  $("#generalFeedback").value = chapter.feedback.general || "";
  $("#feedbackFields").innerHTML = feedbackDefinitions.map(([key, label, question, help]) => `<div class="feedback-group"><label for="feedback-${key}">${label}</label><span class="feedback-help">${question}</span><textarea class="feedback-input" id="feedback-${key}" data-feedback-key="${key}" placeholder="Write detailed notes here..."></textarea></div>`).join("");
  feedbackDefinitions.forEach(([key]) => { $(`#feedback-${key}`).value = chapter.feedback[key] || ""; });
  updateBrief();
  bindCurrentChapter();
}

function bindCurrentChapter() {
  $("#draftText").oninput = (event) => { selectedChapter().draft = event.target.value; $("#draftWords").textContent = `${wordCount(event.target.value)} words`; $("#chapterMeta").textContent = `${wordCount(event.target.value)} original words · ${wordCount(selectedChapter().improved)} improved words`; persist(); };
  $("#improvedText").oninput = (event) => { selectedChapter().improved = event.target.value; $("#improvedWords").textContent = `${wordCount(event.target.value)} words`; $("#chapterMeta").textContent = `${wordCount(selectedChapter().draft)} original words · ${wordCount(event.target.value)} improved words`; persist(); renderChapterRail(); };
  $$("[data-feedback-key]").forEach((field) => field.oninput = (event) => { selectedChapter().feedback[event.target.dataset.feedbackKey] = event.target.value; persist(); updateBrief(); });
  $("#generalFeedback").oninput = (event) => { selectedChapter().feedback.general = event.target.value; persist(); updateBrief(); };
  $$('[data-editor-tab]').forEach((tab) => tab.onclick = () => switchEditor(tab.dataset.editorTab));
}

function switchEditor(view) { $$('[data-editor-tab]').forEach((tab) => { const active = tab.dataset.editorTab === view; tab.classList.toggle("is-active", active); tab.setAttribute("aria-selected", String(active)); }); $$('[data-writing-panel]').forEach((panel) => { panel.hidden = panel.dataset.writingPanel !== view; panel.classList.toggle("is-active", panel.dataset.writingPanel === view); }); }

function updateBrief() {
  const chapter = selectedChapter(); if (!chapter) return;
  const filled = feedbackDefinitions.filter(([key]) => (chapter.feedback[key] || "").trim());
  if (!filled.length && !(chapter.feedback.general || "").trim()) { $("#revisionBrief").textContent = "Add feedback above to create a focused revision brief."; return; }
  const lines = filled.map(([key, label]) => { const excerpt = chapter.feedback[key].trim().replace(/\s+/g, " "); return `${label}: ${excerpt.length > 180 ? `${excerpt.slice(0, 177)}...` : excerpt}`; });
  $("#revisionBrief").textContent = `For ${chapter.title}, review the following before revising: ${lines.join(" ")}${chapter.feedback.general ? ` General note: ${chapter.feedback.general.trim().replace(/\s+/g, " ").slice(0, 240)}` : ""}`;
}

function downloadFile(filename, content, type = "text/plain") { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500); }
function slug(value) { return (value || "manuscript").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "manuscript"; }
function scopeChapter() { const scope = $("#exportScope"); return scope && scope.value === "current" ? selectedChapter() : null; }
function feedbackMarkdown(chapter) { const lines = [`# Feedback report: ${state.title}`, "", `## ${chapter.title}`, "", `Original word count: ${wordCount(chapter.draft)}`, `Improved word count: ${wordCount(chapter.improved)}`, ""]; feedbackDefinitions.forEach(([key, label, question]) => { lines.push(`### ${label}`, "", `_${question}_`, "", chapter.feedback[key] || "No notes recorded.", ""); }); lines.push("### General feedback", "", chapter.feedback.general || "No general feedback recorded.", "", "### Revision status", "", chapter.improved !== chapter.draft ? "An improved version has been drafted in the workspace." : "No changes have been made to the improved version yet."); return lines.join("\n"); }
function allFeedbackMarkdown() { return [`# Feedback report: ${state.title}`, "", `Chapters reviewed: ${state.chapters.length}`, "", ...state.chapters.map(feedbackMarkdown)].join("\n\n---\n\n"); }
function manuscriptText(chapter) { return chapter.improved || chapter.draft; }
function allManuscriptText() { return state.chapters.map((chapter) => manuscriptText(chapter)).join("\n\n\n"); }

function bindGlobalActions() {
  $("[data-create-project]").onclick = () => createProject($("#projectTitle").value, $("#manuscriptInput").value);
  $("#fileInput").onchange = async (event) => { const file = event.target.files[0]; if (!file) return; const text = await file.text(); $("#projectTitle").value = file.name.replace(/\.[^.]+$/, ""); $("#manuscriptInput").value = text; showToast("File loaded. Create your workspace when ready."); };
  $("[data-new-project]").onclick = () => { if (confirm("Start a new project? Your current project will remain in this browser only if you have downloaded a backup.")) { state = { title: "", chapters: [], selectedId: null, updatedAt: null }; localStorage.removeItem(storageKey); $("#projectTitle").value = ""; $("#manuscriptInput").value = ""; renderApp(); $("#workspace").scrollIntoView({ behavior: "smooth" }); } };
  $("[data-add-chapter]").onclick = () => { const chapter = { id: makeId(), title: `Chapter ${state.chapters.length + 1}`, draft: "", improved: "", feedback: defaultFeedback() }; state.chapters.push(chapter); state.selectedId = chapter.id; persist(); renderChapterRail(); renderCurrentChapter(); showToast("New chapter added."); };
  $("[data-delete-chapter]").onclick = () => { if (state.chapters.length === 1) { showToast("Keep at least one chapter in the workspace."); return; } if (!confirm("Delete this chapter and its feedback?")) return; state.chapters = state.chapters.filter((chapter) => chapter.id !== state.selectedId); state.selectedId = state.chapters[0].id; persist(); renderChapterRail(); renderCurrentChapter(); };
  $("[data-start-revision]").onclick = () => { const chapter = selectedChapter(); chapter.improved = chapter.draft; persist(); renderCurrentChapter(); switchEditor("improved"); showToast("Original draft copied into the improved version."); };
  $("[data-copy-brief]").onclick = async () => { const brief = $("#revisionBrief").textContent; try { await navigator.clipboard.writeText(brief); showToast("Revision brief copied."); } catch (error) { showToast("Select and copy the revision brief manually."); } };
  $("[data-download-feedback]").onclick = () => { const current = scopeChapter(); const content = current ? feedbackMarkdown(current) : allFeedbackMarkdown(); downloadFile(`${slug(state.title)}-feedback${current ? `-${slug(current.title)}` : ""}.md`, content, "text/markdown"); showToast("Feedback download started."); };
  $("[data-download-project]").onclick = () => { downloadFile(`${slug(state.title)}-project-backup.json`, JSON.stringify(state, null, 2), "application/json"); showToast("Project backup download started."); };
  $("[data-scroll-workspace]").onclick = () => $("#workspace").scrollIntoView({ behavior: "smooth" });
  const exportSelect = document.createElement("select"); exportSelect.id = "exportScope"; exportSelect.className = "export-scope"; exportSelect.innerHTML = `<option value="all">Whole manuscript</option><option value="current">Current chapter</option>`; const exportButton = document.createElement("button"); exportButton.type = "button"; exportButton.className = "button button-quiet"; exportButton.textContent = "Download improved manuscript"; exportButton.onclick = () => { const current = scopeChapter(); const content = current ? manuscriptText(current) : allManuscriptText(); downloadFile(`${slug(state.title)}-improved${current ? `-${slug(current.title)}` : ""}.txt`, content); showToast("Improved manuscript download started."); }; $(".feedback-actions").append(exportSelect, exportButton);
  const menuButton = $("[data-mobile-menu]"); menuButton.onclick = () => { const open = menuButton.getAttribute("aria-expanded") === "true"; menuButton.setAttribute("aria-expanded", String(!open)); $(".top-nav").classList.toggle("is-open", !open); menuButton.setAttribute("aria-label", open ? "Open navigation" : "Close navigation"); }; $$(".top-nav a").forEach((link) => link.onclick = () => { menuButton.setAttribute("aria-expanded", "false"); $(".top-nav").classList.remove("is-open"); }); document.addEventListener("keydown", (event) => { if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") { menuButton.click(); menuButton.focus(); } });
}

bindGlobalActions();
renderApp();
