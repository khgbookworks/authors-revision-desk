const $ = (selector, root = document) => root.querySelector(selector);
const fragment = new URLSearchParams(window.location.hash.slice(1));
const shareId = fragment.get("share") || "";
const accessKey = fragment.get("key") || "";
let reviewData = null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function toast(message) {
  const node = $("#reviewToast");
  node.textContent = message;
  node.classList.add("is-visible");
  window.setTimeout(() => node.classList.remove("is-visible"), 2600);
}

async function requestReview(method = "GET", payload = null) {
  const response = await fetch(`/api/reviews/${encodeURIComponent(shareId)}`, {
    method,
    headers: {
      "Authorization": `Bearer ${accessKey}`,
      "Accept": "application/json",
      ...(payload ? { "Content-Type": "application/json" } : {})
    },
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "This review link could not be opened.");
  return data;
}

function renderSuggestions() {
  const suggestions = reviewData.snapshot?.editor?.suggestions || [];
  const decisions = new Map((reviewData.decisions || []).map((item) => [item.suggestion_id, item]));
  $("#suggestionCount").textContent = `${suggestions.length} shared`;
  if (!suggestions.length) {
    $("#reviewSuggestions").innerHTML = '<div class="review-message">There are no proposed editing changes in this version. You can still leave chapter-level comments below.</div>';
    return;
  }
  $("#reviewSuggestions").innerHTML = suggestions.map((item, index) => {
    const decision = decisions.get(item.id);
    return `<article class="review-suggestion" data-suggestion="${escapeHtml(item.id)}">
      <h3>Suggestion ${index + 1}</h3>
      <p>${escapeHtml(item.reason || "Proposed manuscript change")}</p>
      <div class="review-diff">
        <div><strong>Original wording</strong><p>${escapeHtml(item.original)}</p></div>
        <div><strong>Suggested wording</strong><p>${escapeHtml(item.proposed)}</p></div>
      </div>
      <label for="comment-${index}">Your comment</label>
      <textarea id="comment-${index}" data-review-comment placeholder="Add a question or explain your decision…">${escapeHtml(decision?.comment || "")}</textarea>
      <div class="review-actions">
        <button type="button" data-decision="accepted">Accept</button>
        <button type="button" class="secondary" data-decision="rejected">Reject</button>
        <button type="button" class="secondary" data-decision="commented">Send comment</button>
      </div>
      <span class="review-status" data-review-status>${decision ? `Last saved: ${escapeHtml(decision.decision)}` : "No decision saved yet"}</span>
    </article>`;
  }).join("");
  document.querySelectorAll("[data-suggestion]").forEach((card) => {
    card.querySelectorAll("[data-decision]").forEach((button) => {
      button.addEventListener("click", async () => {
        const comment = card.querySelector("[data-review-comment]").value;
        await saveDecision(card, card.dataset.suggestion, button.dataset.decision, comment);
      });
    });
  });
}

async function saveDecision(card, suggestionId, decision, comment) {
  const buttons = [...card.querySelectorAll("button")];
  buttons.forEach((button) => button.disabled = true);
  try {
    await requestReview("POST", {
      suggestionId,
      decision,
      comment,
      versionId: reviewData.version.id
    });
    card.querySelector("[data-review-status]").textContent = `Saved: ${decision}`;
    toast("Your response has been saved.");
  } catch (error) {
    toast(error.message);
  } finally {
    buttons.forEach((button) => button.disabled = false);
  }
}

function renderEditorSubmissionWorkspace() {
  const root = $("#reviewContent");
  root.innerHTML = `
    <section class="review-editor-submit">
      <div class="review-section-head"><div><p class="eyebrow">Editor collaboration</p><h2>Submit a proposed edit</h2></div></div>
      <p class="review-message">Your suggestions are sent to the project owner for review. They do not change the manuscript.</p>
      <label for="editorLocation">Location or chapter</label><input id="editorLocation" type="text" placeholder="Chapter 2, paragraph 4">
      <label for="editorCategory">Edit category</label><select id="editorCategory"><option>Developmental</option><option>Structural</option><option>Line edit</option><option>Copyedit</option><option>Proofreading</option><option>Continuity</option><option>Other</option></select>
      <label for="editorOriginal">Original wording</label><textarea id="editorOriginal" rows="5" placeholder="Paste the exact wording from the shared manuscript"></textarea>
      <label for="editorProposed">Proposed wording</label><textarea id="editorProposed" rows="5" placeholder="Enter your suggested change"></textarea>
      <label for="editorReason">Reason for the change</label><textarea id="editorReason" rows="3" placeholder="Explain why you recommend this change"></textarea>
      <button id="sendEditorSubmission" type="button">Submit proposal</button>
    </section>
    <section class="review-editor-history"><div class="review-section-head"><div><p class="eyebrow">Your submissions</p><h2>Previously submitted proposals</h2></div></div><div id="editorSubmissionHistory"></div></section>`;
  const history = $("#editorSubmissionHistory");
  const submissions = reviewData.submissions || [];
  history.innerHTML = submissions.length ? submissions.map((item) => `<article class="review-suggestion"><strong>${escapeHtml(item.category || "Editorial")}</strong><small>${escapeHtml(item.location || "Location not specified")} · ${new Date(item.createdAt).toLocaleString()}</small><p><b>Original:</b> ${escapeHtml(item.original)}</p><p><b>Proposed:</b> ${escapeHtml(item.proposed)}</p><p><b>Reason:</b> ${escapeHtml(item.reason)}</p></article>`).join("") : '<p class="review-message">No proposals submitted yet.</p>';
  $("#sendEditorSubmission").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const submission = {
      location: $("#editorLocation").value,
      category: $("#editorCategory").value,
      original: $("#editorOriginal").value,
      proposed: $("#editorProposed").value,
      reason: $("#editorReason").value
    };
    button.disabled = true;
    try {
      await requestReview("POST", { submission });
      reviewData.submissions = [{ ...submission, createdAt: new Date().toISOString() }, ...(reviewData.submissions || [])];
      renderEditorSubmissionWorkspace();
      toast("Your proposal has been sent to the project owner.");
    } catch (error) { toast(error.message); }
    finally { const next = $("#sendEditorSubmission"); if (next) next.disabled = false; }
  });
}

