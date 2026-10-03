import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("update_github", Path(__file__).resolve().parents[1] / "scripts/update_github.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

CALENDAR = '''
<td id="new" data-date="2026-01-01" data-level="0"></td>
<td data-level="4" data-date="2025-12-31" id="old"></td>
<tool-tip for="old">1 contribution on December 31st.</tool-tip>
<tool-tip for="new">No contributions on January 1st.</tool-tip>
<a href="/private-repo">private commit details must not be copied</a>
'''


def parse(html):
    parser = module.ContributionCalendar()
    parser.feed(html)
    return parser.result()


class ContributionTest(unittest.TestCase):
    def test_only_anonymous_counts_dates_and_exact_github_levels(self):
        days = parse(CALENDAR)
        self.assertEqual(days, [
            {"date": "2025-12-31", "level": 4, "count": 1},
            {"date": "2026-01-01", "level": 0, "count": 0},
        ])
        self.assertNotIn("private", json.dumps(days))

    def test_large_counts_and_leap_year_boundary(self):
        html = CALENDAR.replace("2025-12-31", "2024-02-29").replace("2026-01-01", "2024-03-01")
        html = html.replace("1 contribution on", "1,234 contributions on")
        self.assertEqual(parse(html)[0]["count"], 1234)

    def test_changed_or_incomplete_html_fails(self):
        for html in ["<html>Markup changed</html>", CALENDAR.replace('for="old"', 'for="unknown"'), CALENDAR.replace("2026-01-01", "2026-01-02"), CALENDAR.replace('data-level="4"', 'data-level="5"')]:
            with self.subTest(html=html), self.assertRaises(ValueError):
                parse(html)

    def test_private_repositories_never_enter_commit_list(self):
        repos = [
            {"private": True, "name": "secret-project", "full_name": "asugan/secret-project"},
            {"private": False, "name": "public-project", "full_name": "asugan/public-project", "archived": False, "fork": False, "language": "Python", "stargazers_count": 0, "html_url": "https://github.com/asugan/public-project"},
        ]

        def api(path):
            if path == "users/asugan":
                return {"public_repos": 1}
            if path.startswith("users/asugan/repos?"):
                return repos
            self.assertTrue(path.startswith("repos/asugan/public-project/commits?"))
            return [{"sha": "abc", "html_url": "https://github.com/asugan/public-project/commit/abc", "commit": {"message": "Public commit", "committer": {"date": "2026-01-01T12:00:00Z"}}}]

        with patch.object(module, "api", side_effect=api), patch.object(module, "contribution_calendar", return_value=parse(CALENDAR)):
            data = module.collect()
        self.assertEqual(data["commits"][0]["repo"], "public-project")
        self.assertNotIn("secret-project", json.dumps(data))

    def test_failed_refresh_preserves_previous_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "github.json"
            output.write_text('{"previous": true}')
            with patch("sys.argv", ["update_github.py", "--output", str(output)]), patch.object(module, "collect", side_effect=ValueError("Calendar unavailable")):
                with self.assertRaises(ValueError):
                    module.main()
            self.assertEqual(output.read_text(), '{"previous": true}')


if __name__ == "__main__":
    unittest.main()
