#!/usr/bin/env python3
"""Fetch GitHub's public contribution calendar and public commits using the standard library."""
import argparse
import json
import os
import re
import tempfile
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
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


class ContributionCalendar(HTMLParser):
    """Keep only anonymous day counts and GitHub's exact color levels."""
    def __init__(self):
        super().__init__()
        self.days = {}
        self.counts = {}
        self.target = None
        self.text = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "td" and "data-date" in attrs:
            day = date.fromisoformat(attrs["data-date"]).isoformat()
            level = int(attrs["data-level"])
            if not 0 <= level <= 4 or attrs["id"] in self.days:
                raise ValueError("Invalid GitHub contribution cell")
            self.days[attrs["id"]] = {"date": day, "level": level}
        if tag == "tool-tip":
            self.target = attrs.get("for")
            self.text = []

    def handle_data(self, text):
        if self.target:
            self.text.append(text)

    def handle_endtag(self, tag):
        if tag == "tool-tip" and self.target:
            match = re.match(r"(No|[\d,]+) contributions? on\b", "".join(self.text).strip())
            if match:
                self.counts[self.target] = 0 if match[1] == "No" else int(match[1].replace(",", ""))
            self.target = None

    def result(self):
        if not self.days or self.days.keys() - self.counts.keys():
            raise ValueError("GitHub contribution calendar is missing day counts")
        days = sorted(({**day, "count": self.counts[key]} for key, day in self.days.items()), key=lambda day: day["date"])
        for previous, current in zip(days, days[1:]):
            if date.fromisoformat(current["date"]) - date.fromisoformat(previous["date"]) != timedelta(days=1):
                raise ValueError("GitHub contribution calendar has missing or duplicate dates")
        return days


def contribution_calendar():
    # No auth: use exactly the anonymized contributions visible on the public profile.
    # ponytail: GitHub HTML is the source; use GraphQL if its calendar markup changes.
    request = Request(f"https://github.com/users/{USER}/contributions", headers={"User-Agent": "asugan-portfolio", "Accept-Language": "en-US"})
    with urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8")
    parser = ContributionCalendar()
    parser.feed(html)
    days = parser.result()
    if not 365 <= len(days) <= 372:
        raise ValueError("GitHub did not return a full annual contribution calendar")
    return days


def collect():
    now = datetime.now(timezone.utc)
    profile = api(f"users/{USER}")
    repos = []
    for page in range(1, 11):
        batch = api(f"users/{USER}/repos?type=owner&sort=pushed&per_page=100&page={page}")
        repos.extend(batch)
        if len(batch) < 100:
            break
    calendar = contribution_calendar()
    recent = [repo for repo in repos if not repo.get("private", False) and repo["name"] not in (USER, f"{USER}.github.io") and not repo["archived"]]
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
        "activity": calendar,
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
    print(f"Updated {output}: {len(data['commits'])} public commits, {sum(day['count'] for day in data['activity'])} contributions")


if __name__ == "__main__":
    main()
