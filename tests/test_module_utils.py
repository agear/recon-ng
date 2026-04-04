"""Tests for BaseModule utility methods.

We use a minimal concrete subclass with ``_parse_frontmatter`` patched to
avoid reading files from disk, which lets us focus on the logic we care about.
"""

import pytest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Fixture: minimal BaseModule subclass
# ---------------------------------------------------------------------------

@pytest.fixture
def mod(fw):
    """Return a minimal BaseModule instance wired to the test workspace."""
    from recon.core.module import BaseModule

    class Minimal(BaseModule):
        meta = {
            'name': 'Test Module',
            'author': 'test',
            'version': '1.0',
            'description': 'minimal module for testing',
        }

        def module_run(self):
            pass

    with patch.object(Minimal, '_parse_frontmatter', return_value={}), \
         patch.object(Minimal, '_query_keys', return_value=[]):
        m = Minimal('test/minimal')
    return m


# ---------------------------------------------------------------------------
# ascii_sanitize
# ---------------------------------------------------------------------------

class TestAsciiSanitize:
    def test_printable_unchanged(self, mod):
        assert mod.ascii_sanitize('hello') == 'hello'

    def test_removes_non_printable(self, mod):
        # ASCII 0 is not in the allowed set (10, 13, 32–125)
        assert mod.ascii_sanitize('\x00hello') == 'hello'

    def test_newline_preserved(self, mod):
        assert '\n' in mod.ascii_sanitize('line1\nline2')

    def test_carriage_return_preserved(self, mod):
        assert '\r' in mod.ascii_sanitize('line\r\n')

    def test_empty_string(self, mod):
        assert mod.ascii_sanitize('') == ''

    def test_mixed_content(self, mod):
        result = mod.ascii_sanitize('abc\x01\x02def')
        assert result == 'abcdef'


# ---------------------------------------------------------------------------
# html_escape / html_unescape
# ---------------------------------------------------------------------------

class TestHtmlEscape:
    def test_ampersand(self, mod):
        assert mod.html_escape('a & b') == 'a &amp; b'

    def test_less_than(self, mod):
        assert mod.html_escape('<tag>') == '&lt;tag&gt;'

    def test_greater_than(self, mod):
        assert mod.html_escape('>') == '&gt;'

    def test_double_quote(self, mod):
        assert mod.html_escape('"') == '&quot;'

    def test_single_quote(self, mod):
        assert mod.html_escape("'") == '&apos;'

    def test_no_special_chars_unchanged(self, mod):
        assert mod.html_escape('hello') == 'hello'

    def test_full_tag(self, mod):
        result = mod.html_escape('<script>alert("xss")</script>')
        assert '<' not in result
        assert '>' not in result
        assert '"' not in result


class TestHtmlUnescape:
    def test_ampersand(self, mod):
        assert mod.html_unescape('a &amp; b') == 'a & b'

    def test_less_than(self, mod):
        assert mod.html_unescape('&lt;') == '<'

    def test_greater_than(self, mod):
        assert mod.html_unescape('&gt;') == '>'

    def test_round_trip(self, mod):
        original = '<script>alert("test & stuff")</script>'
        assert mod.html_unescape(mod.html_escape(original)) == original


# ---------------------------------------------------------------------------
# cidr_to_list
# ---------------------------------------------------------------------------

class TestCidrToList:
    def test_slash_30(self, mod):
        ips = mod.cidr_to_list('192.168.1.0/30')
        assert '192.168.1.0' in ips
        assert '192.168.1.1' in ips
        assert '192.168.1.2' in ips
        assert '192.168.1.3' in ips
        assert len(ips) == 4

    def test_slash_32(self, mod):
        ips = mod.cidr_to_list('10.0.0.1/32')
        assert ips == ['10.0.0.1']

    def test_returns_strings(self, mod):
        ips = mod.cidr_to_list('172.16.0.0/30')
        assert all(isinstance(ip, str) for ip in ips)

    def test_slash_24_has_256_hosts(self, mod):
        ips = mod.cidr_to_list('192.168.1.0/24')
        assert len(ips) == 256


# ---------------------------------------------------------------------------
# hosts_to_domains
# ---------------------------------------------------------------------------

