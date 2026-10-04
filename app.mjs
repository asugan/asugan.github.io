const profileURL = 'https://github.com/asugan';
const dateFormat = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function githubURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password ? url.href : profileURL;
  } catch {
    return profileURL;
  }
}

export function activityDays(calendar) {
  if (!Array.isArray(calendar) || !calendar.length) throw new Error('Missing contribution calendar');
  const days = calendar.map(day => {
    const timestamp = Date.parse(`${day.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== day.date || !Number.isInteger(day.count) || day.count < 0 || !Number.isInteger(day.level) || day.level < 0 || day.level > 4) {
      throw new Error('Invalid contribution day');
    }
    return { date: day.date, count: day.count, level: day.level };
  }).sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < days.length; i++) {
    if (Date.parse(days[i].date) - Date.parse(days[i - 1].date) !== 86400000) throw new Error('Missing or duplicate contribution date');
  }
  return days;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(className, text, url) {
  const node = element('a', className, text);
  node.href = githubURL(url);
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  return node;
}

async function loadGitHub() {
  const status = document.querySelector('#activity-status');
  try {
    const response = await fetch('data/github.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Number.isInteger(data.public_repos) || !Array.isArray(data.repos) || !Array.isArray(data.commits) || !Array.isArray(data.activity)) {
      throw new Error('Invalid GitHub data');
    }
    const days = activityDays(data.activity);
    document.querySelector('#repo-count').textContent = String(data.public_repos).padStart(2, '0');
    const total = days.reduce((sum, day) => sum + day.count, 0);
    status.textContent = `${total.toLocaleString('en-US')} contributions in the last year`;
    const heatmap = document.querySelector('#heatmap');
    const months = document.querySelector('#heatmap-months');
    months.style.gridTemplateColumns = `repeat(${Math.ceil(days.length / 7)}, 1fr)`;
    for (const [index, day] of days.entries()) {
      const date = new Date(`${day.date}T00:00:00Z`);
      const cell = element('span', `heatmap-cell level-${day.level}`);
      cell.title = `${dateFormat.format(date)}: ${day.count} contributions`;
      heatmap.append(cell);
      if (index % 7 === 0 && date.getUTCDate() <= 7) {
        const month = element('span', '', date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }));
        month.style.gridColumn = String(Math.floor(index / 7) + 1);
        months.append(month);
      }
    }
    const scroll = document.querySelector('.heatmap-scroll');
    scroll.scrollLeft = scroll.scrollWidth - scroll.clientWidth;
    const repos = document.querySelector('#repos');
    for (const repo of data.repos) {
      const row = link('repo-link', undefined, repo.url);
      row.append(element('span', '', repo.name), element('span', 'repo-meta', `${repo.language || 'Code'} · ☆ ${repo.stars}`));
      repos.append(row);
    }
    if (!data.repos.length) repos.append(element('p', 'muted', 'No public projects found.'));
    const commits = document.querySelector('#commits');
    commits.replaceChildren();
    for (const commit of data.commits) {
      const item = element('li', '');
      const meta = element('div', 'commit-meta');
      const time = element('time', '', dateFormat.format(new Date(commit.date)));
      time.dateTime = commit.date;
      meta.append(element('span', '', `${commit.repo} · ${commit.sha.slice(0, 7)}`), time);
      item.append(link('commit-link', commit.message, commit.url), meta);
      commits.append(item);
    }
    if (!data.commits.length) commits.append(element('li', 'muted', 'No commits found in recently active repositories.'));
    document.querySelector('#updated').textContent = `Last updated: ${dateFormat.format(new Date(data.updated_at))} · Refreshed daily with GitHub Actions`;
  } catch (error) {
    status.textContent = 'GitHub data could not be loaded. Visit my profile to see recent activity.';
    document.querySelector('#commits').replaceChildren(element('li', 'muted', 'Commit data could not be loaded. Visit my GitHub profile.'));
    console.error('Could not load GitHub data:', error);
  }
}

const appIDs = ['petopia', 'shadow', 'grimoire', 'coldlog'];
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function revenueData(data) {
  if (data.currency !== 'USD' || !data.apps || typeof data.apps !== 'object' || Array.isArray(data.apps)) throw new Error('Invalid revenue data');
  const ids = Object.keys(data.apps);
  if (!ids.length) return null;
  if (!Number.isFinite(Date.parse(data.updated_at)) || !Array.isArray(data.months) || data.months.length !== 12) throw new Error('Missing revenue history');
  for (const [index, month] of data.months.entries()) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid revenue month');
    if (index && Date.parse(`${month}-01`) !== Date.UTC(Number(data.months[index - 1].slice(0, 4)), Number(data.months[index - 1].slice(5, 7)), 1)) throw new Error('Missing or duplicate revenue month');
  }
  for (const id of ids) {
    const app = data.apps[id];
    if (!appIDs.includes(id) || !app || !Number.isFinite(app.total) || !Number.isFinite(app.last_30_days) || !Array.isArray(app.history) || app.history.length !== 12 || !app.history.every(Number.isFinite) || !/^\d{4}-\d{2}-\d{2}$/.test(app.start_date) || !Number.isFinite(Date.parse(app.start_date)) || new Date(app.start_date).toISOString().slice(0, 10) !== app.start_date) throw new Error('Invalid app revenue');
  }
  return data;
}

export function chartPoints(values, width = 400, height = 114) {
  if (!Array.isArray(values) || values.length < 2 || !values.every(Number.isFinite)) throw new Error('Invalid chart values');
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const range = high - low || 1;
  const right = width - 10;
  const bottom = height - 24;
  return { low, high, right, bottom, zero: bottom - (0 - low) / range * (bottom - 12), points: values.map((value, index) => [40 + index / (values.length - 1) * (right - 40), bottom - (value - low) / range * (bottom - 12)]) };
}

function svgNode(tag, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderChart(container, values, months, id) {
  const draw = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 50 || height <= 36) return;
    const { low, high, right, bottom, zero, points } = chartPoints(values, width, height);
    const chart = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Monthly gross revenue in USD; current month is partial' });
    chart.append(svgNode('title', {}, months.map((month, index) => `${month}: ${money.format(values[index])}`).join(', ')));
    const defs = svgNode('defs', {});
    const gradient = svgNode('linearGradient', { id: `fill-${id}`, x1: '0', y1: '0', x2: '0', y2: '1' });
    gradient.append(svgNode('stop', { offset: '0%', 'stop-color': '#e7ac36', 'stop-opacity': '.35' }), svgNode('stop', { offset: '100%', 'stop-color': '#e7ac36', 'stop-opacity': '.03' }));
    defs.append(gradient);
    chart.append(defs);
    for (const y of [12, (12 + bottom) / 2, bottom]) chart.append(svgNode('line', { x1: 40, x2: right, y1: y, y2: y, class: 'chart-grid' }));
    const labelStep = width >= 380 ? 1 : 2;
    for (const [index, month] of months.entries()) {
      const x = points[index][0];
      chart.append(svgNode('line', { x1: x, x2: x, y1: 12, y2: bottom, class: 'chart-grid' }));
      if (index % labelStep === 0 || index === months.length - 1) chart.append(svgNode('text', { x, y: height - 5, 'text-anchor': 'middle', class: 'chart-label' }, new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })));
    }
    const path = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    chart.append(svgNode('path', { d: `${path} L${right},${zero} L40,${zero} Z`, fill: `url(#fill-${id})` }), svgNode('path', { d: path, class: 'chart-line' }));
    const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
    chart.append(svgNode('text', { x: 35, y: 16, 'text-anchor': 'end', class: 'chart-label' }, compactMoney.format(high)), svgNode('text', { x: 35, y: bottom + 3, 'text-anchor': 'end', class: 'chart-label' }, compactMoney.format(low)));
    container.replaceChildren(chart);
  };
  draw();
  new ResizeObserver(draw).observe(container);
}

async function loadRevenue() {
  try {
    const response = await fetch('data/revenue.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = revenueData(await response.json());
    if (!data) return;
    for (const [id, app] of Object.entries(data.apps)) {
      document.querySelector(`[data-revenue="${id}"] > span:last-child`).textContent = `${money.format(app.last_30_days)} / 30d`;
      renderChart(document.querySelector(`[data-chart="${id}"]`), app.history, data.months, id);
    }
  } catch (error) {
    document.querySelectorAll('[data-chart]').forEach(chart => {
      chart.replaceChildren(element('p', 'chart-empty', 'Revenue data could not be loaded. No estimated revenue shown.'));
    });
    console.error('Could not load revenue data:', error);
  }
}

if (typeof document !== 'undefined') {
  loadGitHub();
  loadRevenue();
}
