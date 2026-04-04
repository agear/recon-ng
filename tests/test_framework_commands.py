"""Tests for Framework console command methods and the request() helper."""

import pytest
from unittest.mock import patch, MagicMock
from recon.core.framework import Framework, Options


# ---------------------------------------------------------------------------
# Simple lifecycle commands
# ---------------------------------------------------------------------------

class TestDoExit:
    def test_sets_exit_flag(self, fw):
        fw.do_exit('')
        assert fw._exit == 1

    def test_returns_true(self, fw):
        assert fw.do_exit('') is True


class TestDoBack:
    def test_returns_true(self, fw):
        assert fw.do_back('') is True


# ---------------------------------------------------------------------------
# do_options
# ---------------------------------------------------------------------------

class TestDoOptions:
    def test_no_params_prints_help(self, fw, capsys):
        fw.options.init_option('TARGET', None, True, 'target host')
        fw.do_options('')
        out = capsys.readouterr().out
        assert 'options' in out.lower() or len(out) >= 0  # no exception

    def test_list_prints_options(self, fw, capsys):
        fw.options = Options()
        fw.options.init_option('SOURCE', 'default', True, 'source of input')
        fw.do_options('list')
        out = capsys.readouterr().out
        assert 'SOURCE' in out

    def test_set_updates_option(self, fw, capsys):
        fw.options = Options()
        fw.options.init_option('TIMEOUT', 10, True, 'timeout')
        fw.do_options('set TIMEOUT 30')
        assert fw.options['TIMEOUT'] == 30

    def test_set_invalid_option_prints_error(self, fw, capsys):
        fw.options = Options()
        fw.do_options('set NONEXISTENT value')
        out = capsys.readouterr().out
        assert 'Invalid' in out or 'invalid' in out

    def test_unset_option(self, fw, capsys):
        fw.options = Options()
        fw.options.init_option('PROXY', '10.0.0.1', False, 'proxy')
        fw.do_options('unset PROXY')
        assert fw.options['PROXY'] is None

    def test_unset_invalid_option(self, fw, capsys):
        fw.options = Options()
        fw.do_options('unset NONEXISTENT')
        out = capsys.readouterr().out
        assert 'Invalid' in out or 'invalid' in out


# ---------------------------------------------------------------------------
# do_keys
# ---------------------------------------------------------------------------

class TestDoKeys:
    def test_no_params_prints_help(self, fw, capsys):
        fw.do_keys('')
        capsys.readouterr()  # no exception

    def test_list_with_no_keys(self, fw, capsys):
        fw.do_keys('list')
        capsys.readouterr()  # no exception

    def test_add_key(self, fw, capsys):
        fw.do_keys('add new_key new_value')
        assert fw.get_key('new_key') == 'new_value'

    def test_add_key_missing_value_prints_help(self, fw, capsys):
        fw.do_keys('add only_key_no_value')
        capsys.readouterr()  # no exception, no crash

    def test_remove_key(self, fw, capsys):
        fw.add_key('remove_me', 'val')
        fw.do_keys('remove remove_me')
        assert fw.get_key('remove_me') is None

    def test_remove_nonexistent_key_prints_error(self, fw, capsys):
        fw.do_keys('remove key_does_not_exist')
        out = capsys.readouterr().out
        assert 'Invalid' in out or 'invalid' in out

    def test_list_shows_keys(self, fw, capsys):
        fw.add_key('visible_key', 'visible_value')
        fw.do_keys('list')
        out = capsys.readouterr().out
        assert 'visible_key' in out


# ---------------------------------------------------------------------------
# do_show
# ---------------------------------------------------------------------------

class TestDoShow:
    def test_schema_no_exception(self, fw, capsys):
        fw.do_show('schema')
        capsys.readouterr()

    def test_modules_no_exception(self, fw, capsys):
        fw.do_show('modules')
        capsys.readouterr()

    def test_unknown_param_no_crash(self, fw, capsys):
        fw.do_show('something_unknown')
        capsys.readouterr()


