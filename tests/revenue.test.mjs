import test from 'node:test';
import assert from 'node:assert/strict';
import { revenueData, chartPoints } from '../app.mjs';

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

test('charts fill summary, app-card, and mobile viewport widths without distorting values', () => {
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
