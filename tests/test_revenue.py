import importlib.util
import json
import os
import tempfile
import unittest
from datetime import date
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("update_revenue", Path(__file__).resolve().parents[1] / "scripts/update_revenue.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RevenueTest(unittest.TestCase):
    def setUp(self):
        self.keys = {f"REVENUECAT_{app.upper()}_SECRET_API_KEY": f"test-secret-{app}" for app in module.APP_IDS}
        self.environment = patch.dict(os.environ, self.keys, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_configuration_prevents_double_counting_shared_projects(self):
        config = {"petopia": {"project_id": "proj_pet", "start_date": "2025-01-01"}}
        self.assertEqual(module.configuration(json.dumps(config)), config)
        config["shadow"] = config["petopia"]
        with self.assertRaisesRegex(ValueError, "own RevenueCat project"):
            module.configuration(json.dumps(config))
        for raw in ['[]', '{}', '{"unknown": {}}', '{"petopia":{"project_id":"../evil","start_date":"2025-01-01"}}']:
            with self.assertRaises(ValueError):
                module.configuration(raw)

    def test_months_cross_leap_year_and_refunds_are_preserved(self):
        calls = []

        def api(project, start, end, api_key):
            self.assertEqual(api_key, self.keys["REVENUECAT_PETOPIA_SECRET_API_KEY"])
            self.assertLessEqual(start, end)
            calls.append((project, start, end))
            return -1.25

        config = {"petopia": {"project_id": "proj_pet", "start_date": "2024-02-15"}}
        with patch.object(module, "api", side_effect=api):
            data = module.collect(config, date(2024, 3, 10))
        self.assertEqual(data["months"][0], "2023-04")
        self.assertEqual(data["months"][-1], "2024-03")
        self.assertEqual(data["apps"]["petopia"]["history"], [0] * 10 + [-1.25, -1.25])
        self.assertIn(("proj_pet", date(2024, 2, 15), date(2024, 2, 29)), calls)
        self.assertEqual(calls[-1], ("proj_pet", date(2024, 2, 15), date(2024, 3, 10)))
        self.assertNotIn("project_id", json.dumps(data))

    def test_rolling_window_is_exactly_30_inclusive_days(self):
        with patch.object(module, "api", return_value=0) as api:
            module.collect({"coldlog": {"project_id": "proj_cold", "start_date": "2023-01-01"}}, date(2024, 3, 10))
        self.assertEqual(api.call_args.args, ("proj_cold", date(2024, 2, 10), date(2024, 3, 10), self.keys["REVENUECAT_COLDLOG_SECRET_API_KEY"]))

    def test_api_validates_currency_and_amount_without_publishing_credentials(self):
        response = {"currency": "USD", "revenue_type": "revenue", "value": 12.34, "start_date": "2026-01-01", "end_date": "2026-01-31"}
        with patch.object(module.time, "sleep"):
            with patch.object(module, "urlopen", return_value=BytesIO(json.dumps(response).encode())) as request:
                self.assertEqual(module.api("proj_test", date(2026, 1, 1), date(2026, 1, 31), "test-secret"), 12.34)
                self.assertNotIn("test-secret", request.call_args.args[0].full_url)
                self.assertEqual(request.call_args.args[0].get_header("Authorization"), "Bearer test-secret")
            for value in [None, "12", True, float("nan")]:
                response["value"] = value
                with patch.object(module, "urlopen", return_value=BytesIO(json.dumps(response).encode())), self.assertRaises(ValueError):
                    module.api("proj_test", date(2026, 1, 1), date(2026, 1, 31), "test-secret")
            response.update(value=12.34, currency="EUR")
            with patch.object(module, "urlopen", return_value=BytesIO(json.dumps(response).encode())), self.assertRaises(ValueError):
                module.api("proj_test", date(2026, 1, 1), date(2026, 1, 31), "test-secret")

    def test_each_project_uses_its_own_key_without_publishing_secrets(self):
        projects = {app: {"project_id": f"proj_{app}", "start_date": "2025-01-01"} for app in module.APP_IDS}
        requests = []

        def response(request, **kwargs):
            from urllib.parse import parse_qs, urlparse
            url = urlparse(request.full_url)
            app = url.path.split("/")[3].removeprefix("proj_")
            self.assertEqual(request.get_header("Authorization"), f"Bearer {self.keys[f'REVENUECAT_{app.upper()}_SECRET_API_KEY']}")
            requests.append(app)
            query = parse_qs(url.query)
            return BytesIO(json.dumps({"currency": "USD", "revenue_type": "revenue", "value": 12.34, "start_date": query["start_date"][0], "end_date": query["end_date"][0]}).encode())

        with patch.object(module, "urlopen", side_effect=response), patch.object(module.time, "sleep"):
            data = module.collect(projects, date(2026, 3, 10))
        for app in projects:
            self.assertEqual(requests.count(app), 14)
        for key in self.keys.values():
            self.assertNotIn(key, json.dumps(data))
        self.assertNotIn("proj_", json.dumps(data))

    def test_missing_key_fails_before_any_request(self):
        projects = {app: {"project_id": f"proj_{app}", "start_date": "2025-01-01"} for app in module.APP_IDS}
        with patch.dict(os.environ, {"REVENUECAT_SHADOW_SECRET_API_KEY": ""}), patch.object(module, "api") as api:
            with self.assertRaisesRegex(ValueError, "Missing REVENUECAT_SHADOW_SECRET_API_KEY"):
                module.collect(projects, date(2026, 3, 10))
        api.assert_not_called()

    def test_failed_refresh_and_missing_config_preserve_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "revenue.json"
            output.write_text('{"previous": true}')
            with patch("sys.argv", ["update_revenue.py", "--output", str(output)]), patch.dict(os.environ, {}, clear=True):
                module.main()
            env = {"REVENUECAT_PETOPIA_SECRET_API_KEY": "test-secret", "REVENUECAT_PROJECTS": '{"petopia":{"project_id":"proj_pet","start_date":"2025-01-01"}}'}
            with patch("sys.argv", ["update_revenue.py", "--output", str(output)]), patch.dict(os.environ, env), patch.object(module, "collect", side_effect=ValueError("Unavailable")):
                with self.assertRaises(ValueError):
                    module.main()
            self.assertEqual(output.read_text(), '{"previous": true}')


if __name__ == "__main__":
    unittest.main()
