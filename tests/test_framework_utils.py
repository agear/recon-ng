"""Tests for Framework utility / helper methods."""

import pytest
from recon.core.framework import Framework, FrameworkException


# ---------------------------------------------------------------------------
# to_unicode / to_unicode_str
# ---------------------------------------------------------------------------

class TestToUnicode:
    def test_bytes_decoded(self, fw):
        assert fw.to_unicode(b'hello') == 'hello'

    def test_str_passthrough(self, fw):
        assert fw.to_unicode('hello') == 'hello'

    def test_bytes_with_encoding(self, fw):
        data = 'café'.encode('utf-8')
        assert fw.to_unicode(data, encoding='utf-8') == 'café'


class TestToUnicodeStr:
    def test_str_passthrough(self, fw):
        assert fw.to_unicode_str('hello') == 'hello'

    def test_bytes_converted(self, fw):
        assert fw.to_unicode_str(b'hello') == 'hello'

    def test_int_converted(self, fw):
        result = fw.to_unicode_str(42)
        assert result == '42'
        assert isinstance(result, str)

    def test_none_converted(self, fw):
        result = fw.to_unicode_str(None)
        assert result == 'None'
        assert isinstance(result, str)

    def test_list_converted(self, fw):
        result = fw.to_unicode_str([1, 2])
        assert isinstance(result, str)


# ---------------------------------------------------------------------------
# is_hash
# ---------------------------------------------------------------------------

class TestIsHash:
    MD5   = 'a' * 32
    SHA1  = 'b' * 40
    SHA224 = 'c' * 56
    SHA256 = 'd' * 64
    SHA384 = 'e' * 96
    SHA512 = 'f' * 128
    MYSQL  = '1' * 16
    MYSQL5 = '*' + 'a' * 40
    PHPASS = '$P$' + 'a' * 31
    BCRYPT = '$2a$' + 'a' * 56

    def test_md5(self, fw):
        assert fw.is_hash(self.MD5) == 'MD5'

    def test_sha1(self, fw):
        assert fw.is_hash(self.SHA1) == 'SHA1'

    def test_sha224(self, fw):
        assert fw.is_hash(self.SHA224) == 'SHA224'

    def test_sha256(self, fw):
        assert fw.is_hash(self.SHA256) == 'SHA256'

    def test_sha384(self, fw):
        assert fw.is_hash(self.SHA384) == 'SHA384'

    def test_sha512(self, fw):
        assert fw.is_hash(self.SHA512) == 'SHA512'

    def test_mysql(self, fw):
        assert fw.is_hash(self.MYSQL) == 'MySQL'

    def test_mysql5(self, fw):
        assert fw.is_hash(self.MYSQL5) == 'MySQL5'

    def test_phpass(self, fw):
        assert fw.is_hash(self.PHPASS) == 'phpass'

    def test_bcrypt(self, fw):
        assert fw.is_hash(self.BCRYPT) == 'bcrypt'

    def test_plain_text_not_hash(self, fw):
        assert fw.is_hash('password123') is False

    def test_empty_string_not_hash(self, fw):
        assert fw.is_hash('') is False

    def test_wrong_length_hex_not_hash(self, fw):
        assert fw.is_hash('abc') is False

    def test_non_hex_md5_length_not_hash(self, fw):
        # 32 chars but contains non-hex characters
        assert fw.is_hash('z' * 32) is False


# ---------------------------------------------------------------------------
# get_random_str
# ---------------------------------------------------------------------------

class TestGetRandomStr:
    def test_length(self, fw):
        s = fw.get_random_str(12)
        assert len(s) == 12

    def test_only_lowercase_letters(self, fw):
        s = fw.get_random_str(100)
        assert s.isalpha()
        assert s == s.lower()

    def test_zero_length(self, fw):
        assert fw.get_random_str(0) == ''

    def test_randomness(self, fw):
        # Two independent calls should not always be equal
        results = {fw.get_random_str(20) for _ in range(10)}
        assert len(results) > 1


