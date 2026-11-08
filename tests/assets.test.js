import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const hash = (content) =>
  createHash('sha256').update(content).digest('hex').slice(0, 12);
test('every browser dependency has a matching content version', () => {
  const visited = new Set();
  function check(relative, base = root) {
    const url = new URL(relative, base);
    const expected = url.searchParams.get('v');
    assert.ok(expected, `Missing asset version: ${relative}`);
    url.search = '';
    const content = readFileSync(url, 'utf8');
    assert.equal(expected, hash(content), `Stale asset version: ${relative}`);
    if (visited.has(url.href)) return;
    visited.add(url.href);
    for (const match of content.matchAll(
      /from\s+['"](\.\/[^'"]+\.js\?v=[^'"]+)['"]/g,
    ))
      check(match[1], url);
  }
  const html = readFileSync(new URL('index.html', root), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="(\.\/[^" ]+\?v=[^" ]+)"/g))
    check(match[1]);
  assert.ok(
    visited.size >= 6,
    'Entry point, stylesheet, and browser modules must all be checked',
  );
});
