"""Tests for Framework database methods (query, insert, insert_*, keys)."""

import datetime
import pytest
from recon.core.framework import FrameworkException


# ---------------------------------------------------------------------------
# query / _query
# ---------------------------------------------------------------------------

class TestQuery:
    def test_select_returns_list(self, fw):
        rows = fw.query('SELECT 1')
        assert isinstance(rows, list)

    def test_select_single_value(self, fw):
        rows = fw.query('SELECT 42')
        assert rows[0][0] == 42

    def test_insert_and_select(self, fw):
        fw.query("INSERT INTO domains (domain) VALUES ('example.com')")
        rows = fw.query("SELECT domain FROM domains WHERE domain='example.com'")
        assert rows[0][0] == 'example.com'

    def test_include_header(self, fw):
        fw.query("INSERT INTO domains (domain) VALUES ('test.org')")
        rows = fw.query('SELECT domain FROM domains', include_header=True)
        assert rows[0] == ('domain',)

    def test_parameterised_query(self, fw):
        fw.query("INSERT INTO domains (domain) VALUES (?)", ('param.com',))
        rows = fw.query('SELECT domain FROM domains WHERE domain=?', ('param.com',))
        assert rows[0][0] == 'param.com'

    def test_update_returns_rowcount(self, fw):
        fw.query("INSERT INTO domains (domain) VALUES ('update.com')")
        count = fw.query("UPDATE domains SET notes='note' WHERE domain='update.com'")
        assert count == 1

    def test_pragma_user_version(self, fw):
        rows = fw.query('PRAGMA user_version')
        assert rows[0][0] == 10


# ---------------------------------------------------------------------------
# get_tables / get_columns
# ---------------------------------------------------------------------------

class TestGetTables:
    def test_returns_list(self, fw):
        tables = fw.get_tables()
        assert isinstance(tables, list)

    def test_contains_expected_tables(self, fw):
        tables = fw.get_tables()
        for name in ('domains', 'hosts', 'contacts', 'credentials', 'ports'):
            assert name in tables

    def test_dashboard_excluded(self, fw):
        # get_tables() filters out 'dashboard'
        assert 'dashboard' not in fw.get_tables()

    def test_returns_13_tables(self, fw):
        # domains, companies, netblocks, locations, vulnerabilities, ports,
        # hosts, contacts, credentials, leaks, pushpins, profiles, repositories
        assert len(fw.get_tables()) == 13


class TestGetColumns:
    def test_domains_columns(self, fw):
        cols = fw.get_columns('domains')
        names = [c[0] for c in cols]
        assert 'domain' in names
        assert 'notes' in names
        assert 'module' in names

    def test_contacts_has_phone(self, fw):
        cols = fw.get_columns('contacts')
        names = [c[0] for c in cols]
        assert 'phone' in names

    def test_ports_has_banner(self, fw):
        cols = fw.get_columns('ports')
        names = [c[0] for c in cols]
        assert 'banner' in names


# ---------------------------------------------------------------------------
# insert (core logic)
# ---------------------------------------------------------------------------

class TestInsert:
    def test_insert_returns_1_on_new_row(self, fw):
        count = fw.insert('domains', {'domain': 'new.com'}, unique_columns=['domain'])
        assert count == 1

    def test_insert_returns_0_on_duplicate(self, fw):
        fw.insert('domains', {'domain': 'dup.com'}, unique_columns=['domain'])
        count = fw.insert('domains', {'domain': 'dup.com'}, unique_columns=['domain'])
        assert count == 0

    def test_insert_increments_summary_counts(self, fw):
        fw._summary_counts = {}
        fw.insert('domains', {'domain': 'count.com'}, unique_columns=['domain'])
        assert 'domains' in fw._summary_counts
        assert fw._summary_counts['domains']['count'] == 1
        assert fw._summary_counts['domains']['new'] == 1

    def test_module_column_set_to_modulename(self, fw):
        fw._modulename = 'recon/test_mod'
        fw.insert('domains', {'domain': 'mod.com'}, unique_columns=['domain'])
        rows = fw.query("SELECT module FROM domains WHERE domain='mod.com'")
        assert rows[0][0] == 'test_mod'


# ---------------------------------------------------------------------------
# insert_* convenience methods
# ---------------------------------------------------------------------------

class TestInsertDomains:
    def test_insert_domain(self, fw):
        count = fw.insert_domains(domain='example.com', mute=True)
        assert count == 1

    def test_insert_duplicate_returns_0(self, fw):
        fw.insert_domains(domain='dup.io', mute=True)
        count = fw.insert_domains(domain='dup.io', mute=True)
        assert count == 0


class TestInsertHosts:
    def test_insert_host(self, fw):
        count = fw.insert_hosts(host='host.example.com', ip_address='1.2.3.4', mute=True)
        assert count == 1

    def test_insert_host_duplicate_returns_0(self, fw):
        fw.insert_hosts(host='dup.host.com', ip_address='5.6.7.8', mute=True)
        count = fw.insert_hosts(host='dup.host.com', ip_address='5.6.7.8', mute=True)
        assert count == 0


class TestInsertContacts:
    def test_insert_contact(self, fw):
        count = fw.insert_contacts(
            first_name='John', last_name='Doe', email='john@example.com', mute=True)
        assert count == 1


