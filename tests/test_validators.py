"""Tests for recon.utils.validators."""

import pytest
from recon.utils.validators import (
    ValidationException,
    BaseValidator,
    DomainValidator,
    UrlValidator,
    EmailValidator,
)


# ---------------------------------------------------------------------------
# ValidationException
# ---------------------------------------------------------------------------

class TestValidationException:
    def test_message_format(self):
        exc = ValidationException('bad_input', 'domain')
        assert 'bad_input' in str(exc)
        assert 'domain' in str(exc)

    def test_is_exception(self):
        assert issubclass(ValidationException, Exception)


# ---------------------------------------------------------------------------
# DomainValidator
# ---------------------------------------------------------------------------

class TestDomainValidator:
    def setup_method(self):
        self.v = DomainValidator()

    def test_valid_simple_domain(self):
        self.v.validate('example.com')  # no exception

    def test_valid_subdomain(self):
        self.v.validate('mail.example.com')

    def test_valid_deep_subdomain(self):
        self.v.validate('a.b.c.example.com')

    def test_valid_numeric_label(self):
        self.v.validate('123.example.com')

    def test_valid_hyphen_in_label(self):
        self.v.validate('my-domain.com')

    def test_valid_two_letter_tld(self):
        self.v.validate('example.io')

    def test_invalid_plain_word(self):
        with pytest.raises(ValidationException):
            self.v.validate('notadomain')

    def test_invalid_starts_with_hyphen(self):
        with pytest.raises(ValidationException):
            self.v.validate('-bad.com')

    def test_invalid_ip_address(self):
        with pytest.raises(ValidationException):
            self.v.validate('192.168.1.1')

    def test_invalid_empty_string(self):
        with pytest.raises(ValidationException):
            self.v.validate('')


# ---------------------------------------------------------------------------
# UrlValidator
# ---------------------------------------------------------------------------

class TestUrlValidator:
    def setup_method(self):
        self.v = UrlValidator()

    def test_valid_http_url(self):
        self.v.validate('http://example.com')

    def test_valid_https_url(self):
        self.v.validate('https://example.com/path?q=1')

    def test_valid_ftp_url(self):
        self.v.validate('ftp://files.example.com')

    def test_valid_url_with_port(self):
        self.v.validate('http://example.com:8080')

    def test_valid_url_no_scheme(self):
        self.v.validate('example.com')

    def test_valid_ip_url(self):
        self.v.validate('http://192.168.1.1/path')

    def test_valid_localhost(self):
        self.v.validate('http://localhost:5000')

    def test_invalid_empty(self):
        with pytest.raises(ValidationException):
            self.v.validate('')

    def test_invalid_just_scheme(self):
        with pytest.raises(ValidationException):
            self.v.validate('http://')


# ---------------------------------------------------------------------------
# EmailValidator
# ---------------------------------------------------------------------------

class TestEmailValidator:
    def setup_method(self):
        self.v = EmailValidator()

    def test_valid_simple(self):
        self.v.validate('user@example.com')

    def test_valid_with_dots(self):
        self.v.validate('first.last@domain.org')

    def test_valid_with_plus(self):
        self.v.validate('user+tag@example.com')

    def test_valid_subdomain(self):
        self.v.validate('user@mail.example.com')

    def test_invalid_no_at(self):
        with pytest.raises(ValidationException):
            self.v.validate('notanemail')

    def test_invalid_no_domain(self):
        with pytest.raises(ValidationException):
            self.v.validate('user@')

    def test_invalid_empty(self):
        with pytest.raises(ValidationException):
            self.v.validate('')

    def test_invalid_double_at(self):
        with pytest.raises(ValidationException):
            self.v.validate('user@@example.com')