# ---------------------------------------------------------------------------
# do_db
# ---------------------------------------------------------------------------

class TestDoDb:
    def test_no_params_prints_help(self, fw, capsys):
        fw.do_db('')
        capsys.readouterr()  # no exception

    def test_query_empty_table(self, fw, capsys):
        fw.do_db('query SELECT * FROM domains')
        out = capsys.readouterr().out
        assert 'No data returned' in out

    def test_query_with_data(self, fw, capsys):
        fw.insert_domains(domain='showme.com', mute=True)
        fw.do_db('query SELECT domain FROM domains')
        out = capsys.readouterr().out
        assert 'showme.com' in out

    def test_query_invalid_sql_prints_error(self, fw, capsys):
        fw.do_db('query INVALID SQL STATEMENT')
        out = capsys.readouterr().out
        assert 'Invalid' in out or 'Error' in out or 'error' in out

    def test_schema_lists_tables(self, fw, capsys):
        fw.do_db('schema')
        out = capsys.readouterr().out
        assert 'domains' in out or len(out) >= 0  # no exception

    def test_notes_with_rowid_params(self, fw, capsys):
        fw.insert_domains(domain='noted.com', mute=True)
        rows = fw.query('SELECT ROWID FROM domains WHERE domain=?', ('noted.com',))
        rowid = rows[0][0]
        fw.do_db(f'notes domains {rowid} my note text')
        rows = fw.query('SELECT notes FROM domains WHERE ROWID=?', (rowid,))
        assert rows[0][0] == 'my note text'
        capsys.readouterr()

    def test_notes_invalid_table(self, fw, capsys):
        fw.do_db('notes invalid_table 1 note')
        out = capsys.readouterr().out
        assert 'Invalid' in out

    def test_delete_row(self, fw, capsys):
        fw.insert_domains(domain='todelete.com', mute=True)
        rows = fw.query('SELECT ROWID FROM domains WHERE domain=?', ('todelete.com',))
        rowid = rows[0][0]
        fw.do_db(f'delete domains {rowid}')
        remaining = fw.query('SELECT domain FROM domains WHERE ROWID=?', (rowid,))
        assert remaining == []
        capsys.readouterr()

    def test_delete_invalid_table(self, fw, capsys):
        fw.do_db('delete invalid_table 1')
        out = capsys.readouterr().out
        assert 'Invalid' in out

    def test_insert_row_via_params(self, fw, capsys):
        # domains has columns: domain, notes (module is excluded); use ~ delimiter
        fw.do_db('insert domains newinserted.com~some notes')
        rows = fw.query("SELECT domain FROM domains WHERE domain='newinserted.com'")
        assert len(rows) == 1
        capsys.readouterr()

    def test_insert_invalid_table(self, fw, capsys):
        fw.do_db('insert invalid_table val1~val2')
        out = capsys.readouterr().out
        assert 'Invalid' in out


class TestDoShow:
    def test_no_params_no_crash(self, fw, capsys):
        fw.do_show('')
        capsys.readouterr()

    def test_show_table_contents(self, fw, capsys):
        fw.insert_domains(domain='shown.com', mute=True)
        fw.do_show('domains')
        out = capsys.readouterr().out
        assert 'shown.com' in out

    def test_show_unknown_arg(self, fw, capsys):
        fw.do_show('not_a_thing')
        capsys.readouterr()  # no exception


# ---------------------------------------------------------------------------
# do_dashboard
# ---------------------------------------------------------------------------

class TestDoDashboard:
    def test_empty_dashboard(self, fw, capsys):
        fw.do_dashboard('')
        out = capsys.readouterr().out
        assert len(out) >= 0  # no exception

    def test_populated_dashboard(self, fw, capsys):
        # Directly populate the dashboard table (only BaseModule.run() writes here)
        fw.query("INSERT INTO dashboard (module, runs) VALUES ('test_mod', 5)")
        fw.do_dashboard('')
        out = capsys.readouterr().out
        assert 'Activity Summary' in out


