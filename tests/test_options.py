"""Tests for the Options class in recon.core.framework."""

import pytest
from recon.core.framework import Options


class TestAutoConvert:
    """_autoconvert is called on every __setitem__."""

    def test_none_passthrough(self):
        o = Options()
        o['x'] = None
        assert o['x'] is None

    def test_true_passthrough(self):
        o = Options()
        o['x'] = True
        assert o['x'] is True

    def test_false_passthrough(self):
        o = Options()
        o['x'] = False
        assert o['x'] is False

    def test_string_none_lowercase(self):
        o = Options()
        o['x'] = 'none'
        assert o['x'] is None

    def test_string_none_uppercase(self):
        o = Options()
        o['x'] = 'None'
        assert o['x'] is None

    def test_string_empty_single_quotes(self):
        o = Options()
        o["x"] = "''"
        assert o['x'] is None

    def test_string_empty_double_quotes(self):
        o = Options()
        o["x"] = '""'
        assert o['x'] is None

    def test_string_true(self):
        o = Options()
        o['x'] = 'true'
        assert o['x'] is True

    def test_string_false(self):
        o = Options()
        o['x'] = 'false'
        assert o['x'] is False

    def test_string_true_mixed_case(self):
        o = Options()
        o['x'] = 'True'
        assert o['x'] is True

    def test_string_false_mixed_case(self):
        o = Options()
        o['x'] = 'FALSE'
        assert o['x'] is False

    def test_integer_string(self):
        o = Options()
        o['x'] = '42'
        assert o['x'] == 42
        assert type(o['x']) is int

    def test_negative_integer_string(self):
        o = Options()
        o['x'] = '-7'
        assert o['x'] == -7
        assert type(o['x']) is int

    def test_float_string(self):
        o = Options()
        o['x'] = '3.14'
        assert o['x'] == pytest.approx(3.14)
        assert type(o['x']) is float

    def test_integer_with_dot_is_float(self):
        o = Options()
        o['x'] = '2.0'
        assert type(o['x']) is float

    def test_plain_string_passthrough(self):
        o = Options()
        o['x'] = 'hello world'
        assert o['x'] == 'hello world'

    def test_url_string_passthrough(self):
        o = Options()
        o['x'] = 'http://example.com'
        assert o['x'] == 'http://example.com'


class TestKeyTransform:
    """Keys are always normalised to uppercase."""

    def test_set_lowercase_get_uppercase(self):
        o = Options()
        o['foo'] = 'bar'
        assert 'FOO' in o
        assert o['FOO'] == 'bar'

    def test_set_mixed_case(self):
        o = Options()
        o['MyKey'] = 1
        assert 'MYKEY' in o

    def test_del_lowercase(self):
        o = Options()
        o['key'] = 'val'
        del o['key']
        assert 'KEY' not in o


class TestInitOption:
    def test_sets_value_required_description(self):
        o = Options()
        o.init_option('port', value=8080, required=True, description='port number')
        assert o['PORT'] == 8080
        assert o.required['PORT'] is True
        assert o.description['PORT'] == 'port number'

    def test_default_value_none(self):
        o = Options()
        o.init_option('proxy', required=False, description='proxy host')
        assert o['PROXY'] is None

    def test_value_autoconverted(self):
        # '10' should become int 10
        o = Options()
        o.init_option('threads', value='10', required=True, description='')
        assert o['THREADS'] == 10
        assert type(o['THREADS']) is int


class TestSerialize:
    def test_single_option(self):
        o = Options()
        o.init_option('foo', value='bar', required=False, description='a foo')
        s = o.serialize()
        assert len(s) == 1
        item = s[0]
        assert item['name'] == 'FOO'
        assert item['value'] == 'bar'
        assert item['required'] is False
        assert item['description'] == 'a foo'

    def test_multiple_options_all_present(self):
        o = Options()
        o.init_option('a', value=1, required=True, description='alpha')
        o.init_option('b', value=None, required=False, description='beta')
        s = o.serialize()
        names = {item['name'] for item in s}
        assert names == {'A', 'B'}

    def test_serialize_preserves_none_value(self):
        o = Options()
        o.init_option('x', value=None, required=False, description='')
        s = o.serialize()
        assert s[0]['value'] is None


class TestDelete:
    def test_removes_from_required_and_description(self):
        o = Options()
        o.init_option('myopt', value='v', required=True, description='desc')
        del o['myopt']
        assert 'MYOPT' not in o
        assert 'MYOPT' not in o.required
        assert 'MYOPT' not in o.description

    def test_get_after_delete_raises(self):
        o = Options()
        o.init_option('x', value=1, required=False, description='')
        del o['x']
        with pytest.raises(KeyError):
            _ = o['x']
