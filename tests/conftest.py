"""
Shared fixtures for the recon-ng test suite.

The ``fw`` fixture provides a fully initialised Framework instance backed by
temporary SQLite databases so tests never touch the real ~/.recon-ng tree.

The ``web_app`` / ``web_client`` fixtures build a minimal Flask test client
with the module-level ``recon`` and ``tasks`` globals in recon.core.web.api
replaced by the test Framework instance and a MagicMock tasks object.
"""

import os
import sqlite3
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Pre-import hook: prevent the recon.core.web package-level initialization
# from making network requests or loading modules from disk.  This must run
# before any test file that imports from recon.core.web is collected.
# ---------------------------------------------------------------------------

import sys as _sys
if 'recon.core.web' not in _sys.modules:
    with patch('recon.core.base.Recon._fetch_module_index'), \
         patch('recon.core.base.Recon._load_modules'):
        try:
            import recon.core.web  # noqa: F401 – side-effect import
        except Exception:
            pass  # web tests will self-skip if the import fails


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SCHEMA_STMTS = [
    'CREATE TABLE domains (domain TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE companies (company TEXT, description TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE netblocks (netblock TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE locations (latitude TEXT, longitude TEXT, street_address TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE vulnerabilities (host TEXT, reference TEXT, example TEXT, publish_date TEXT, category TEXT, status TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE ports (ip_address TEXT, host TEXT, port TEXT, protocol TEXT, banner TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE hosts (host TEXT, ip_address TEXT, region TEXT, country TEXT, latitude TEXT, longitude TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE contacts (first_name TEXT, middle_name TEXT, last_name TEXT, email TEXT, title TEXT, region TEXT, country TEXT, phone TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE credentials (username TEXT, password TEXT, hash TEXT, type TEXT, leak TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE leaks (leak_id TEXT, description TEXT, source_refs TEXT, leak_type TEXT, title TEXT, import_date TEXT, leak_date TEXT, attackers TEXT, num_entries TEXT, score TEXT, num_domains_affected TEXT, attack_method TEXT, target_industries TEXT, password_hash TEXT, password_type TEXT, targets TEXT, media_refs TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE pushpins (source TEXT, screen_name TEXT, profile_name TEXT, profile_url TEXT, media_url TEXT, thumb_url TEXT, message TEXT, latitude TEXT, longitude TEXT, time TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE profiles (username TEXT, resource TEXT, url TEXT, category TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE repositories (name TEXT, owner TEXT, description TEXT, resource TEXT, category TEXT, url TEXT, notes TEXT, module TEXT)',
    'CREATE TABLE dashboard (module TEXT PRIMARY KEY, runs INT)',
]


def _make_workspace_db(path):
    """Create a fresh workspace data.db at *path*."""
    conn = sqlite3.connect(str(path))
    cur = conn.cursor()
    for sql in _SCHEMA_STMTS:
        cur.execute(sql)
    cur.execute('PRAGMA user_version = 10')
    conn.commit()
    conn.close()


def _make_keys_db(path):
    """Create a fresh keys.db at *path*."""
    conn = sqlite3.connect(str(path))
    cur = conn.cursor()
    cur.execute('CREATE TABLE keys (name TEXT PRIMARY KEY, value TEXT)')
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Core ``fw`` fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def fw(tmp_path, monkeypatch):
    """
    A Framework instance wired to temporary SQLite databases.

    Class-level attributes on Framework are patched via monkeypatch so they
    are automatically restored after each test.
    """
    from recon.core import framework

    workspace = tmp_path / 'workspace'
    workspace.mkdir()
    home = tmp_path / 'home'
    home.mkdir()

    # Redirect all path class-attributes to our temp dirs
    monkeypatch.setattr(framework.Framework, 'workspace', str(workspace))
    monkeypatch.setattr(framework.Framework, 'home_path', str(home))
    monkeypatch.setattr(framework.Framework, 'mod_path', str(tmp_path / 'modules'))
    monkeypatch.setattr(framework.Framework, 'app_path', str(tmp_path))
    monkeypatch.setattr(framework.Framework, 'data_path', str(tmp_path / 'data'))
    monkeypatch.setattr(framework.Framework, 'spaces_path', str(tmp_path / 'spaces'))

    # Fresh global options – verbosity=0 keeps test output clean
    global_options = framework.Options()
    global_options.init_option('verbosity', 0, True, 'verbosity level')
    global_options.init_option('nameserver', '8.8.8.8', True, 'nameserver')
    global_options.init_option('proxy', None, False, 'proxy server')
    global_options.init_option('timeout', 10, True, 'socket timeout')
    global_options.init_option('user-agent', 'test-agent', True, 'user-agent string')
    global_options.init_option('threads', 10, True, 'number of threads')
    monkeypatch.setattr(framework.Framework, '_global_options', global_options)
    monkeypatch.setattr(framework.Framework, '_loaded_modules', {})

    # Build databases
    _make_workspace_db(workspace / 'data.db')
    _make_keys_db(home / 'keys.db')

    # Instantiate and configure
    f = framework.Framework('test/module')
    f.options = framework.Options()
    f._summary_counts = {}
    return f


