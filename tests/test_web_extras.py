"""Additional tests: web exports, Tasks, db migration, more API endpoints."""

import json
import os
import sqlite3
import pytest
from unittest.mock import MagicMock, patch
from flask import Flask


# ===========================================================================
# Web exports (recon.core.web.exports)
# ===========================================================================

@pytest.fixture(scope='module')
def flask_ctx():
    """Minimal Flask app context for export functions."""
    app = Flask(__name__)
    app.config['TESTING'] = True
    with app.app_context():
        yield


class TestExports:
    ROWS = [{'name': 'example.com', 'module': 'test'}]

    def test_csvify_returns_csv_response(self, flask_ctx):
        from recon.core.web.exports import csvify
        from flask import Response
        resp = csvify(self.ROWS)
        assert isinstance(resp, Response)
        assert resp.mimetype == 'text/csv'

    def test_csvify_empty_rows(self, flask_ctx):
        from recon.core.web.exports import csvify
        resp = csvify([])
        assert resp.mimetype == 'text/csv'

    def test_xmlify_returns_xml_response(self, flask_ctx):
        from recon.core.web.exports import xmlify
        from flask import Response
        resp = xmlify(self.ROWS)
        assert isinstance(resp, Response)
        assert resp.mimetype == 'text/xml'

    def test_xmlify_contains_data(self, flask_ctx):
        from recon.core.web.exports import xmlify
        resp = xmlify(self.ROWS)
        assert b'example.com' in resp.data

    def test_listify_returns_text_response(self, flask_ctx):
        from recon.core.web.exports import listify
        from flask import Response
        resp = listify(self.ROWS)
        assert isinstance(resp, Response)
        assert resp.mimetype == 'text/plain'

    def test_listify_contains_column_headers(self, flask_ctx):
        from recon.core.web.exports import listify
        resp = listify(self.ROWS)
        data = resp.data.decode()
        assert '# name' in data
        assert 'example.com' in data

    def test_listify_empty_rows(self, flask_ctx):
        from recon.core.web.exports import listify
        resp = listify([])
        assert resp.mimetype == 'text/plain'

    def test_jsonify_returns_json(self, flask_ctx):
        from recon.core.web.exports import _jsonify
        resp = _jsonify(self.ROWS)
        data = json.loads(resp.data)
        assert 'rows' in data
        assert data['rows'][0]['name'] == 'example.com'


# ===========================================================================
# Tasks / web/db.py
# ===========================================================================

class TestTasks:
    @pytest.fixture
    def tasks_obj(self, fw):
        """A real Tasks object backed by the test framework's workspace."""
        from recon.core.web.db import Tasks
        return Tasks(fw)

    def test_creates_tasks_db(self, tasks_obj, fw):
        db_path = os.path.join(fw.workspace, 'tasks.db')
        assert os.path.exists(db_path)

    def test_get_tasks_empty(self, tasks_obj):
        assert tasks_obj.get_tasks() == []

    def test_get_ids_empty(self, tasks_obj):
        assert tasks_obj.get_ids() == []

    def test_add_task(self, tasks_obj):
        tasks_obj.add_task('tid1', 'queued')
        task = tasks_obj.get_task('tid1')
        assert task['id'] == 'tid1'
        assert task['status'] == 'queued'

    def test_add_task_with_result(self, tasks_obj):
        result = {'output': 'done', 'count': 5}
        tasks_obj.add_task('tid2', 'finished', result=result)
        task = tasks_obj.get_task('tid2')
        assert task['result'] == result

    def test_get_ids_after_add(self, tasks_obj):
        tasks_obj.add_task('tid3', 'started')
        ids = tasks_obj.get_ids()
        assert 'tid3' in ids

    def test_update_task(self, tasks_obj):
        tasks_obj.add_task('tid4', 'queued')
        tasks_obj.update_task('tid4', status='finished')
        task = tasks_obj.get_task('tid4')
        assert task['status'] == 'finished'

    def test_get_tasks_returns_list(self, tasks_obj):
        tasks_obj.add_task('tid5', 'queued')
        tasks = tasks_obj.get_tasks()
        assert isinstance(tasks, list)
        assert len(tasks) >= 1


# ===========================================================================
# Database migration (recon.core.base.Recon._migrate_db)
# ===========================================================================