class TestHostsToDomains:
    def test_single_subdomain_returns_parent(self, mod):
        # The method drops the first (host) label and extracts parent domains.
        # 'mail.example.com' → the host label 'mail' is dropped; 'example.com' added.
        domains = mod.hosts_to_domains(['mail.example.com'])
        assert 'example.com' in domains
        # The host itself is NOT included (by design)
        assert 'mail.example.com' not in domains

    def test_deep_subdomain(self, mod):
        # 'a.b.c.example.com' → drops 'a'; then recursively walks elements.
        domains = mod.hosts_to_domains(['a.b.c.example.com'])
        assert 'example.com' in domains
        assert 'c.example.com' in domains
        assert 'b.c.example.com' in domains
        # The original host string is not included
        assert 'a.b.c.example.com' not in domains

    def test_exclusions_honoured(self, mod):
        domains = mod.hosts_to_domains(
            ['mail.example.com'], exclusions=['example.com'])
        assert 'example.com' not in domains

    def test_no_duplicates(self, mod):
        domains = mod.hosts_to_domains(
            ['a.example.com', 'b.example.com'])
        assert domains.count('example.com') == 1

    def test_empty_input(self, mod):
        assert mod.hosts_to_domains([]) == []

    def test_bare_domain_two_labels(self, mod):
        # Two-label input: len == 2, so it's kept directly.
        domains = mod.hosts_to_domains(['example.com'])
        assert 'example.com' in domains

    def test_multiple_hosts_deduplicates(self, mod):
        domains = mod.hosts_to_domains(['one.test.org', 'two.test.org'])
        assert domains.count('test.org') == 1


# ---------------------------------------------------------------------------
# _merge_dicts
# ---------------------------------------------------------------------------

class TestMergeDicts:
    def test_non_overlapping(self, mod):
        result = mod._merge_dicts({'a': 1}, {'b': 2})
        assert result == {'a': 1, 'b': 2}

    def test_y_overrides_x(self, mod):
        result = mod._merge_dicts({'a': 1, 'b': 2}, {'b': 99})
        assert result['b'] == 99

    def test_x_not_mutated(self, mod):
        x = {'a': 1}
        mod._merge_dicts(x, {'a': 2})
        assert x['a'] == 1

    def test_empty_y(self, mod):
        x = {'a': 1}
        result = mod._merge_dicts(x, {})
        assert result == {'a': 1}

    def test_empty_x(self, mod):
        y = {'b': 2}
        result = mod._merge_dicts({}, y)
        assert result == {'b': 2}


# ---------------------------------------------------------------------------
# make_cookie
# ---------------------------------------------------------------------------

class TestMakeCookie:
    def test_returns_cookie_object(self, mod):
        import http.cookiejar
        cookie = mod.make_cookie('session', 'abc123', 'example.com')
        assert isinstance(cookie, http.cookiejar.Cookie)

    def test_cookie_name_and_value(self, mod):
        cookie = mod.make_cookie('token', 'xyz', 'test.com')
        assert cookie.name == 'token'
        assert cookie.value == 'xyz'

    def test_cookie_domain(self, mod):
        cookie = mod.make_cookie('k', 'v', 'mysite.org')
        assert cookie.domain == 'mysite.org'

    def test_cookie_default_path(self, mod):
        cookie = mod.make_cookie('k', 'v', 'mysite.org')
        assert cookie.path == '/'

    def test_cookie_custom_path(self, mod):
        cookie = mod.make_cookie('k', 'v', 'mysite.org', path='/api')
        assert cookie.path == '/api'


# ---------------------------------------------------------------------------
# _get_source
# ---------------------------------------------------------------------------

class TestGetSource:
    def test_string_source_returns_list_of_one(self, mod):
        sources = mod._get_source('example.com')
        assert sources == ['example.com']

    def test_file_source(self, mod, tmp_path):
        f = tmp_path / 'inputs.txt'
        f.write_text('one\ntwo\nthree')
        sources = mod._get_source(str(f))
        assert 'one' in sources
        assert 'two' in sources

    def test_query_source_empty_raises(self, mod):
        from recon.core.framework import FrameworkException
        with pytest.raises(FrameworkException):
            # default query on domains returns nothing → raises
            mod._get_source('default', 'SELECT domain FROM domains')

    def test_query_keyword_executes_sql(self, mod):
        # Insert a row so the query returns data
        mod.insert_domains(domain='queried.com', mute=True)
        sources = mod._get_source('default', 'SELECT domain FROM domains')
        assert 'queried.com' in sources
