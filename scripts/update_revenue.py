#!/usr/bin/env python3
"""Publish RevenueCat gross revenue only; credentials and customer data never enter the site."""
import argparse
import json
import math
import os
import re
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
APP_IDS = {"petopia", "shadow", "grimoire", "coldlog"}
_last_request = 0


def configuration(raw):
    projects = json.loads(raw)
    if not isinstance(projects, dict) or not projects or projects.keys() - APP_IDS:
        raise ValueError("REVENUECAT_PROJECTS must map featured app IDs to project_id and start_date")
    seen = set()
    for app in projects.values():
        if not isinstance(app, dict) or not isinstance(app.get("project_id"), str) or not re.fullmatch(r"[A-Za-z0-9_]+", app["project_id"]):
            raise ValueError("Invalid RevenueCat project ID")
        if app["project_id"] in seen:
            raise ValueError("Each app must have its own RevenueCat project; shared projects require app-filtered charts")
        seen.add(app["project_id"])
        if not isinstance(app.get("start_date"), str) or date.fromisoformat(app["start_date"]).isoformat() != app["start_date"] or date.fromisoformat(app["start_date"]) > datetime.now(timezone.utc).date():
            raise ValueError("Invalid revenue tracking start_date")
    return projects


def api(project_id, start, end, api_key):
    global _last_request
    # Charts & Metrics allows 25 requests/minute. No SDK or background service needed.
    time.sleep(max(0, 2.5 - (time.monotonic() - _last_request)))
    _last_request = time.monotonic()
    query = urlencode({"start_date": start.isoformat(), "end_date": end.isoformat(), "currency": "USD", "revenue_type": "revenue"})
    request = Request(f"https://api.revenuecat.com/v2/projects/{project_id}/metrics/revenue?{query}", headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json", "User-Agent": "asugan-portfolio"})
    try:
        with urlopen(request, timeout=60) as response:
            data = json.load(response)
    except HTTPError as error:
        # Do not print response bodies: keep credentials and customer details out of logs.
        raise RuntimeError(f"RevenueCat returned HTTP {error.code}; previous snapshot was not replaced") from None
    value = data.get("value")
    if data.get("currency") != "USD" or data.get("revenue_type") != "revenue" or data.get("start_date") != start.isoformat() or data.get("end_date") != end.isoformat() or isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Invalid RevenueCat revenue metric; previous snapshot was not replaced")
    return round(value, 2)


def month_start(today, offset):
    index = today.year * 12 + today.month - 1 + offset
    return date(index // 12, index % 12 + 1, 1)


def collect(projects, today=None):
    keys = {}
    for app_id in projects:
        name = f"REVENUECAT_{app_id.upper()}_SECRET_API_KEY"
        key = os.environ.get(name, "").strip()
        if not key:
            raise ValueError(f"Missing {name}; previous snapshot was not replaced")
        keys[app_id] = key
    today = today or datetime.now(timezone.utc).date()
    months = [month_start(today, offset) for offset in range(-11, 1)]
    apps = {}
    for app_id, config in projects.items():
        start = date.fromisoformat(config["start_date"])
        project = config["project_id"]
        history = []
        for month in months:
            end = min(month_start(month, 1) - timedelta(days=1), today)
            history.append(api(project, max(start, month), end, keys[app_id]) if end >= start else 0)
        apps[app_id] = {
            "start_date": start.isoformat(),
            "total": api(project, start, today, keys[app_id]),
            "last_30_days": api(project, max(start, today - timedelta(days=29)), today, keys[app_id]),
            "history": history,
        }
    return {"updated_at": datetime.now(timezone.utc).isoformat(), "currency": "USD", "months": [month.strftime("%Y-%m") for month in months], "apps": apps}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/revenue.json")
    output = parser.parse_args().output
    raw = os.environ.get("REVENUECAT_PROJECTS")
    has_keys = any(os.environ.get(f"REVENUECAT_{app.upper()}_SECRET_API_KEY") for app in APP_IDS)
    if not raw and not has_keys:
        print("RevenueCat not configured; existing snapshot left untouched.")
        return
    if not raw:
        raise ValueError("Set REVENUECAT_PROJECTS for the configured app keys")
    data = collect(configuration(raw))  # Any failed request leaves the previous snapshot intact.
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent, delete=False) as temp:
        json.dump(data, temp, ensure_ascii=False, indent=2, allow_nan=False)
        temp.write("\n")
        temp_path = Path(temp.name)
    try:
        os.replace(temp_path, output)
    finally:
        temp_path.unlink(missing_ok=True)
    print(f"Updated revenue snapshot for {len(data['apps'])} apps")


if __name__ == "__main__":
    main()
