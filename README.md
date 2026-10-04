# asugan.github.io

Asugan's personal portfolio. Plain HTML, CSS, and JavaScript; no dependencies or build step. A light, Marc Lou-inspired layout: profile and GitHub activity on the left, apps and revenue on the right.

## Run locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Edit content in `index.html`, layout in `styles.css`, and data rendering in `app.mjs`. App Store icons and the GitHub avatar live in `assets/`.

## GitHub Pages

Select **Settings → Pages → Build and deployment → Source → GitHub Actions**. `.github/workflows/pages.yml` deploys on pushes to `main`, manual runs, and daily at 06:23 UTC. Only `index.html`, `styles.css`, `app.mjs`, `.nojekyll`, `assets/`, and `data/` are published; backups, scripts, tests, and credentials are not.

The workflow does not commit generated data. A failed configured refresh prevents deployment, leaving the live site unchanged. Scheduled runs may be delayed or disabled by GitHub after 60 days of inactivity.

## RevenueCat setup

No credentials or revenue were supplied. Empty charts and dashes are intentional: unknown revenue is not zero, and no fake data is displayed.

The collector uses RevenueCat API v2's documented `/projects/{project_id}/metrics/revenue` endpoint. It requests monthly totals for the last 12 calendar months, revenue for the last 30 inclusive days, and total revenue since each app's configured tracking start date. Amounts are **gross revenue in USD**, not proceeds or MRR. Refunds can produce negative values. The current month/day can be partial. Only RevenueCat-tracked purchases are covered.

**Current collector requires one separate RevenueCat project per featured app.** Ensure each project contains only that app's revenue (its iOS/Android variants may share the project). The metric endpoint totals every app in a project; never map a shared project to separate cards. Duplicate projects are rejected to prevent double counting. If multiple featured apps share a project, app-filtered Charts API support must be connected and verified against that project's actual response before enabling collection.

1. Create a **separate secret API v2 key in each RevenueCat project**, with `charts_metrics:overview:read` permission. Keys are project-scoped.
2. Add each key to **GitHub → Settings → Secrets and variables → Actions → Secrets** using its matching name:

   | App | GitHub Secret |
   | --- | --- |
   | Petopia | `REVENUECAT_PETOPIA_SECRET_API_KEY` |
   | Shadow Work / Shadow Prompts | `REVENUECAT_SHADOW_SECRET_API_KEY` |
   | Grimoire | `REVENUECAT_GRIMOIRE_SECRET_API_KEY` |
   | ColdLog | `REVENUECAT_COLDLOG_SECRET_API_KEY` |

   Do not put keys in HTML, JavaScript, JSON, commits, screenshots, or chat. The old single `REVENUECAT_SECRET_API_KEY` is no longer used.
3. Add an Actions **variable**, `REVENUECAT_PROJECTS`, containing only the project mappings and earliest tracking dates, not keys. Replace all example IDs/dates:

```json
{
  "petopia": { "project_id": "proj_REPLACE_PETOPIA", "start_date": "2025-01-01" },
  "shadow": { "project_id": "proj_REPLACE_SHADOW", "start_date": "2025-01-01" },
  "grimoire": { "project_id": "proj_REPLACE_GRIMOIRE", "start_date": "2025-01-01" },
  "coldlog": { "project_id": "proj_REPLACE_COLDLOG", "start_date": "2025-01-01" }
}
```

Use dates at or before the first RevenueCat-tracked sale to cover all tracked revenue. Individual cards can be connected first; combined totals are withheld until all four apps are connected.

4. Run **Actions → Publish portfolio → Run workflow**.

Requests are paced below RevenueCat's 25/minute limit; a full four-app refresh takes roughly 2–3 minutes. No mappings and no app keys skips the refresh. Every mapped app must have its own key; all required keys are checked before any API request. Missing mappings/keys or bad responses fail without replacing the snapshot. `data/revenue.json` contains only dates and aggregate amounts, never the key, project IDs, transactions, or customer data. Published aggregates are public by design.

For local refresh, securely set `REVENUECAT_PROJECTS` and the matching per-app key environment variables listed above, then run:

```sh
python3 scripts/update_revenue.py
```

Reference: https://www.revenuecat.com/docs/api-v2/charts-and-metrics

## GitHub activity

`scripts/update_github.py` reads GitHub's public annual contribution calendar, preserving daily counts and color levels. Enable **Contribution settings → Private contributions** on GitHub to include anonymous private activity. Private repository details are never collected. The browser fetches only the local snapshot.

The commit list scans the five most recently active public repositories (excluding profile/site repos) and displays six commits. The project list shows three recently updated non-fork repositories. Calendar markup changes or incomplete responses fail instead of inventing activity.

```sh
python3 scripts/update_github.py
```

## Checks

```sh
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Tests use mock revenue, never production credentials. Rubik loads from Google Fonts with a system fallback. The original design is preserved under `yedekler/2026-10-04_16-55-05/`.