function renderChapters() {
  const chapters = reviewData.snapshot?.beta?.chapters || [];
  const decisions = new Map((reviewData.decisions || []).map((item) => [item.suggestion_id, item]));
  const root = $("#reviewChapters");
  if (!chapters.length) {
    root.innerHTML = '<div class="review-message">No beta-reading chapters were included in this shared snapshot.</div>';
    return;
  }
  root.innerHTML = chapters.map((chapter, index) => {
    const feedback = chapter.feedback || {};
    const notes = Object.entries(feedback).filter(([, value]) => String(value || "").trim());
    const chapterDecision = decisions.get(`chapter-note-${chapter.id}`);
    return `<article class="review-chapter">
      <details>
        <summary>${escapeHtml(chapter.title || `Chapter ${index + 1}`)}</summary>
        <div class="chapter-body">${escapeHtml(chapter.draft || "")}</div>
        ${notes.length ? `<div class="chapter-feedback"><strong>Reader notes</strong>${notes.map(([key, value]) => `<p><b>${escapeHtml(key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`))}:</b> ${escapeHtml(value)}</p>`).join("")}</div>` : ""}
        <label for="chapter-comment-${index}">Comment on this chapter</label>
        <textarea id="chapter-comment-${index}" placeholder="Share your thoughts about this chapter…">${escapeHtml(chapterDecision?.comment || "")}</textarea>
        ${chapterDecision ? `<span class="review-status">Last comment saved ${new Date(chapterDecision.updated_at).toLocaleString()}</span>` : ""}
        <div class="review-actions"><button type="button" class="secondary" data-chapter-comment="${escapeHtml(chapter.id)}">Send chapter comment</button></div>
      </details>
    </article>`;
  }).join("");
  root.querySelectorAll("[data-chapter-comment]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".review-chapter");
      const comment = card.querySelector("textarea").value.trim();
      if (!comment) { toast("Write a comment before sending it."); return; }
      button.disabled = true;
      try {
        await requestReview("POST", {
          suggestionId: `chapter-note-${button.dataset.chapterComment}`,
          decision: "commented",
          comment,
          versionId: reviewData.version.id
        });
        toast("Chapter comment saved.");
        card.querySelector("textarea").value = "";
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function init() {
  if (!shareId || !/^[a-f0-9]{64}$/i.test(accessKey)) {
    $("#reviewError").hidden = false;
    $("#reviewError").textContent = "This review link is incomplete. Ask the project owner to create a new private review link.";
    $("#reviewTitle").textContent = "Review link unavailable";
    return;
  }
  try {
    reviewData = await requestReview();
    $("#reviewTitle").textContent = reviewData.project.title;
    $("#reviewMeta").textContent = `Version ${reviewData.version.number} · ${reviewData.version.label} · Access expires ${new Date(reviewData.access.expiresAt).toLocaleDateString()}`;
    $("#reviewContent").hidden = false;
    if (reviewData.access.role === "editor") {
      $("#reviewMeta").textContent = `Version ${reviewData.version.number} · Editor submission access · Expires ${new Date(reviewData.access.expiresAt).toLocaleDateString()}`;
      renderEditorSubmissionWorkspace();
    } else {
      renderSuggestions();
      renderChapters();
    }
  } catch (error) {
    $("#reviewError").hidden = false;
    $("#reviewError").textContent = error.message;
    $("#reviewTitle").textContent = "Review link unavailable";
  }
}

init();
