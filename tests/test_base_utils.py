"""Tests for Recon-specific utility methods in recon.core.base."""

import os
import re
import sqlite3
import pytest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Helpers — call Recon methods unbound, injecting fw as self
# ---------------------------------------------------------------------------

def _call(method_name, fw, *args, **kwargs):
    """Call a Recon class method with fw as self."""
    from recon.core import base
    return getattr(base.Recon, method_name)(fw, *args, **kwargs)


# ---------------------------------------------------------------------------
# _create_db
# ---------------------------------------------------------------------------

class TestCreateDb:
    def test_creates_all_tables(self, fw, tmp_path, monkeypatch):
        from recon.core import base, framework

        # Point to a fresh empty DB
        fresh_ws = tmp_path / 'fresh'
        fresh_ws.mkdir()
        fresh_db = fresh_ws / 'data.db'

        monkeypatch.setattr(framework.Framework, 'workspace', str(fresh_ws))

        base.Recon._create_db(fw)

        tables = fw.get_tables()
        for expected in ('domains', 'hosts', 'contacts', 'credentials',
                         'ports', 'vulnerabilities', 'profiles', 'repositories'):
            assert expected in tables

    def test_sets_user_version_10(self, fw, tmp_path, monkeypatch):
        from recon.core import base, framework

        fresh_ws = tmp_path / 'fresh2'
        fresh_ws.mkdir()
        monkeypatch.setattr(framework.Framework, 'workspace', str(fresh_ws))

        base.Recon._create_db(fw)
        version = fw.query('PRAGMA user_version')[0][0]
        assert version == 10


# ---------------------------------------------------------------------------
# _get_workspaces
# ---------------------------------------------------------------------------

class TestGetWorkspaces:
    def test_returns_list(self, fw, tmp_path, monkeypatch):
        from recon.core import base, framework

        spaces = tmp_path / 'spaces'
        spaces.mkdir()
        monkeypatch.setattr(framework.Framework, 'spaces_path', str(spaces))

        result = base.Recon._get_workspaces(fw)
        assert isinstance(result, list)

    def test_lists_workspace_dirs(self, fw, tmp_path, monkeypatch):
        from recon.core import base, framework

        spaces = tmp_path / 'spaces2'
        spaces.mkdir()
        (spaces / 'alpha').mkdir()
        (spaces / 'beta').mkdir()
        monkeypatch.setattr(framework.Framework, 'spaces_path', str(spaces))

        result = base.Recon._get_workspaces(fw)
        assert 'alpha' in result
        assert 'beta' in result

    def test_ignores_files(self, fw, tmp_path, monkeypatch):
        from recon.core import base, framework

        spaces = tmp_path / 'spaces3'
        spaces.mkdir()
        (spaces / 'ws_dir').mkdir()
        (spaces / 'somefile.txt').write_text('ignored')
        monkeypatch.setattr(framework.Framework, 'spaces_path', str(spaces))

        result = base.Recon._get_workspaces(fw)
        assert 'somefile.txt' not in result
        assert 'ws_dir' in result


# ---------------------------------------------------------------------------
# _get_snapshots
# ---------------------------------------------------------------------------

class TestGetSnapshots:
    def test_empty_workspace_no_snapshots(self, fw):
        from recon.core import base
        result = base.Recon._get_snapshots(fw)
        assert result == []

    def test_detects_snapshot_files(self, fw, monkeypatch):
        from recon.core import base, framework

        ws = fw.workspace
        snap_name = 'snapshot_20240115120000.db'
        (fw.__class__.__mro__)  # force proper attribute lookup
        # Create a fake snapshot file in the workspace
        snap_path = os.path.join(ws, snap_name)
        open(snap_path, 'w').close()

        result = base.Recon._get_snapshots(fw)
        assert snap_name in result

    def test_ignores_non_snapshot_files(self, fw):
        from recon.core import base

        ws = fw.workspace
        # Create a non-snapshot file
        open(os.path.join(ws, 'data.db'), 'w').close()

        result = base.Recon._get_snapshots(fw)
        assert 'data.db' not in result


# ---------------------------------------------------------------------------
# _search_module_index
# ---------------------------------------------------------------------------

class TestSearchModuleIndex:
    def test_search_by_path(self, fw):
        from recon.core import base
        fw._module_index = [
            {'path': 'recon/domains-hosts/resolve', 'name': 'Resolve', 'description': 'DNS lookup', 'status': 'installed'},
            {'path': 'recon/hosts-ports/scan', 'name': 'Port Scan', 'description': 'Port scanner', 'status': 'not installed'},
        ]
        results = base.Recon._search_module_index(fw, 'domains')
        assert any(m['path'] == 'recon/domains-hosts/resolve' for m in results)

    def test_search_by_description(self, fw):
        from recon.core import base
        fw._module_index = [
            {'path': 'a/b/c', 'name': 'Alpha', 'description': 'finds emails', 'status': 'installed'},
            {'path': 'x/y/z', 'name': 'Beta', 'description': 'dns resolver', 'status': 'not installed'},
        ]
        results = base.Recon._search_module_index(fw, 'email')
        assert len(results) == 1
        assert results[0]['name'] == 'Alpha'

    def test_no_match_returns_empty(self, fw):
        from recon.core import base
        fw._module_index = [
            {'path': 'a/b', 'name': 'Module', 'description': 'does stuff', 'status': 'installed'},
        ]
        results = base.Recon._search_module_index(fw, 'xyzzy_no_match')
        assert results == []


# ---------------------------------------------------------------------------
# _get_module_from_index
# ---------------------------------------------------------------------------

class TestGetModuleFromIndex:
    def test_returns_matching_module(self, fw):
        from recon.core import base
        fw._module_index = [
            {'path': 'recon/test/mymod', 'name': 'My Mod', 'description': '', 'status': 'installed'},
        ]
        result = base.Recon._get_module_from_index(fw, 'recon/test/mymod')
        assert result is not None
        assert result['name'] == 'My Mod'

    def test_returns_none_for_missing(self, fw):
        from recon.core import base
        fw._module_index = []
        result = base.Recon._get_module_from_index(fw, 'nonexistent/module')
        assert result is None


# ---------------------------------------------------------------------------
# _check_version (mocked)
# ---------------------------------------------------------------------------

class TestCheckVersion:
    def test_version_ok_no_alert(self, fw, capsys):
        from recon.core import base
        import recon.core.base as base_mod

        current_version = base_mod.__version__
        mock_resp = MagicMock()
        mock_resp.text = f"__version__ = '{current_version}'"

        with patch.object(fw, 'request', return_value=mock_resp):
            fw._check = True
            base.Recon._check_version(fw)
        fw._check = False
        capsys.readouterr()

    def test_version_mismatch_shows_alert(self, fw, capsys):
        from recon.core import base

        mock_resp = MagicMock()
        mock_resp.text = "__version__ = '99.99.99'"

        with patch.object(fw, 'request', return_value=mock_resp):
            fw._check = True
            base.Recon._check_version(fw)
        fw._check = False
        out = capsys.readouterr().out
        assert 'version' in out.lower() or 'update' in out.lower() or '[*]' in out

    def test_version_check_disabled(self, fw, capsys):
        from recon.core import base
        fw._check = False
        base.Recon._check_version(fw)
        out = capsys.readouterr().out
        assert 'disabled' in out.lower()
