import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { newId, newSecret, hashSecret, bearer, authorizeShare } from "../functions/api/_shared.js";
import { onRequestPost as submitReview } from "../functions/api/reviews/[shareId].js";

const schema = readFileSync("migrations/0001_manuscript_workspace.sql", "utf8");
const shares = readFileSync("functions/api/projects/[id]/shares.js", "utf8");
const reviews = readFileSync("functions/api/reviews/[shareId].js", "utf8");
const projectApi = readFileSync("functions/api/projects/[id].js", "utf8");
const createApi = readFileSync("functions/api/projects/index.js", "utf8");
const aiEditApi = readFileSync("functions/api/ai-edit.js", "utf8");
const betaApi = readFileSync("functions/api/beta-read.js", "utf8");
const bookApi = readFileSync("functions/api/beta-read/book.js", "utf8");
const appSource = readFileSync("app.js", "utf8");
const htmlSource = readFileSync("index.html", "utf8");

for (const table of ["projects", "project_versions", "project_shares", "review_decisions", "ai_usage", "editor_submissions"]) {
  assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`), `Missing ${table} table`);
}
assert.match(schema, /version_id TEXT NOT NULL REFERENCES project_versions/);
assert.match(shares, /INSERT INTO project_shares \(id, project_id, version_id, token_hash/);
assert.doesNotMatch(shares, /"undefined"/);
assert.match(projectApi, /await env\.DB\.batch\(/);
assert.match(createApi, /await env\.DB\.batch\(/);
assert.match(reviews, /const versionId = share\.version_id/);
assert.match(reviews, /share\.role === "editor"/);
assert.match(reviews, /INSERT INTO editor_submissions/);
assert.match(projectApi, /SELECT id, version_id, submission_json, created_at FROM editor_submissions/);
assert.match(projectApi, /export async function onRequestDelete/);
assert.match(appSource, /function renderCloudDashboard/);
assert.match(appSource, /function archiveCurrentCloudProject/);
assert.match(appSource, /data-import-editor-submission/);
assert.match(htmlSource, /cloudProjectSelect/);
assert.match(htmlSource, /data-cloud-editor-share/);
assert.match(aiEditApi, /reserveAiUsage/);
assert.match(betaApi, /reserveAiUsage/);
assert.match(bookApi, /reserveAiUsage/);
assert.match(aiEditApi, /authorizeOwner/);
assert.match(betaApi, /authorizeOwner/);
assert.match(appSource, /function sanitizeRichHtml/);
assert.match(appSource, /function richHtmlToDocxBlocks/);
assert.match(appSource, /function runFormatterQualityChecks/);
assert.match(htmlSource, /data-format-qa/);

const id = newId("prj");
assert.match(id, /^prj_[a-f0-9]{32}$/);
const token = newSecret();
assert.match(token, /^[a-f0-9]{64}$/);
assert.equal((await hashSecret(token)).length, 64);
assert.equal(bearer(new Request("https://example.test", { headers: { authorization: `Bearer ${token}` } })), token);
assert.equal(bearer(new Request("https://example.test")), "");

let querySeen = "";
const mockEnv = {
  DB: {
    prepare(query) {
      querySeen = query;
      return { bind() { return { async first() { return { id: "shr_1", project_id: "prj_1", version_id: "ver_1", role: "author_review", expires_at: "2099-01-01T00:00:00.000Z" }; } }; } };
    }
  }
};
const authorized = await authorizeShare(new Request("https://example.test", { headers: { authorization: `Bearer ${token}` } }), mockEnv, "shr_1");
assert.equal(authorized.version_id, "ver_1");
assert.match(querySeen, /s\.version_id/);

let insertedQuery = "";
let insertedValues = [];
const editorEnv = {
  DB: {
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              return { id: "shr_test", project_id: "prj_test", version_id: "ver_test", role: "editor", expires_at: "2099-01-01T00:00:00.000Z", title: "Test manuscript" };
            },
            async run() { insertedQuery = query; insertedValues = values; return { success: true }; }
          };
        }
      };
    }
  },
  MANUSCRIPTS: {}
};
const editorResponse = await submitReview({
  request: new Request("https://example.test/api/reviews/shr_test", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ submission: { original: "Original sentence.", proposed: "Revised sentence.", reason: "Clearer meaning.", location: "Chapter 1" } })
  }),
  env: editorEnv,
  params: { shareId: "shr_test" }
});
assert.equal(editorResponse.status, 201);
assert.match(insertedQuery, /INSERT INTO editor_submissions/);
assert.equal(JSON.parse(insertedValues[4]).proposed, "Revised sentence.");

for (const file of ["review.html", "review.css", "review.js"]) assert.ok(existsSync(file), `Missing ${file}`);
console.log("Backend schema, token helpers, version-scoped review authorization, and portal assets verified.");
