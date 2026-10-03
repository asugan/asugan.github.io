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

The GitHub activity display is **not a contribution calendar**: it counts up to 300 public events returned by the API within the last 90 days. Private repositories are excluded. The commit list scans commits associated with the account in the five most recently active public repositories, excluding the profile and this site's repositories, and displays the six newest commits. The project list displays the three most recently updated non-fork repositories.

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
