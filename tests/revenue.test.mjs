import test from 'node:test';
import assert from 'node:assert/strict';
import { revenueData, chartPoints } from '../app.mjs';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const snapshot = () => ({
  updated_at: '2026-10-04T12:00:00Z', currency: 'USD',
  months: ['2025-11', '2025-12', ...Array.from({ length: 10 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`)],
  apps: { petopia: { start_date: '2025-01-01', total: 124, last_30_days: -2, history: Array(12).fill(0) } },
});

test('empty revenue stays unknown, real zero and refund values remain valid', () => {
  assert.equal(revenueData({ currency: 'USD', apps: {}, updated_at: null }), null);
  const data = snapshot();
  assert.equal(revenueData(data), data);
  assert.equal(data.apps.petopia.history[0], 0);
  assert.equal(data.apps.petopia.last_30_days, -2);
});

test('invalid currency, amount, dates, or incomplete history never render as revenue', () => {
  for (const value of ['10', null, NaN, Infinity]) {
    const data = snapshot();
    data.apps.petopia.total = value;
    assert.throws(() => revenueData(data), /Invalid/);
  }
  const data = snapshot();
  data.months[1] = data.months[0];
  assert.throws(() => revenueData(data), /duplicate/);
  assert.throws(() => revenueData({ ...snapshot(), currency: 'EUR' }), /Invalid/);
  assert.throws(() => revenueData({ ...snapshot(), updated_at: null }), /Missing/);
  const badDate = snapshot();
  badDate.apps.petopia.start_date = '2026-02-30';
  assert.throws(() => revenueData(badDate), /Invalid/);
  data.apps.petopia.history.pop();
  data.months = snapshot().months;
  assert.throws(() => revenueData(data), /Invalid/);
});

test('app cards load revenue and show fetch errors without a summary section', async () => {
  const script = (await readFile(new URL('../app.mjs', import.meta.url), 'utf8')).replace(/^export /gm, '');
  for (const connected of [1, 4, 'error']) {
    const ids = ['petopia', 'shadow', 'grimoire', 'coldlog'];
    const nodes = new Map([['#activity-status', {}]]);
    for (const id of ids) {
      nodes.set(`[data-revenue="${id}"] > span:last-child`, {});
      nodes.set(`[data-chart="${id}"]`, { clientWidth: 0, replaceChildren(node) { this.child = node; } });
    }
    const data = snapshot();
    data.apps = Object.fromEntries(ids.slice(0, connected === 'error' ? 0 : connected).map(id => [id, snapshot().apps.petopia]));
    const errors = [];
    runInNewContext(script, {
      document: {
        querySelector(selector) { assert.ok(nodes.has(selector), `Unexpected selector: ${selector}`); return nodes.get(selector); },
        querySelectorAll() { return ids.map(id => nodes.get(`[data-chart="${id}"]`)); },
        createElement() { return {}; },
      },
      fetch: url => url === 'data/github.json' ? new Promise(() => {}) : Promise.resolve({ ok: connected !== 'error', status: 503, json: async () => data }),
      ResizeObserver: class { observe() {} },
      console: { error: (...args) => errors.push(args) },
    });
    await new Promise(resolve => setImmediate(resolve));
    if (connected === 'error') {
      assert.equal(errors.length, 1);
      for (const id of ids) assert.match(nodes.get(`[data-chart="${id}"]`).child.textContent, /Revenue data could not be loaded/);
    } else {
      assert.equal(errors.length, 0);
      for (const id of ids.slice(0, connected)) assert.equal(nodes.get(`[data-revenue="${id}"] > span:last-child`).textContent, '-$2.00 / 30d');
    }
  }
});

test('charts fill wide, app-card, and mobile viewport widths without distorting values', () => {
  for (const [width, height] of [[1100, 140], [480, 114], [260, 125]]) {
    const chart = chartPoints([-10, 0, 20], width, height);
    assert.equal(chart.points[0][0], 40);
    assert.equal(chart.points.at(-1)[0], width - 10);
    assert.equal(chart.points[0][1], height - 24);
    assert.equal(chart.points.at(-1)[1], 12);
    assert.equal(chart.points[1][1], chart.zero);
    assert.equal(chart.points[1][0], (40 + width - 10) / 2);
  }
});

test('native chart handles zeros, negative refunds, and positive revenue without NaN', () => {
  for (const values of [Array(12).fill(0), [-10, 0, 20], [-30, -20, -10]]) {
    const chart = chartPoints(values);
    assert.ok(Number.isFinite(chart.zero));
    assert.ok(chart.zero >= 12 && chart.zero <= 90);
    assert.equal(chart.points[0][0], 40);
    assert.equal(chart.points.at(-1)[0], 390);
    for (const [x, y] of chart.points) assert.ok(Number.isFinite(x) && y >= 12 && y <= 90);
  }
  assert.throws(() => chartPoints([0, Infinity]), /Invalid/);
});
