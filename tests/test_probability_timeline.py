import importlib.util
import unittest
from datetime import date
from pathlib import Path


def load_module(path: str, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


REPO_ROOT = Path(__file__).resolve().parent.parent
process = load_module(str(REPO_ROOT / "scripts" / "process.py"), "process_module")


class SurvivalBlendHelperTest(unittest.TestCase):
    """Test the extracted compute_survival_blend() helper."""

    def test_returns_float_probability(self):
        """Basic smoke test: helper returns a float in [0, 1]."""
        district_snapshots = [
            {"date": "2026-02-10", "count": 4000},
            {"date": "2026-02-13", "count": 4500},
            {"date": "2026-02-18", "count": 4700},
            {"date": "2026-02-21", "count": 4800},
        ]
        statewide_snapshots = [
            {"date": "2026-02-10", "total": 100000},
            {"date": "2026-02-13", "total": 120000},
            {"date": "2026-02-18", "total": 140000},
            {"date": "2026-02-21", "total": 150000},
        ]
        result = process.compute_survival_blend(
            verified=4800,
            threshold=5000,
            d_num=1,
            as_of_date=date(2026, 2, 21),
            district_snapshots=district_snapshots,
            statewide_snapshots=statewide_snapshots,
            peak_verified=4800,
            post_deadline_removed=0,
            rejection_rate=0.02,
            growth_proj_raw=5100.0,
            days_to_deadline=16,
            snapshot_count=4,
        )
        self.assertIsInstance(result, float)
        self.assertGreaterEqual(result, 0.0)
        self.assertLessEqual(result, 1.0)

    def test_above_threshold_returns_high_prob(self):
        """District well above threshold should have high survival probability."""
        district_snapshots = [
            {"date": "2026-02-10", "count": 5500},
            {"date": "2026-02-13", "count": 5800},
            {"date": "2026-02-18", "count": 6000},
            {"date": "2026-02-21", "count": 6200},
        ]
        statewide_snapshots = [
            {"date": "2026-02-10", "total": 100000},
            {"date": "2026-02-13", "total": 120000},
            {"date": "2026-02-18", "total": 140000},
            {"date": "2026-02-21", "total": 155000},
        ]
        result = process.compute_survival_blend(
            verified=6200,
            threshold=5000,
            d_num=1,
            as_of_date=date(2026, 2, 21),
            district_snapshots=district_snapshots,
            statewide_snapshots=statewide_snapshots,
            peak_verified=6200,
            post_deadline_removed=0,
            rejection_rate=0.01,
            growth_proj_raw=6500.0,
            days_to_deadline=16,
            snapshot_count=4,
        )
        self.assertGreater(result, 0.7)


class ProbabilityTimelineTest(unittest.TestCase):
    """Test the compute_probability_timeline() function."""

    def _make_history(self, snapshots):
        """Build a minimal history dict from a list of snapshot dicts."""
        return {
            "snapshotCount": len(snapshots),
            "firstSnapshot": snapshots[0]["date"],
            "lastSnapshot": snapshots[-1]["date"],
            "snapshots": snapshots,
            "rejectionRates": {},
            "postDeadlineRemovalRates": {},
            "postDeadlineRemovalCounts": {},
            "peakVerified": {},
            "projections": {"byDistrict": {}},
            "anomalies": [],
        }

    def test_returns_list_with_correct_length(self):
        """One timeline entry per snapshot."""
        snapshots = [
            {"date": "2026-01-20", "total": 50000,
             "districts": {str(d): 1700 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-01-23", "total": 60000,
             "districts": {str(d): 2000 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        self.assertEqual(len(timeline), 2)

    def test_timeline_entries_have_required_fields(self):
        """Each entry must have date, pQualify, modelMode, delta."""
        snapshots = [
            {"date": "2026-01-20", "total": 50000,
             "districts": {str(d): 1700 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        entry = timeline[0]
        self.assertIn("date", entry)
        self.assertIn("pQualify", entry)
        self.assertIn("modelMode", entry)
        self.assertIn("delta", entry)

    def test_pre_deadline_uses_growth_mode(self):
        """Snapshots before Feb 15 should use growth model."""
        snapshots = [
            {"date": "2026-01-20", "total": 50000,
             "districts": {str(d): 1700 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        self.assertEqual(timeline[0]["modelMode"], "growth")

    def test_post_deadline_uses_survival_mode(self):
        """Snapshots after Feb 15 should use survival model."""
        snapshots = [
            {"date": "2026-02-10", "total": 100000,
             "districts": {str(d): 3500 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-18", "total": 145000,
             "districts": {str(d): 5000 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        post_entries = [e for e in timeline if e["modelMode"] == "survival"]
        self.assertTrue(len(post_entries) > 0)

    def test_deltas_null_for_growth_and_first_survival(self):
        """Growth entries and the first survival entry should have null delta."""
        snapshots = [
            {"date": "2026-02-10", "total": 100000,
             "districts": {str(d): 3500 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-18", "total": 140000,
             "districts": {str(d): 4800 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-21", "total": 150000,
             "districts": {str(d): 5100 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        growth_entries = [e for e in timeline if e["modelMode"] == "growth"]
        for e in growth_entries:
            self.assertIsNone(e["delta"])
        survival_entries = [e for e in timeline if e["modelMode"] == "survival"]
        if survival_entries:
            self.assertIsNone(survival_entries[0]["delta"])

    def test_subsequent_survival_deltas_are_floats(self):
        """Second+ survival entries should have numeric delta."""
        snapshots = [
            {"date": "2026-02-18", "total": 140000,
             "districts": {str(d): 4800 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-21", "total": 150000,
             "districts": {str(d): 5100 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-24", "total": 155000,
             "districts": {str(d): 5300 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        survival_entries = [e for e in timeline if e["modelMode"] == "survival"]
        if len(survival_entries) >= 2:
            self.assertIsNotNone(survival_entries[1]["delta"])
            self.assertIsInstance(survival_entries[1]["delta"], float)

    def test_pqualify_in_valid_range(self):
        """All pQualify values must be in [0.0, 1.0]."""
        snapshots = [
            {"date": "2026-01-20", "total": 50000,
             "districts": {str(d): 1700 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-18", "total": 140000,
             "districts": {str(d): 4800 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        for entry in timeline:
            self.assertGreaterEqual(entry["pQualify"], 0.0)
            self.assertLessEqual(entry["pQualify"], 1.0)

    def test_empty_history_returns_empty_list(self):
        """No snapshots → empty timeline."""
        history = self._make_history([
            {"date": "2026-01-20", "total": 0, "districts": {},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0}
        ])
        history["snapshots"] = []
        history["snapshotCount"] = 0
        timeline = process.compute_probability_timeline(history)
        self.assertEqual(timeline, [])


if __name__ == "__main__":
    unittest.main()
