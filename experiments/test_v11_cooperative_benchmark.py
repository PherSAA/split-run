import unittest
from experiments.v11_cooperative_benchmark import run


class TestV11(unittest.TestCase):
    def test_normal(self):
        for count in (1, 2, 3000):
            result = run(count)
            self.assertEqual(result["lost"], 0)
            self.assertEqual(result["duplicates"], 0)
            self.assertFalse(result["A_failed"])

    def test_failover(self):
        for count in (2, 3000):
            result = run(count, fail_at=0)
            self.assertEqual(result["lost"], 0)
            self.assertEqual(result["duplicates"], 0)
            self.assertTrue(result["A_failed"])
            self.assertGreater(result["recovered_on_A_failure"], 0)


if __name__ == "__main__":
    unittest.main()