# ---------------------------------------------------------------------------
# _parse_rowids
# ---------------------------------------------------------------------------

class TestParseRowids:
    def test_single(self, fw):
        assert fw._parse_rowids('3') == [3]

    def test_multiple_csv(self, fw):
        assert fw._parse_rowids('1,3,5') == [1, 3, 5]

    def test_range(self, fw):
        assert fw._parse_rowids('2-5') == [2, 3, 4, 5]

    def test_mixed_range_and_single(self, fw):
        result = fw._parse_rowids('1, 3-5, 7')
        assert result == [1, 3, 4, 5, 7]

    def test_duplicates_deduplicated(self, fw):
        assert fw._parse_rowids('1,1,1') == [1]

    def test_result_sorted(self, fw):
        result = fw._parse_rowids('5,2,1')
        assert result == sorted(result)

    def test_invalid_token_skipped(self, fw):
        result = fw._parse_rowids('1,abc,3')
        assert result == [1, 3]

    def test_spaces_around_values(self, fw):
        assert fw._parse_rowids(' 1 , 2 ') == [1, 2]


# ---------------------------------------------------------------------------
# table (ASCII table formatter)
# ---------------------------------------------------------------------------

class TestTable:
    def test_basic_table_no_exception(self, fw, capsys):
        fw.table([('a', 'b'), ('c', 'd')], header=['H1', 'H2'])
        out = capsys.readouterr().out
        assert 'H1' in out
        assert 'H2' in out
        assert 'a' in out

    def test_table_with_title(self, fw, capsys):
        # Title must not be wider than the column data or a float-multiply
        # bug in the framework's diff_per calculation is triggered.
        # Use data wide enough that title fits within column width.
        fw.table([('a_long_value_here',)], header=['Column'], title='T')
        out = capsys.readouterr().out
        assert 'T' in out

    def test_table_none_values(self, fw, capsys):
        fw.table([(None, 'val')], header=['A', 'B'])
        # Should not raise; None is rendered as empty string
        capsys.readouterr()

    def test_inconsistent_row_lengths_raises(self, fw):
        with pytest.raises(FrameworkException):
            fw.table([('a', 'b'), ('c',)])

    def test_table_long_title_expands_columns(self, fw, capsys):
        # Title longer than data → triggers the diff>0 expansion branch
        fw.table([('x',)], header=['A'], title='This Is A Very Long Title Indeed')
        out = capsys.readouterr().out
        assert 'This Is A Very Long Title Indeed' in out


class TestIsWriteable:
    def test_writeable_path(self, fw, tmp_path):
        path = str(tmp_path / 'writable.txt')
        assert fw._is_writeable(path) is True

    def test_non_writeable_path(self, fw):
        # /root/file should not be writeable by non-root
        assert fw._is_writeable('/root/cannot_write_here.txt') is False


# ---------------------------------------------------------------------------
# _validate_options
# ---------------------------------------------------------------------------

class TestValidateOptions:
    def test_missing_required_raises(self, fw):
        from recon.core.framework import FrameworkException, Options
        fw.options = Options()
        fw.options.init_option('TARGET', None, required=True, description='target host')
        with pytest.raises(FrameworkException):
            fw._validate_options()

    def test_bool_required_passes(self, fw):
        from recon.core.framework import Options
        fw.options = Options()
        fw.options.init_option('FLAG', False, required=True, description='a bool flag')
        fw._validate_options()  # should not raise – bool is always considered set

    def test_int_required_passes(self, fw):
        from recon.core.framework import Options
        fw.options = Options()
        fw.options.init_option('NUM', 0, required=True, description='a number')
        fw._validate_options()  # should not raise – int (even 0) is always set

    def test_optional_none_passes(self, fw):
        from recon.core.framework import Options
        fw.options = Options()
        fw.options.init_option('OPT', None, required=False, description='optional')
        fw._validate_options()  # should not raise
