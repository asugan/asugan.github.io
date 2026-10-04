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
  assert.match(html, /<title>Asugan — Indie Developer<\/title>/);
  assert.match(readme, /Asugan's personal portfolio/);
  assert.match(script, /Intl.DateTimeFormat\('en-US'/);
  assert.doesNotMatch(html + readme, /\b(?:Erkin|Eren)\b/);
  assert.doesNotMatch(html + script + readme, /[çÇğĞıİöÖşŞüÜ]/);
});

test('portfolio has a light sidebar, revenue cards, and no old hero or contact section', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(html, /class="sidebar"/);
  assert.match(html, /class="profile-logo"[^]*?src="assets\/avatar\.jpg"/);
  assert.ok((await readFile(new URL('../assets/avatar.jpg', import.meta.url))).length > 0);
  assert.match(css, /color-scheme: light/);
  const script = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(html + css + script, /Building in public|revenue-summary|summary-chart|summary-heading|revenue-totals|total-revenue|monthly-revenue|revenue-period|total-chart|revenue-status/);
  for (const id of ['petopia', 'shadow', 'grimoire', 'coldlog']) {
    assert.match(html, new RegExp(`data-chart="${id}"`));
    assert.match(html, new RegExp(`data-revenue="${id}"`));
  }
  assert.doesNotMatch(html, /class="hero|app-shelf|quick-facts|contact-section|id="contact"/);
});

test('GitHub links allow HTTPS GitHub only', () => {
  assert.equal(githubURL('https://github.com/asugan/petopia-legal/commit/abc'), 'https://github.com/asugan/petopia-legal/commit/abc');
  for (const url of ['javascript:alert(1)', 'https://github.com.evil.test/x', 'https://github.com@evil.test/', 'https://evil@github.com/', 'http://github.com/', null]) {
    assert.equal(githubURL(url), 'https://github.com/asugan');
  }
});

test('calendar preserves GitHub counts and color levels across year boundaries', () => {
  const days = activityDays([
    { date: '2026-01-01', count: 10, level: 1 },
    { date: '2025-12-31', count: 1, level: 4, private_repo: 'must-not-be-rendered' },
  ]);
  assert.deepEqual(days, [
    { date: '2025-12-31', count: 1, level: 4 },
    { date: '2026-01-01', count: 10, level: 1 },
  ]);
});

test('bad days, gaps, or missing calendars fail instead of inventing activity', () => {
  const day = { date: '2026-01-01', count: 1, level: 2 };
  for (const count of [-1, '7', 1.5, null]) assert.throws(() => activityDays([{ ...day, count }]), /Invalid/);
  for (const level of [-1, 5, '4']) assert.throws(() => activityDays([{ ...day, level }]), /Invalid/);
  assert.throws(() => activityDays([{ ...day, date: '2026-02-30' }]), /Invalid/);
  assert.throws(() => activityDays([day, day]), /duplicate/);
  assert.throws(() => activityDays([day, { ...day, date: '2026-01-03' }]), /Missing/);
  assert.throws(() => activityDays([]), /Missing/);
  assert.throws(() => activityDays({ '2026-01-01': 4 }), /Missing/);
});

test('annual calendar includes leap days without changing source counts', () => {
  const calendar = Array.from({ length: 371 }, (_, index) => ({
    date: new Date(Date.UTC(2023, 9, 1 + index)).toISOString().slice(0, 10), count: index % 5, level: index % 5,
  }));
  const days = activityDays(calendar);
  assert.equal(days.length, 371);
  assert.ok(days.some(day => day.date === '2024-02-29'));
  assert.deepEqual(days, calendar);
});
