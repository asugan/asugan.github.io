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

if (typeof document !== 'undefined') loadGitHub();
