"""Tests for the BuiltWith module bug fixes:
- KeyError on missing 'Results' key is handled gracefully
- 'Errors' list in API response is handled
- Legacy 'error' string key is handled
- Variable shadowing of 'data' and 'domain' across multiple results
"""

import sys
import os
import types
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_module(fw):
    """Load the BuiltWith module class, patching away key/frontmatter setup."""
    # Ensure the module file is importable from its installed location
    builtwith_path = os.path.expanduser('~/.recon-ng/modules/recon/domains-hosts')
    if builtwith_path not in sys.path:
        sys.path.insert(0, builtwith_path)

    import importlib.util
    spec = importlib.util.spec_from_file_location(
        'builtwith',
        os.path.expanduser('~/.recon-ng/modules/recon/domains-hosts/builtwith.py'),
    )
    mod_file = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod_file)
    Module = mod_file.Module

    with patch.object(Module, '_parse_frontmatter', return_value={}), \
         patch.object(Module, '_query_keys', return_value=[]):
        instance = Module('recon/domains-hosts/builtwith')

    # Inject a fake builtwith_api key
    instance.keys = {'builtwith_api': 'FAKE_KEY'}
    return instance


def _mock_response(payload):
    """Return a mock requests.Response whose .json() returns payload."""
    resp = MagicMock()
    resp.json.return_value = payload
    return resp


def _result_payload(domain='example.com', subdomain='www.example.com',
                    emails=None, names=None, technologies=None):
    """Build a minimal valid BuiltWith API Results entry."""
    return {
        'Meta': {
            'Emails': emails or [],
            'Names': names or [],
        },
        'Result': {
            'Paths': [
                {
                    'Domain': domain,
                    'SubDomain': subdomain,
                    'Technologies': technologies or [],
                }
            ]
        },
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestBuiltWithErrorHandling:
    def test_missing_results_key_does_not_raise(self, fw, capsys):
        """Original bug: KeyError when 'Results' absent from response."""
        mod = _make_module(fw)
        fw.insert_domains(domain='example.com', mute=True)

        with patch.object(mod, 'request', return_value=_mock_response({'SomeOtherKey': []})):
            mod.module_run(['example.com'])  # must not raise KeyError

        out = capsys.readouterr().out
        assert "Results" in out or "[!]" in out or "Unexpected" in out

    def test_missing_results_key_emits_error(self, fw, capsys):
        """The module should log an error message when 'Results' is absent."""
        mod = _make_module(fw)

        with patch.object(mod, 'request', return_value=_mock_response({'foo': 'bar'})):
            mod.module_run(['example.com'])

        out = capsys.readouterr().out
        assert "[!]" in out

    def test_errors_list_handled(self, fw, capsys):
        """'Errors' list in API response logs each message and skips domain."""
        mod = _make_module(fw)

        payload = {'Errors': [{'Message': 'Invalid API key'}]}
        with patch.object(mod, 'request', return_value=_mock_response(payload)):
            mod.module_run(['example.com'])

        out = capsys.readouterr().out
        assert 'Invalid API key' in out

    def test_legacy_error_string_handled(self, fw, capsys):
        """Legacy 'error' string key in response logs the error and skips domain."""
        mod = _make_module(fw)

        payload = {'error': 'Quota exceeded'}
        with patch.object(mod, 'request', return_value=_mock_response(payload)):
            mod.module_run(['example.com'])

        out = capsys.readouterr().out
        assert 'Quota exceeded' in out

    def test_empty_errors_list_falls_through_to_results_check(self, fw, capsys):
        """Empty 'Errors' list should not block processing (fall through to Results check)."""
        mod = _make_module(fw)
        # Drain any [!] warnings from module instantiation (e.g. missing key warning)
        capsys.readouterr()

        # Empty Errors with valid Results → should process normally, no run-time error
        payload = {'Errors': [], 'Results': [_result_payload()]}
        with patch.object(mod, 'request', return_value=_mock_response(payload)):
            mod.module_run(['example.com'])

        # No run-time error output expected for a valid response
        out = capsys.readouterr().out
        assert 'Unexpected' not in out
        assert 'Invalid' not in out


class TestBuiltWithVariableShadowing:
    def test_multiple_results_do_not_crash(self, fw, capsys):
        """Variable shadowing of 'data' caused crash on second result iteration."""
        mod = _make_module(fw)

        payload = {
            'Results': [
                _result_payload(domain='example.com', subdomain='www.example.com'),
                _result_payload(domain='example.com', subdomain='mail.example.com'),
            ]
        }
        with patch.object(mod, 'request', return_value=_mock_response(payload)):
            mod.module_run(['example.com'])  # must not raise

        capsys.readouterr()

    def test_subdomains_inserted_as_hosts(self, fw, capsys):
        """Subdomains from Paths should be inserted into the hosts table."""
        mod = _make_module(fw)

        payload = {
            'Results': [
                _result_payload(domain='example.com', subdomain='sub.example.com'),
            ]
        }
        with patch.object(mod, 'request', return_value=_mock_response(payload)):
            mod.module_run(['example.com'])

        rows = mod.query("SELECT host FROM hosts WHERE host='sub.example.com'")
        assert len(rows) == 1
        capsys.readouterr()

    def test_tld_domain_not_inserted_as_host(self, fw, capsys):
        """A path where subdomain == domain should not be inserted as a host."""
        mod = _make_module(fw)

        # When subdomain is just the domain itself (no sub), host_domain == host
        payload = {
            'Results': [
                _result_payload(domain='example.com', subdomain='example.com'),
            ]
        }
        with patch.object(mod, 'request', return_value=_mock_response(payload)):
            mod.module_run(['example.com'])

        rows = mod.query("SELECT host FROM hosts WHERE host='example.com'")
        assert len(rows) == 0
        capsys.readouterr()

    def test_contacts_inserted_from_emails(self, fw, capsys):
        """Emails in Meta should be inserted as contacts."""
        mod = _make_module(fw)

        payload = {
            'Results': [
                _result_payload(emails=['admin@example.com']),
            ]
        }
        with patch.object(mod, 'request', return_value=_mock_response(payload)):
            mod.module_run(['example.com'])

        rows = mod.query("SELECT email FROM contacts WHERE email='admin@example.com'")
        assert len(rows) == 1
        capsys.readouterr()

    def test_contacts_inserted_from_names(self, fw, capsys):
        """Names in Meta should be inserted as contacts via parse_name."""
        mod = _make_module(fw)

        payload = {
            'Results': [
                _result_payload(names=[{'Name': 'John Doe'}]),
            ]
        }
        with patch.object(mod, 'request', return_value=_mock_response(payload)):
            mod.module_run(['example.com'])

        rows = mod.query("SELECT first_name, last_name FROM contacts WHERE last_name='Doe'")
        assert len(rows) == 1
        assert rows[0][0] == 'John'
        capsys.readouterr()