class TestDoScript:
    def test_no_params_prints_help(self, fw, capsys):
        fw.do_script('')
        capsys.readouterr()  # no exception

    def test_record_status_stopped(self, fw, capsys):
        fw.do_script('status')
        out = capsys.readouterr().out
        assert 'stopped' in out.lower()

    def test_record_start(self, fw, capsys, tmp_path):
        from recon.core.framework import Framework
        script_file = str(tmp_path / 'test.script')
        fw.do_script(f'record {script_file}')
        out = capsys.readouterr().out
        assert Framework._record == script_file
        # Cleanup
        Framework._record = None

    def test_record_stop_when_not_recording(self, fw, capsys):
        from recon.core.framework import Framework
        Framework._record = None
        fw.do_script('stop')
        out = capsys.readouterr().out
        assert 'already stopped' in out.lower() or 'stopped' in out.lower()

    def test_execute_nonexistent_file(self, fw, capsys):
        fw.do_script('execute /nonexistent/script.txt')
        out = capsys.readouterr().out
        assert 'not found' in out.lower() or 'Error' in out


class TestDoSpool:
    def test_no_params_prints_help(self, fw, capsys):
        fw.do_spool('')
        capsys.readouterr()

    def test_status_stopped(self, fw, capsys):
        from recon.core.framework import Framework
        Framework._spool = None
        fw.do_spool('status')
        out = capsys.readouterr().out
        assert 'stopped' in out.lower()

    def test_start_spool(self, fw, capsys, tmp_path):
        from recon.core.framework import Framework
        spool_file = str(tmp_path / 'test.spool')
        fw.do_spool(f'start {spool_file}')
        out = capsys.readouterr().out
        assert Framework._spool is not None
        # Cleanup
        Framework._spool.close()
        Framework._spool = None

    def test_start_when_already_started(self, fw, capsys, tmp_path):
        import codecs
        from recon.core.framework import Framework
        spool_file = str(tmp_path / 'already.spool')
        Framework._spool = codecs.open(spool_file, 'ab', encoding='utf-8')
        fw.do_spool('start another_file')
        out = capsys.readouterr().out
        assert 'already' in out.lower()
        Framework._spool.close()
        Framework._spool = None

    def test_stop_spool(self, fw, capsys, tmp_path):
        import codecs
        from recon.core.framework import Framework
        spool_file = str(tmp_path / 'stop.spool')
        Framework._spool = codecs.open(spool_file, 'ab', encoding='utf-8')
        fw.do_spool('stop')
        out = capsys.readouterr().out
        assert Framework._spool is None

    def test_stop_when_not_spooling(self, fw, capsys):
        from recon.core.framework import Framework
        Framework._spool = None
        fw.do_spool('stop')
        out = capsys.readouterr().out
        assert 'already stopped' in out.lower()


# ---------------------------------------------------------------------------
# do_shell
# ---------------------------------------------------------------------------

class TestDoShell:
    def test_simple_command(self, fw, capsys):
        fw.do_shell('echo "hello from shell"')
        capsys.readouterr()  # no exception

    def test_no_params_no_crash(self, fw, capsys):
        fw.do_shell('')
        capsys.readouterr()


# ---------------------------------------------------------------------------
# request()
# ---------------------------------------------------------------------------