# ---------------------------------------------------------------------------
# Web API fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope='module')
def web_client(tmp_path_factory):
    """
    A Flask test client for the REST API.

    The module-level ``recon`` and ``tasks`` objects inside recon.core.web.api
    are replaced with a lightweight Framework instance and a MagicMock.
    Redis / RQ are mocked so no external services are needed.
    """
    from recon.core import framework

    # Build a temp workspace for the API's framework instance
    base = tmp_path_factory.mktemp('web')
    workspace = base / 'workspace'
    workspace.mkdir()
    home = base / 'home'
    home.mkdir()

    _make_workspace_db(workspace / 'data.db')
    _make_keys_db(home / 'keys.db')

    # Set up a minimal Framework instance to act as "recon" for the API
    global_options = framework.Options()
    global_options.init_option('verbosity', 0, True, 'verbosity level')
    global_options.init_option('nameserver', '8.8.8.8', True, 'nameserver')
    global_options.init_option('proxy', None, False, 'proxy server')
    global_options.init_option('timeout', 10, True, 'socket timeout')
    global_options.init_option('user-agent', 'test-agent', True, 'user-agent string')
    global_options.init_option('threads', 10, True, 'number of threads')

    api_recon = framework.Framework('base')
    api_recon.options = global_options
    api_recon._summary_counts = {}
    api_recon._module_index = []
    api_recon._loaded_modules = {}
    api_recon._loaded_category = {}

    # Add Recon-specific methods that the API calls but Framework doesn't have
    api_recon._update_module_index = lambda: None
    api_recon._search_module_index = lambda s: []
    api_recon._get_module_from_index = lambda path: None
    api_recon._install_module = MagicMock()
    api_recon._remove_module = MagicMock()
    api_recon._do_modules_reload = MagicMock()
    api_recon._fetch_module_index = MagicMock()
    api_recon._get_snapshots = lambda: []
    api_recon._get_workspaces = lambda: ['workspace']
    api_recon._init_workspace = MagicMock(return_value=True)
    api_recon.remove_workspace = MagicMock(return_value=True)

    # Temporarily point class vars to our temp paths so query() works
    orig_workspace = framework.Framework.workspace
    orig_home = framework.Framework.home_path
    orig_spaces = framework.Framework.spaces_path
    framework.Framework.workspace = str(workspace)
    framework.Framework.home_path = str(home)
    framework.Framework.spaces_path = str(base / 'spaces')
    os.makedirs(str(base / 'spaces'), exist_ok=True)

    # Mock tasks
    mock_tasks = MagicMock()
    mock_tasks.get_tasks.return_value = []
    mock_tasks.get_ids.return_value = []
    mock_tasks.get_task.return_value = {'id': 'abc', 'status': 'finished', 'result': None}

    try:
        import recon.core.web as web_mod
        import recon.core.web.api as api_mod

        # Inject our test objects
        web_mod.recon = api_recon
        web_mod.tasks = mock_tasks
        api_mod.recon = api_recon
        api_mod.tasks = mock_tasks

        with patch('redis.Redis.from_url', return_value=MagicMock()), \
             patch('rq.Queue', return_value=MagicMock()), \
             patch('flasgger.Swagger.__init__', return_value=None):
            app = web_mod.create_app()

        app.config['TESTING'] = True
        app.config['WORKSPACE'] = 'workspace'

        yield app.test_client(), api_recon, mock_tasks

    finally:
        framework.Framework.workspace = orig_workspace
        framework.Framework.home_path = orig_home
        framework.Framework.spaces_path = orig_spaces
