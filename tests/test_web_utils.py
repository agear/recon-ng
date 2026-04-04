"""Tests for recon.core.web.utils (columnize, is_url)."""

import pytest
from recon.core.web.utils import columnize, is_url


# ---------------------------------------------------------------------------
# columnize
# ---------------------------------------------------------------------------

class TestColumnize:
    def test_basic(self):
        cols = ('id', 'name')
        rows = [(1, 'Alice'), (2, 'Bob')]
        result = columnize(cols, rows)
        assert result == [
            {'id': 1, 'name': 'Alice'},
            {'id': 2, 'name': 'Bob'},
        ]

    def test_empty_rows(self):
        assert columnize(('a', 'b'), []) == []

    def test_single_column(self):
        result = columnize(('domain',), [('example.com',), ('test.org',)])
        assert result[0] == {'domain': 'example.com'}
        assert result[1] == {'domain': 'test.org'}

    def test_none_values_preserved(self):
        result = columnize(('a', 'b'), [(None, 'val')])
        assert result[0]['a'] is None

    def test_column_count_matches_values(self):
        result = columnize(('x', 'y', 'z'), [(1, 2, 3)])
        assert len(result[0]) == 3


# ---------------------------------------------------------------------------
# is_url
# ---------------------------------------------------------------------------

class TestIsUrl:
    def test_http_url(self):
        assert is_url('http://example.com') is True

    def test_https_url(self):
        assert is_url('https://example.com/path') is True

    def test_ftp_url(self):
        assert is_url('ftp://files.example.com') is True

    def test_url_with_port(self):
        assert is_url('https://example.com:8443/api') is True

    def test_url_with_query_string(self):
        assert is_url('https://example.com/search?q=test&page=1') is True

    def test_public_ip_url(self):
        assert is_url('http://203.0.113.1/path') is True

    def test_plain_domain_no_scheme_false(self):
        # is_url requires a scheme (http/ftp)
        assert is_url('example.com') is False

    def test_private_ip_url_true(self):
        # Despite the "private_ip" named group, the regex still matches
        # private IPs — is_url returns True for them.
        assert is_url('http://192.168.1.1/path') is True

    def test_localhost_false(self):
        assert is_url('http://localhost:5000') is False

    def test_empty_string_false(self):
        assert is_url('') is False

    def test_integer_false(self):
        assert is_url(12345) is False

    def test_none_false(self):
        assert is_url(None) is False

    def test_no_tld_false(self):
        assert is_url('http://nodot') is False