class TestMigrateDb:
    def _create_v9_db(self, path):
        """Create a schema at version 9 (missing phone in contacts)."""
        conn = sqlite3.connect(str(path))
        cur = conn.cursor()
        cur.execute('CREATE TABLE domains (domain TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE companies (company TEXT, description TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE netblocks (netblock TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE locations (latitude TEXT, longitude TEXT, street_address TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE vulnerabilities (host TEXT, reference TEXT, example TEXT, publish_date TEXT, category TEXT, status TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE ports (ip_address TEXT, host TEXT, port TEXT, protocol TEXT, banner TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE hosts (host TEXT, ip_address TEXT, region TEXT, country TEXT, latitude TEXT, longitude TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE contacts (first_name TEXT, middle_name TEXT, last_name TEXT, email TEXT, title TEXT, region TEXT, country TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE credentials (username TEXT, password TEXT, hash TEXT, type TEXT, leak TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE leaks (leak_id TEXT, description TEXT, source_refs TEXT, leak_type TEXT, title TEXT, import_date TEXT, leak_date TEXT, attackers TEXT, num_entries TEXT, score TEXT, num_domains_affected TEXT, attack_method TEXT, target_industries TEXT, password_hash TEXT, password_type TEXT, targets TEXT, media_refs TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE pushpins (source TEXT, screen_name TEXT, profile_name TEXT, profile_url TEXT, media_url TEXT, thumb_url TEXT, message TEXT, latitude TEXT, longitude TEXT, time TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE profiles (username TEXT, resource TEXT, url TEXT, category TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE repositories (name TEXT, owner TEXT, description TEXT, resource TEXT, category TEXT, url TEXT, notes TEXT, module TEXT)')
        cur.execute('CREATE TABLE dashboard (module TEXT PRIMARY KEY, runs INT)')
        cur.execute('PRAGMA user_version = 9')
        conn.commit()
        conn.close()

    def test_migrate_v9_to_v10_adds_phone_column(self, fw, monkeypatch, tmp_path):
        from recon.core import base, framework

        v9_db = tmp_path / 'v9' / 'data.db'
        v9_db.parent.mkdir()
        self._create_v9_db(v9_db)

        # Redirect the fw workspace to our v9 DB
        monkeypatch.setattr(framework.Framework, 'workspace', str(v9_db.parent))

        base.Recon._migrate_db(fw)

        # Phone column should now exist
        cols = fw.get_columns('contacts')
        names = [c[0] for c in cols]
        assert 'phone' in names

    def test_migrate_v9_to_v10_updates_version(self, fw, monkeypatch, tmp_path):
        from recon.core import base, framework

        v9_db = tmp_path / 'v9b' / 'data.db'
        v9_db.parent.mkdir()
        self._create_v9_db(v9_db)

        monkeypatch.setattr(framework.Framework, 'workspace', str(v9_db.parent))

        base.Recon._migrate_db(fw)

        version = fw.query('PRAGMA user_version')[0][0]
        assert version == 10

    def test_migrate_current_db_is_no_op(self, fw):
        """_migrate_db on an already-current DB should not change anything."""
        from recon.core import base
        before_version = fw.query('PRAGMA user_version')[0][0]
        base.Recon._migrate_db(fw)
        after_version = fw.query('PRAGMA user_version')[0][0]
        assert before_version == after_version


# ===========================================================================
# Resolver mixin
# ===========================================================================

class TestResolverMixin:
    def test_get_resolver_returns_resolver(self, fw):
        import dns.resolver  # ensure submodule is loaded before the mixin uses it
        from recon.mixins.resolver import ResolverMixin
        from recon.core.framework import Framework

        # Mix ResolverMixin with Framework so _global_options is available
        class TestResolver(ResolverMixin, Framework):
            pass

        obj = TestResolver('test')
        resolver = obj.get_resolver()
        assert isinstance(resolver, dns.resolver.Resolver)

    def test_get_resolver_nameserver_set(self, fw):
        import dns.resolver
        from recon.mixins.resolver import ResolverMixin
        from recon.core.framework import Framework

        class TestResolver(ResolverMixin, Framework):
            pass

        obj = TestResolver('test')
        resolver = obj.get_resolver()
        assert '8.8.8.8' in resolver.nameservers


# ===========================================================================
# Additional web API routes
# ===========================================================================

class TestWorkspaceApi:
    def test_get_workspace_list(self, web_client):
        client, recon, tasks = web_client
        resp = client.get('/api/workspaces/')
        assert resp.status_code == 200

    def test_workspace_list_has_workspaces_key(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(client.get('/api/workspaces/').data)
        assert 'workspaces' in data

    def test_create_workspace(self, web_client):
        client, recon, tasks = web_client
        resp = client.post(
            '/api/workspaces/',
            data=json.dumps({'name': 'new_test_workspace'}),
            content_type='application/json',
        )
        # Either 201 (created) or 409 (already exists)
        assert resp.status_code in (201, 409)

    def test_create_workspace_missing_name_returns_400(self, web_client):
        client, recon, tasks = web_client
        resp = client.post(
            '/api/workspaces/',
            data=json.dumps({}),
            content_type='application/json',
        )
        assert resp.status_code == 400

    def test_get_known_workspace(self, web_client):
        client, recon, tasks = web_client
        resp = client.get('/api/workspaces/workspace')
        assert resp.status_code == 200

    def test_get_unknown_workspace_returns_404(self, web_client):
        client, recon, tasks = web_client
        resp = client.get('/api/workspaces/no_such_workspace')
        assert resp.status_code == 404


class TestSnapshotApi:
    def test_list_snapshots(self, web_client):
        client, recon, tasks = web_client
        resp = client.get('/api/snapshots/')
        assert resp.status_code == 200

    def test_snapshots_response_has_key(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(client.get('/api/snapshots/').data)
        assert 'snapshots' in data


class TestTableRowApi:
    def test_insert_row(self, web_client):
        client, recon, tasks = web_client
        resp = client.post(
            '/api/tables/domains/rows',
            data=json.dumps({'domain': 'inserted.com'}),
            content_type='application/json',
        )
        assert resp.status_code in (200, 201)

    def test_table_schema(self, web_client):
        client, recon, tasks = web_client
        resp = client.get('/api/tables/domains/schema')
        assert resp.status_code == 200

    def test_table_schema_has_columns(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(client.get('/api/tables/domains/schema').data)
        assert 'columns' in data


class TestTaskInstApi:
    def test_get_known_task(self, web_client):
        client, recon, tasks = web_client
        # tasks.get_ids() returns [] by default (mock); set it up
        tasks.get_ids.return_value = ['abc']
        tasks.get_task.return_value = {'id': 'abc', 'status': 'finished', 'result': None}
        resp = client.get('/api/tasks/abc')
        assert resp.status_code == 200

    def test_get_unknown_task_returns_404(self, web_client):
        client, recon, tasks = web_client
        tasks.get_ids.return_value = []
        resp = client.get('/api/tasks/nonexistent_task_id')
        assert resp.status_code == 404
