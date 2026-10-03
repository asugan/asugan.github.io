import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { activityDays, githubURL } from '../app.mjs';

test('site and README use Asugan with English copy and date locale', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(html, /<html lang="en">/);
  assert.match(html, /I'm <strong>Asugan<\/strong>\./);
  assert.match(html, /<title>Asugan — Independent Developer<\/title>/);
  assert.match(readme, /Asugan's personal portfolio/);
  assert.match(script, /Intl.DateTimeFormat\('en-US'/);
  assert.doesNotMatch(html + readme, /\b(?:Erkin|Eren)\b/);
  assert.doesNotMatch(html + script + readme, /[çÇğĞıİöÖşŞüÜ]/);
});

test('GitHub links allow HTTPS GitHub only', () => {
  assert.equal(githubURL('https://github.com/asugan/petopia-legal/commit/abc'), 'https://github.com/asugan/petopia-legal/commit/abc');
  for (const url of ['javascript:alert(1)', 'https://github.com.evil.test/x', 'https://github.com@evil.test/', 'https://evil@github.com/', 'http://github.com/', null]) {
    assert.equal(githubURL(url), 'https://github.com/asugan');
  }
});

test('calendar aligns Monday, ends at snapshot UTC day, and handles year boundaries', () => {
  const days = activityDays({ '2025-12-31': 2, '2026-01-01': 10 }, '2026-01-01T23:50:00Z');
  assert.equal(new Date(`${days[0].date}T00:00:00Z`).getUTCDay(), 1);
  assert.ok(days.length >= 90 && days.length <= 96);
  assert.deepEqual(days.at(-1), { date: '2026-01-01', count: 10, level: 4 });
  assert.deepEqual(days.at(-2), { date: '2025-12-31', count: 2, level: 1 });
  assert.equal(days.find(day => day.date === '2025-12-30').count, 0);
});

test('bad counts never become invented activity; invalid timestamp fails', () => {
  for (const count of [-1, '7', 1.5, null]) {
    assert.equal(activityDays({ '2026-01-01': count }, '2026-01-01').at(-1).count, 0);
  }
  assert.throws(() => activityDays({}, 'not-a-date'), /Invalid update timestamp/);
});
