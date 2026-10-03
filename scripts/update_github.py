#!/usr/bin/env python3
"""Fetch public GitHub data. Uses only Python's standard library."""
import argparse
import json
import os
import tempfile
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

USER = "asugan"
ROOT = Path(__file__).resolve().parents[1]


def api(path):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "asugan-portfolio", "X-GitHub-Api-Version": "2022-11-28"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(f"https://api.github.com/{path}", headers=headers)
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def event_counts(events, now):
    first = (now - timedelta(days=89)).date().isoformat()
    last = now.date().isoformat()
    return dict(Counter(event["created_at"][:10] for event in events if first <= event["created_at"][:10] <= last))


def collect():
    now = datetime.now(timezone.utc)
    profile = api(f"users/{USER}")
    repos = []
    for page in range(1, 11):
        batch = api(f"users/{USER}/repos?type=owner&sort=pushed&per_page=100&page={page}")
        repos.extend(batch)
        if len(batch) < 100:
            break
    events = []
    # GitHub's public events endpoint exposes at most 300 recent events, not all contributions.
    for page in range(1, 4):
        batch = api(f"users/{USER}/events/public?per_page=100&page={page}")
        events.extend(batch)
        if len(batch) < 100:
            break
    recent = [repo for repo in repos if repo["name"] not in (USER, f"{USER}.github.io") and not repo["archived"]]
    commits = []
    # ponytail: scan five recently pushed repos; expand only if wider commit coverage is needed.
    for repo in recent[:5]:
        try:
            batch = api(f"repos/{repo['full_name']}/commits?author={USER}&per_page=5")
        except HTTPError as error:
            if error.code == 409:  # Empty repository.
                continue
            raise
        for commit in batch:
            commits.append({
                "repo": repo["name"], "sha": commit["sha"], "url": commit["html_url"],
                "message": commit["commit"]["message"].splitlines()[0],
                "date": commit["commit"]["committer"]["date"],
            })
    commits.sort(key=lambda commit: commit["date"], reverse=True)
    return {
        "updated_at": now.isoformat(), "public_repos": profile["public_repos"],
        "activity": event_counts(events, now),
        "repos": [{"name": repo["name"], "url": repo["html_url"], "language": repo["language"], "stars": repo["stargazers_count"]} for repo in recent if not repo["fork"]][:3],
        "commits": commits[:6],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/github.json")
    output = parser.parse_args().output
    data = collect()  # Failure leaves the previous snapshot untouched.
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent, delete=False) as temp:
        json.dump(data, temp, ensure_ascii=False, indent=2)
        temp.write("\n")
        temp_path = Path(temp.name)
    try:
        os.replace(temp_path, output)
    finally:
        temp_path.unlink(missing_ok=True)
    print(f"Updated {output}: {len(data['commits'])} commits, {sum(data['activity'].values())} public events")


if __name__ == "__main__":
    main()
