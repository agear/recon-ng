"""Tests for the Flask REST API endpoints (recon.core.web.api).

The ``web_client`` fixture (defined in conftest.py) provides:
  client      – Flask test client
  api_recon   – Framework instance the API uses
  mock_tasks  – MagicMock that stands in for the Tasks object
"""

import json
import pytest


pytestmark = pytest.mark.web


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def json_get(client, url, **kwargs):
    return client.get(url, **kwargs)


def json_post(client, url, data, **kwargs):
    return client.post(
        url,
        data=json.dumps(data),
        content_type='application/json',
        **kwargs,
    )


def json_delete(client, url, **kwargs):
    return client.delete(url, **kwargs)


def json_patch(client, url, data, **kwargs):
    return client.patch(
        url,
        data=json.dumps(data),
        content_type='application/json',
        **kwargs,
    )


# ---------------------------------------------------------------------------
# /api/modules/
# ---------------------------------------------------------------------------

class TestModuleList:
    def test_get_returns_200(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/modules/')
        assert resp.status_code == 200

    def test_response_has_modules_key(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(resp.data) if (resp := json_get(client, '/api/modules/')).status_code == 200 else {}
        assert 'modules' in data

    def test_empty_when_no_modules_loaded(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/modules/')
        data = json.loads(resp.data)
        # api_recon._loaded_modules is {} so list should be empty
        assert data['modules'] == []


class TestModuleInst:
    def test_unknown_module_returns_404(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/modules/nonexistent/module')
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# /api/tables/
# ---------------------------------------------------------------------------

class TestTableList:
    def test_get_returns_200(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/tables/')
        assert resp.status_code == 200

    def test_response_has_tables_key(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/tables/').data)
        assert 'tables' in data

    def test_tables_list_contains_domains(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/tables/').data)
        assert 'domains' in data['tables']

    def test_tables_list_excludes_dashboard(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/tables/').data)
        assert 'dashboard' not in data['tables']


class TestTableInst:
    def test_get_domains_table(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/tables/domains')
        assert resp.status_code == 200

    def test_get_unknown_table_returns_404(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/tables/nonexistent_table')
        assert resp.status_code == 404

    def test_get_table_response_structure(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/tables/hosts').data)
        assert 'table' in data
        assert 'rows' in data
        assert 'columns' in data


# ---------------------------------------------------------------------------
# /api/dashboard
# ---------------------------------------------------------------------------

class TestDashboard:
    def test_get_returns_200(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/dashboard')
        assert resp.status_code == 200

    def test_response_has_required_keys(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/dashboard').data)
        assert 'workspace' in data
        assert 'records' in data
        assert 'activity' in data

    def test_records_is_list(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/dashboard').data)
        assert isinstance(data['records'], list)


# ---------------------------------------------------------------------------
# /api/exports
# ---------------------------------------------------------------------------

class TestExportList:
    def test_get_returns_200(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/exports')
        assert resp.status_code == 200

    def test_exports_key_present(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/exports').data)
        assert 'exports' in data

    def test_known_formats_present(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/exports').data)
        for fmt in ('json', 'csv', 'xml'):
            assert fmt in data['exports']


# ---------------------------------------------------------------------------
# /api/reports/
# ---------------------------------------------------------------------------

class TestReportList:
    def test_get_returns_200(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/reports/')
        assert resp.status_code == 200

    def test_reports_key_present(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/reports/').data)
        assert 'reports' in data


# ---------------------------------------------------------------------------
# /api/keys/
# ---------------------------------------------------------------------------

class TestKeyList:
    def test_get_returns_200(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/keys/')
        assert resp.status_code == 200

    def test_response_has_keys_key(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/keys/').data)
        assert 'keys' in data

    def test_add_key_returns_201(self, web_client):
        client, recon, tasks = web_client
        resp = json_post(client, '/api/keys/', {'name': 'test_api_key', 'value': 'abc123'})
        assert resp.status_code == 201

    def test_added_key_appears_in_list(self, web_client):
        client, recon, tasks = web_client
        json_post(client, '/api/keys/', {'name': 'shodan_api_key', 'value': 'xyz'})
        data = json.loads(json_get(client, '/api/keys/').data)
        names = [k['name'] for k in data['keys']]
        assert 'shodan_api_key' in names

    def test_delete_key_returns_204(self, web_client):
        client, recon, tasks = web_client
        # Add then delete
        json_post(client, '/api/keys/', {'name': 'delete_me', 'value': 'tmp'})
        resp = json_delete(client, '/api/keys/delete_me')
        assert resp.status_code == 204

    def test_delete_nonexistent_key_returns_404(self, web_client):
        client, recon, tasks = web_client
        resp = json_delete(client, '/api/keys/definitely_does_not_exist')
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# /api/query
# ---------------------------------------------------------------------------

class TestQueryEndpoint:
    def test_valid_select_query(self, web_client):
        client, recon, tasks = web_client
        resp = json_post(client, '/api/query', {'sql': 'SELECT * FROM domains'})
        assert resp.status_code == 200

    def test_response_has_columns_and_rows(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(
            json_post(client, '/api/query', {'sql': 'SELECT * FROM domains'}).data)
        assert 'columns' in data
        assert 'rows' in data

    def test_non_select_query_rejected(self, web_client):
        client, recon, tasks = web_client
        resp = json_post(client, '/api/query', {'sql': 'DROP TABLE domains'})
        assert resp.status_code == 400

    def test_empty_sql_returns_400(self, web_client):
        client, recon, tasks = web_client
        resp = json_post(client, '/api/query', {'sql': ''})
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# /api/tasks/
# ---------------------------------------------------------------------------

class TestTaskList:
    def test_get_tasks_returns_200(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/tasks/')
        assert resp.status_code == 200

    def test_response_has_tasks_key(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/tasks/').data)
        assert 'tasks' in data

    def test_post_unknown_module_returns_404(self, web_client):
        client, recon, tasks = web_client
        resp = json_post(client, '/api/tasks/', {'path': 'nonexistent/module'})
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# /api/marketplace/
# ---------------------------------------------------------------------------

class TestMarketplace:
    def test_list_returns_200(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/marketplace/')
        assert resp.status_code == 200

    def test_list_has_modules_key(self, web_client):
        client, recon, tasks = web_client
        data = json.loads(json_get(client, '/api/marketplace/').data)
        assert 'modules' in data

    def test_unknown_module_get_returns_404(self, web_client):
        client, recon, tasks = web_client
        resp = json_get(client, '/api/marketplace/recon/no/such/module')
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# /api/marketplace/check-deps
# ---------------------------------------------------------------------------

class TestCheckDeps:
    def test_known_package_satisfied(self, web_client):
        client, recon, tasks = web_client
        resp = json_post(client, '/api/marketplace/check-deps', {'packages': ['requests']})
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data.get('requests') is True

    def test_unknown_package_not_satisfied(self, web_client):
        client, recon, tasks = web_client
        resp = json_post(
            client, '/api/marketplace/check-deps',
            {'packages': ['this_package_does_not_exist_xyz']})
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data.get('this_package_does_not_exist_xyz') is False

    def test_empty_packages_returns_empty_dict(self, web_client):
        # check-deps does not validate for empty list (unlike install-deps)
        client, recon, tasks = web_client
        resp = json_post(client, '/api/marketplace/check-deps', {'packages': []})
        assert resp.status_code == 200
        assert json.loads(resp.data) == {}
