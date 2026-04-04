"""Tests for recon.utils.parsers — parse_hostname, parse_emails, parse_name."""

import pytest
from recon.utils.parsers import parse_hostname, parse_emails, parse_name


# ---------------------------------------------------------------------------
# parse_hostname
# ---------------------------------------------------------------------------

class TestParseHostname:
    def test_full_url(self):
        assert parse_hostname('http://example.com/path?q=1') == 'example.com'

    def test_https_url(self):
        assert parse_hostname('https://sub.domain.org') == 'sub.domain.org'

    def test_url_with_port(self):
        assert parse_hostname('http://example.com:8080') == 'example.com:8080'

    def test_no_scheme(self):
        # Prepends '//' so urlparse can extract netloc
        assert parse_hostname('example.com/path') == 'example.com'

    def test_plain_hostname(self):
        assert parse_hostname('example.com') == 'example.com'

    def test_ip_address(self):
        assert parse_hostname('http://192.168.1.1/') == '192.168.1.1'


# ---------------------------------------------------------------------------
# parse_emails
# ---------------------------------------------------------------------------

class TestParseEmails:
    def test_single_email(self):
        result = parse_emails('Contact us at user@example.com for info.')
        assert result == ['user@example.com']

    def test_multiple_emails(self):
        result = parse_emails('a@x.com and b@y.com')
        assert 'a@x.com' in result
        assert 'b@y.com' in result

    def test_no_email(self):
        assert parse_emails('no emails here') == []

    def test_email_at_start(self):
        result = parse_emails('admin@example.com is the contact')
        assert 'admin@example.com' in result

    def test_empty_string(self):
        assert parse_emails('') == []


# ---------------------------------------------------------------------------
# parse_name
# ---------------------------------------------------------------------------

class TestParseName:
    def test_first_last(self):
        fname, mname, lname = parse_name('John Doe')
        assert fname == 'John'
        assert mname is None
        assert lname == 'Doe'

    def test_first_middle_last(self):
        fname, mname, lname = parse_name('John M. Doe')
        assert fname == 'John'
        assert mname == 'M'
        assert lname == 'Doe'

    def test_suffix_removed(self):
        # 'Jr' is filtered out
        fname, mname, lname = parse_name('John Doe Jr')
        assert fname == 'John'
        assert lname == 'Doe'

    def test_sr_removed(self):
        fname, mname, lname = parse_name('John Doe Sr')
        assert fname == 'John'
        assert lname == 'Doe'

    def test_dot_in_element_removed(self):
        # Elements containing '.' (but not exactly an initial like 'A.') are removed
        fname, mname, lname = parse_name('Mr. John Doe')
        # 'Mr.' matches r'(?:\.)' so it's removed
        assert fname == 'John'
        assert lname == 'Doe'

    def test_single_name(self):
        fname, mname, lname = parse_name('Cher')
        assert fname == 'Cher'
        assert mname is None
        assert lname is None

    def test_long_name_collapsed(self):
        # More than 3 parts → parts[2:] joined
        fname, mname, lname = parse_name('John A Smith Extra')
        assert fname == 'John'
        assert lname == 'Smith Extra'

    def test_comma_removed(self):
        fname, mname, lname = parse_name('Smith, John')
        # 'Smith,' becomes 'Smith' after comma removal
        assert 'Smith' in (fname, mname, lname)

    def test_html_entities_unescaped(self):
        fname, mname, lname = parse_name('John &amp; Doe')
        # '&' from unescaping → '&' which doesn't match initial/filter patterns
        # The element '&' is kept as-is
        assert fname == 'John'
