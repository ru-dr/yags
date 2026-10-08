# SPDX-License-Identifier: GPL-3.0-or-later
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import release  # noqa: E402


class ReleaseTests(unittest.TestCase):
    def test_versions_agree(self):
        self.assertEqual(len(set(release.versions().values())), 1, release.versions())

    def test_current_version_has_notes(self):
        version = release.versions()["metadata.json"]
        self.assertTrue(release.section(version), f"CHANGELOG.md needs a section for {version}")

    def test_semver(self):
        self.assertTrue(release.SEMVER.match("1.2.3"))
        self.assertTrue(release.SEMVER.match("1.2.3-beta.1"))
        self.assertFalse(release.SEMVER.match("1.2"))
