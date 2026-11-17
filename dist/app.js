const lenses = [
  {
    title: "First impression",
    summary: "Serious, practical, and a little too controlled",
    observation: "The chapter opens with a clear conflict between ambition and reality and establishes a responsible position quickly.",
    detail: "The reader understands the argument, but not yet the lived experience behind it. The opening explains the problem before giving the reader a scene, confession, or concrete moment that makes the problem urgent.",
    action: "Draft a short opening scene around a message, rejection, first order, or strained friendship. Let the reader feel the problem before you interpret it."
  },
  {
    title: "Emotional impact",
    summary: "Warm in intention, restrained in experience",
    observation: "The sections about family pressure, lost trust, and the damage caused by treating people as numbers carry the strongest emotional charge.",
    detail: "The chapter names disappointment, resentment, and shame, but moves quickly to the lesson. Real people often defend themselves, blame others, or repeat a harmful pattern before they change.",
    action: "Leave one emotional conflict open for longer. Show the private argument between needing income and wanting to protect a relationship."
  },
  {
    title: "Character development",
    summary: "Clear contrast, limited complexity",
    observation: "David and Elena make the difference between pressure and patience easy to understand.",
    detail: "They currently function as a bad example and a good example. David needs a sympathetic pressure behind his urgency, and Elena needs a mistake, doubt, or temptation so her growth feels earned.",
    action: "Give both characters a specific personal pressure and show one setback that forces each of them to choose how they will continue."
  },
  {
    title: "Patterns noticed",
    summary: "Strong contrast and repeated moral vocabulary",
    observation: "The chapter repeatedly contrasts appearance with reality, recruitment with service, and freedom with self discipline.",
    detail: "The structure gives the chapter unity. However, the repeated use of words such as trust, service, value, integrity, genuine, and sustainable can begin to sound like a prepared presentation.",
    action: "Keep the contrast structure, but trade some repeated principles for a scene, a piece of dialogue, or a specific customer interaction."
  },
  {
    title: "Plot and pacing",
    summary: "Logical movement with a uniform rhythm",
    observation: "The chapter progresses sensibly from definition to relationships, legitimacy, expectation, responsibility, and action.",
    detail: "The pace rarely changes and the David and Elena example jumps from their first day to two years later. The chapter needs a complication that cannot be answered by a principle alone.",
    action: "Add a difficult case involving a good product and a pressured recruitment culture. Expand the example into an initial expectation, setback, and decision."
  },
  {
    title: "Clarity",
    summary: "One of the chapter's strongest qualities",
    observation: "The headings, examples, and plain language make the argument accessible to readers without specialist knowledge.",
    detail: "The terms network marketing, direct selling, and multi level marketing need a clear house definition. The existence of a real product is also only one part of evaluating a company's legitimacy.",
    action: "Add a definitions note and a practical company evaluation checklist covering refunds, required purchases, income disclosures, pricing, and recruitment pressure."
  },
  {
    title: "Overall reader experience",
    summary: "Reassuring for supporters, not yet demanding enough for skeptics",
    observation: "The reader is likely to finish feeling steadier, more realistic, and encouraged to treat people with respect.",
    detail: "A skeptical reader may feel that the chapter places too much responsibility on individual distributors and not enough on compensation structures, training cultures, pricing, and income distribution.",
    action: "Keep the hopeful tone, but include one paragraph acknowledging the systems that can reward poor behavior even when products are real."
  },
  {
    title: "Suggestions for improvement",
    summary: "Specific moves that can deepen the next draft",
    observation: "The strongest recommendation is to add a vivid scene, a personal authority point, a difficult ethical situation, and more balanced structural analysis.",
    detail: "The chapter does not need more principles as much as it needs evidence of those principles in action. The exercises at the end will also be stronger when tied to scenes or cases from the chapter.",
    action: "Revise in layers: scene first, author presence second, difficult case third, precision checklist fourth, then sentence level repetition."
  },
  {
    title: "Final assessment",
    summary: "A worthwhile foundation that needs a pulse",
    observation: "The chapter is clear, organized, ethically grounded, and useful as a foundation for the book.",
    detail: "Its main weakness is that it explains more than it reveals. The next draft should show why professionalism, service, and realistic expectations are difficult to practice under real pressure.",
    action: "Before polishing sentences, make sure the reader encounters a human moment, a credible struggle, and a choice with a real cost."
  }
];

