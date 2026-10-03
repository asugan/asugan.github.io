# asugan.github.io

Asugan's personal portfolio. Built with plain HTML, CSS, and JavaScript; no package installation or build step required.

## Run locally

```sh
cd /home/asugan/Projects/asugan.github.io
python3 -m http.server 8000
```

Open http://localhost:8000 in your browser.

## GitHub Pages

1. Upload the files to the `main` branch of **asugan/asugan.github.io**.
2. Select **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Once **Actions → Publish portfolio** completes, the site is available at https://asugan.github.io. Use **Run workflow** to trigger deployment manually if needed.

The workflow refreshes GitHub data and redeploys the site daily at 06:23 UTC. Scheduled runs may be delayed, and GitHub may disable them after 60 days of inactivity in a public repository. The token is used only within Actions and is never included in the site. If the data refresh fails, the existing deployment remains unchanged. The workflow does not create automated commits in the repository.

## Edit the content

- Apps, introduction, and links: `index.html`
- Design and responsive layout: `styles.css`
- Real App Store icons and screenshots: `assets/`
- GitHub display: `app.mjs`
- GitHub data collection: `scripts/update_github.py`

Featured App Store apps: Petopia, Shadow Work, Grimoire, and ColdLog. Images were downloaded from the developer's public App Store listings. When adding an app, update the cards and app count in `index.html`.

The activity graph mirrors GitHub's **public annual contribution calendar**, including GitHub's own daily counts and color levels. To include anonymous private contributions, enable **Contribution settings → Private contributions** on your GitHub profile. No private-access token is needed: the updater reads the calendar visible to unauthenticated visitors and saves only dates, counts, and color levels. Private repository names, commit messages, and URLs are never collected for the calendar.

The right-hand list remains **public commits only**. It scans commits associated with the account in the five most recently active public repositories, excluding the profile and this site's repositories, and displays the six newest commits. The project list displays the three most recently updated non-fork public repositories.

The calendar is parsed from GitHub's HTML using Python's standard library. If GitHub changes its markup or returns an incomplete calendar, the refresh fails instead of inventing counts or publishing a blank graph; the existing deployment remains unchanged.

Refresh local data (unauthenticated public API rate limits apply without a token):

```sh
python3 scripts/update_github.py
```

Run checks:

```sh
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Fonts are loaded from Google Fonts, with system fonts as a fallback. The browser reads GitHub data from a local JSON file without contacting a third-party API.
# asugan.github.io
