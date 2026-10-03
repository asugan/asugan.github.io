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

export function activityDays(counts, timestamp) {
  const end = new Date(timestamp);
  if (Number.isNaN(end.getTime())) throw new Error('Invalid update timestamp');
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 89);
  // Monday-aligned weeks; leading cells sit outside the 90-day window.
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const days = [];
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10);
    const count = Number.isInteger(counts[key]) && counts[key] > 0 ? counts[key] : 0;
    days.push({ date: key, count, level: count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4 });
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
    if (!Number.isInteger(data.public_repos) || !Array.isArray(data.repos) || !Array.isArray(data.commits) || !data.activity || typeof data.activity !== 'object') {
      throw new Error('Invalid GitHub data');
    }
    const days = activityDays(data.activity, data.updated_at);
    document.querySelector('#repo-count').textContent = String(data.public_repos).padStart(2, '0');
    const total = days.reduce((sum, day) => sum + day.count, 0);
    status.textContent = `${total} public events · API records from the last 90 days`;
    const heatmap = document.querySelector('#heatmap');
    for (const day of days) {
      const cell = element('span', `heatmap-cell level-${day.level}`);
      cell.title = `${dateFormat.format(new Date(`${day.date}T00:00:00Z`))}: ${day.count} public events`;
      heatmap.append(cell);
    }
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
