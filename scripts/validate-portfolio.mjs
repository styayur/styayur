import fs from 'node:fs';
import assert from 'node:assert/strict';
const data = JSON.parse(fs.readFileSync(new URL('../portfolio/maturity.json', import.meta.url)));
assert.equal(data.schemaVersion, 1);
assert.ok(Array.isArray(data.projects) && data.projects.length >= 6);
const seen = new Set();
for (const p of data.projects) {
  assert.match(p.repository, /^styayur\/[A-Za-z0-9_.-]+$/);
  assert.ok(!seen.has(p.repository)); seen.add(p.repository);
  assert.ok(['Experimental', 'Alpha', 'Beta', 'Stable'].includes(p.maturity));
  assert.match(p.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(p.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(p.reviewedAt).toISOString().slice(0, 10), p.reviewedAt);
  for (const key of ['evidence', 'knownLimitations', 'unmetConditions', 'nextGradeRequirements']) {
    assert.ok(Array.isArray(p[key]) && p[key].length > 0);
    assert.ok(p[key].every(s => typeof s === 'string' && s.trim()));
  }
  for (const link of p.evidence) assert.equal(new URL(link).protocol, 'https:');
}
console.log(`Validated ${seen.size} evidence-based maturity records.`);
