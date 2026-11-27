import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { newId, newSecret, hashSecret, bearer, authorizeShare } from "../functions/api/_shared.js";

globalThis.crypto = webcrypto;

const schema = readFileSync("migrations/0001_manuscript_workspace.sql", "utf8");
const shares = readFileSync("functions/api/projects/[id]/shares.js", "utf8");
const reviews = readFileSync("functions/api/reviews/[shareId].js", "utf8");
const projectApi = readFileSync("functions/api/projects/[id].js", "utf8");
const createApi = readFileSync("functions/api/projects/index.js", "utf8");

for (const table of ["projects", "project_versions", "project_shares", "review_decisions"]) {
  assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`), `Missing ${table} table`);
}
assert.match(schema, /version_id TEXT NOT NULL REFERENCES project_versions/);
assert.match(shares, /INSERT INTO project_shares \\(id, project_id, version_id, token_hash/);
assert.doesNotMatch(shares, /"undefined"/);
assert.match(projectApi, /await env\\.DB\\.batch\\(/);
assert.match(createApi, /await env\\.DB\\.batch\\(/);
assert.match(reviews, /const versionId = share\\.version_id/);
assert.match(reviews, /share\\.role !== "author_review"/);

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
assert.match(querySeen, /s\\.version_id/);

for (const file of ["review.html", "review.css", "review.js"]) assert.ok(existsSync(file), `Missing ${file}`);
console.log("Backend schema, token helpers, version-scoped review authorization, and portal assets verified.");