const revisionTasks = [
  "Draft a specific opening scene before the current introduction.",
  "Add one honest paragraph about the author's experience or authority.",
  "Give David a personal pressure that complicates his urgency.",
  "Give Elena a mistake or doubt that makes her growth feel earned.",
  "Add a difficult case involving product demand and recruitment pressure.",
  "Expand the David and Elena example beyond the two year time jump.",
  "Define network marketing, direct selling, and multi level marketing for this book.",
  "Add a company evaluation checklist with financial warning signs.",
  "Replace repeated principles with dialogue, detail, or customer evidence.",
  "Add a clear caution against debt, unnecessary inventory, and assumed future income."
];

const lensList = document.querySelector("#lensList");
const checklist = document.querySelector("#checklist");
const storageKey = "revision-guide-chapter-one";

function renderLenses() {
  lensList.innerHTML = lenses.map((lens, index) => `
    <article class="lens-item" data-lens="${index}">
      <button class="lens-trigger" id="lens-trigger-${index}" type="button" aria-expanded="false" aria-controls="lens-panel-${index}">
        <span class="lens-num">0${index + 1}</span>
        <span><span class="lens-title">${lens.title}</span><span class="lens-summary">${lens.summary}</span></span>
        <span class="lens-plus" aria-hidden="true">+</span>
      </button>
      <div class="lens-panel" id="lens-panel-${index}" role="region" aria-labelledby="lens-trigger-${index}" hidden>
        <div><h4>Reading</h4><p>${lens.observation}</p></div>
        <div><h4>Why it matters</h4><p>${lens.detail}</p></div>
        <div><h4>Revision move</h4><p>${lens.action}</p></div>
      </div>
    </article>
  `).join("");

  lensList.querySelectorAll(".lens-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const item = trigger.closest(".lens-item");
      const isOpen = item.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", String(isOpen));
      item.querySelector(".lens-panel").hidden = !isOpen;
    });
  });
}

function getSavedTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!Array.isArray(saved)) return [];
    return revisionTasks.map((_, index) => saved[index] === true);
  } catch (error) {
    return [];
  }
}

function saveTasks(completed) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(completed));
  } catch (error) {
    // Progress remains available for the current session if storage is blocked.
  }
}

function updateProgress(completed) {
  const total = revisionTasks.length;
  const count = completed.filter(Boolean).length;
  const percent = Math.round((count / total) * 100);
  document.querySelector("#progressCount").textContent = `${count} of ${total} complete`;
  document.querySelector("#progressPercent").textContent = `${percent}%`;
  document.querySelector("#headerProgress").textContent = `${percent}%`;
  document.querySelector("#progressBar").style.width = `${percent}%`;
  const bar = document.querySelector(".progress-track");
  bar.setAttribute("aria-valuenow", String(percent));
}

function renderChecklist() {
  const completed = getSavedTasks();
  checklist.innerHTML = revisionTasks.map((task, index) => `
    <label class="check-item">
      <input type="checkbox" data-task="${index}" ${completed[index] ? "checked" : ""} />
      <span class="check-box" aria-hidden="true"></span>
      <span class="check-text">${task}</span>
    </label>
  `).join("");
  updateProgress(completed);

  checklist.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      const next = getSavedTasks();
      next[Number(input.dataset.task)] = input.checked;
      saveTasks(next);
      updateProgress(next);
    });
  });
}

function setAllLenses(open) {
  lensList.querySelectorAll(".lens-item").forEach((item) => {
    item.classList.toggle("is-open", open);
    item.querySelector(".lens-trigger").setAttribute("aria-expanded", String(open));
    item.querySelector(".lens-panel").hidden = !open;
  });
}

document.querySelector("[data-expand-all]").addEventListener("click", () => setAllLenses(true));
document.querySelector("[data-collapse-all]").addEventListener("click", () => setAllLenses(false));

const menuButton = document.querySelector("[data-mobile-menu]");
menuButton.addEventListener("click", () => {
  const isExpanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isExpanded));
  document.querySelector("[data-site-nav]").classList.toggle("is-open", !isExpanded);
  menuButton.setAttribute("aria-label", isExpanded ? "Open navigation" : "Close navigation");
});

document.querySelectorAll("[data-site-nav] a").forEach((link) => {
  link.addEventListener("click", () => {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
    document.querySelector("[data-site-nav]").classList.remove("is-open");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
    menuButton.click();
    menuButton.focus();
  }
});

renderLenses();
renderChecklist();
