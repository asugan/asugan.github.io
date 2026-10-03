import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location("update_github", Path(__file__).resolve().parents[1] / "scripts/update_github.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ActivityTest(unittest.TestCase):
    def test_exact_90_day_window_and_duplicate_events(self):
        now = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
        events = [{"created_at": day + "T00:00:00Z"} for day in ["2025-10-03", "2025-10-04", "2025-12-31", "2025-12-31", "2026-01-01", "2026-01-02"]]
        self.assertEqual(module.event_counts(events, now), {"2025-10-04": 1, "2025-12-31": 2, "2026-01-01": 1})

    def test_empty_events_stay_empty(self):
        self.assertEqual(module.event_counts([], datetime.now(timezone.utc)), {})


if __name__ == "__main__":
    unittest.main()