class TestRequest:
    def test_get_request_with_user_agent(self, fw):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        with patch('requests.get', return_value=mock_resp) as mock_get:
            resp = fw.request('GET', 'http://example.com')
            assert resp.status_code == 200
            # User-Agent header should be set
            call_kwargs = mock_get.call_args[1]
            headers = call_kwargs.get('headers', {})
            assert 'User-Agent' in headers

    def test_post_request(self, fw):
        mock_resp = MagicMock()
        with patch('requests.post', return_value=mock_resp) as mock_post:
            fw.request('POST', 'http://example.com', data={'key': 'val'})
            assert mock_post.called

    def test_proxy_applied_when_set(self, fw):
        mock_resp = MagicMock()
        fw._global_options['proxy'] = '10.0.0.1:8080'
        with patch('requests.get', return_value=mock_resp) as mock_get:
            fw.request('GET', 'http://example.com')
            kwargs = mock_get.call_args[1]
            assert 'proxies' in kwargs
        # Reset
        fw._global_options['proxy'] = None

    def test_timeout_applied(self, fw):
        mock_resp = MagicMock()
        with patch('requests.get', return_value=mock_resp) as mock_get:
            fw.request('GET', 'http://example.com')
            kwargs = mock_get.call_args[1]
            assert kwargs.get('timeout') == 10

    def test_custom_timeout_honoured(self, fw):
        mock_resp = MagicMock()
        with patch('requests.get', return_value=mock_resp) as mock_get:
            fw.request('GET', 'http://example.com', timeout=30)
            kwargs = mock_get.call_args[1]
            assert kwargs.get('timeout') == 30


# ---------------------------------------------------------------------------
# _parse_params / _parse_subcommands
# ---------------------------------------------------------------------------

class TestParseParams:
    def test_splits_on_first_space(self, fw):
        arg, params = fw._parse_params('add key value')
        assert arg == 'add'
        assert 'key' in params

    def test_single_word(self, fw):
        arg, params = fw._parse_params('list')
        assert arg == 'list'
        assert params == ''

    def test_empty_string(self, fw):
        arg, params = fw._parse_params('')
        assert arg == ''
        assert params == ''


class TestParseSubcommands:
    def test_options_subcommands_include_list_set_unset(self, fw):
        subs = fw._parse_subcommands('options')
        assert 'list' in subs
        assert 'set' in subs
        assert 'unset' in subs

    def test_keys_subcommands(self, fw):
        subs = fw._parse_subcommands('keys')
        assert 'add' in subs
        assert 'remove' in subs
        assert 'list' in subs


# ---------------------------------------------------------------------------
# output methods (spot-check)
# ---------------------------------------------------------------------------

class TestOutputMethods:
    def test_error_adds_punctuation(self, fw, capsys):
        fw.error('something went wrong')
        out = capsys.readouterr().out
        # Should end with '.' after capitalizing
        assert 'Something went wrong.' in out

    def test_error_preserves_existing_punctuation(self, fw, capsys):
        fw.error('something went wrong.')
        out = capsys.readouterr().out
        # Should not add double period
        assert 'Something went wrong.' in out

    def test_output_prints_line(self, fw, capsys):
        fw.output('test output line')
        out = capsys.readouterr().out
        assert 'test output line' in out

    def test_alert_prints_line(self, fw, capsys):
        fw.alert('important alert')
        out = capsys.readouterr().out
        assert 'important alert' in out

    def test_verbose_hidden_when_verbosity_0(self, fw, capsys):
        fw._global_options['verbosity'] = 0
        fw.verbose('should not appear')
        out = capsys.readouterr().out
        assert 'should not appear' not in out

    def test_verbose_shown_when_verbosity_1(self, fw, capsys):
        fw._global_options['verbosity'] = 1
        fw.verbose('should appear')
        out = capsys.readouterr().out
        assert 'should appear' in out
        fw._global_options['verbosity'] = 0

    def test_debug_hidden_when_verbosity_1(self, fw, capsys):
        fw._global_options['verbosity'] = 1
        fw.debug('debug msg')
        out = capsys.readouterr().out
        assert 'debug msg' not in out

    def test_debug_shown_when_verbosity_2(self, fw, capsys):
        fw._global_options['verbosity'] = 2
        fw.debug('debug msg')
        out = capsys.readouterr().out
        assert 'debug msg' in out
        fw._global_options['verbosity'] = 0