class TestInsertCompanies:
    def test_insert_company(self, fw):
        count = fw.insert_companies(company='Acme Inc', description='Test co', mute=True)
        assert count == 1


class TestInsertNetblocks:
    def test_insert_netblock(self, fw):
        count = fw.insert_netblocks(netblock='10.0.0.0/8', mute=True)
        assert count == 1


class TestInsertPorts:
    def test_insert_port(self, fw):
        count = fw.insert_ports(
            ip_address='1.2.3.4', host='host.com', port='80',
            protocol='TCP', mute=True)
        assert count == 1


class TestInsertVulnerabilities:
    def test_insert_vulnerability(self, fw):
        count = fw.insert_vulnerabilities(
            host='vuln.com', reference='CVE-2020-0001',
            category='injection', status='open', mute=True)
        assert count == 1


class TestInsertCredentials:
    def test_plain_password(self, fw):
        count = fw.insert_credentials(
            username='alice', password='secret123', mute=True)
        assert count == 1

    def test_hash_in_password_field_auto_detected(self, fw):
        md5 = 'a' * 32
        count = fw.insert_credentials(username='bob', password=md5, mute=True)
        assert count == 1
        rows = fw.query(
            "SELECT hash, password FROM credentials WHERE username='bob'")
        assert rows[0][0] == md5
        assert rows[0][1] is None

    def test_email_username_also_inserted_in_contacts(self, fw):
        fw.insert_credentials(username='carol@example.com', password='pw', mute=True)
        rows = fw.query(
            "SELECT email FROM contacts WHERE email='carol@example.com'")
        assert len(rows) == 1


class TestInsertProfiles:
    def test_insert_profile(self, fw):
        count = fw.insert_profiles(
            username='user1', resource='twitter', url='https://twitter.com/user1',
            mute=True)
        assert count == 1


class TestInsertRepositories:
    def test_insert_repository(self, fw):
        count = fw.insert_repositories(
            name='myrepo', owner='octocat', url='https://github.com/octocat/myrepo',
            mute=True)
        assert count == 1


class TestInsertLeaks:
    def test_insert_leak(self, fw):
        count = fw.insert_leaks(
            leak_id='LEAK001', title='Big Breach', leak_type='combo', mute=True)
        assert count == 1


class TestInsertLocations:
    def test_insert_location(self, fw):
        count = fw.insert_locations(
            latitude='37.7749', longitude='-122.4194',
            street_address='1 Market St', mute=True)
        assert count == 1


class TestInsertPushpins:
    def test_insert_pushpin(self, fw):
        when = datetime.datetime(2024, 1, 15, 12, 0, 0)
        count = fw.insert_pushpins(
            source='twitter', screen_name='@user',
            latitude='37.7749', longitude='-122.4194',
            time=when, mute=True)
        assert count == 1


# ---------------------------------------------------------------------------
# API key methods
# ---------------------------------------------------------------------------

class TestKeyMethods:
    def test_add_and_get_key(self, fw):
        fw.add_key('my_api_key', 'secret_value')
        assert fw.get_key('my_api_key') == 'secret_value'

    def test_missing_key_returns_none(self, fw):
        assert fw.get_key('nonexistent_key') is None

    def test_remove_key(self, fw):
        fw.add_key('tmp_key', 'tmp_val')
        fw.remove_key('tmp_key')
        assert fw.get_key('tmp_key') is None

    def test_overwrite_key(self, fw):
        fw.add_key('overwrite_key', 'old')
        fw.add_key('overwrite_key', 'new')
        assert fw.get_key('overwrite_key') == 'new'

    def test_get_key_names(self, fw):
        fw.add_key('key_a', 'val_a')
        fw.add_key('key_b', 'val_b')
        names = fw._get_key_names()
        assert 'key_a' in names
        assert 'key_b' in names

    def test_token_key_excluded_from_list_keys(self, fw):
        """Keys ending in _token are filtered from _query_keys list operations."""
        fw.add_key('oauth_token', 'tok123')
        names = fw._get_key_names()
        # get_key bypasses the filter; _get_key_names goes through _query_keys
        assert 'oauth_token' not in names


# ---------------------------------------------------------------------------
# _load_config / _save_config
# ---------------------------------------------------------------------------

class TestConfig:
    def test_save_and_load_config(self, fw):
        from recon.core.framework import Options
        fw.options = Options()
        fw.options.init_option('TARGET', 'example.com', required=True, description='')
        fw._save_config('TARGET')
        # Mutate and reload
        fw.options['TARGET'] = 'other.com'
        fw._load_config()
        assert fw.options['TARGET'] == 'example.com'

    def test_save_none_removes_key_from_config_file(self, fw):
        import json, os
        from recon.core.framework import Options
        fw.options = Options()
        fw.options.init_option('PROXY', '10.0.0.1:8080', required=False, description='')
        fw._save_config('PROXY')
        # Now unset it
        fw.options['PROXY'] = None
        fw._save_config('PROXY')
        # The key should no longer be present in config.dat
        config_path = os.path.join(fw.workspace, 'config.dat')
        with open(config_path) as f:
            data = json.load(f)
        # Module entry should either be gone or not contain PROXY
        module_cfg = data.get(fw._modulename, {})
        assert 'PROXY' not in module_cfg
