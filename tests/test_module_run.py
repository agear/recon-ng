"""Tests for BaseModule lifecycle: run(), do_run(), do_info(), do_input().

We write a real module file to the temp mod_path so _parse_frontmatter works,
and test the full run() → module_run() → module_post() chain.
"""

import os
import pytest
from unittest.mock import patch


# ---------------------------------------------------------------------------
# Helpers to create module files on disk
# ---------------------------------------------------------------------------

_SIMPLE_MODULE = '''\
---
name: Simple Test Module
author: test
version: 1.0
description: A minimal module for testing
---
from recon.core.module import BaseModule

class Module(BaseModule):
    meta = dict(
        name='Simple Test Module',
        author='test',
        version='1.0',
        description='A minimal module for testing',
    )

    def module_run(self):
        self.insert_domains(domain='from_module.com', mute=True)
'''

_QUERY_MODULE = '''\
---
name: Query Test Module
author: test
version: 1.0
description: Module with a source query
query: SELECT domain FROM domains
---
from recon.core.module import BaseModule

class Module(BaseModule):
    meta = dict(
        name='Query Test Module',
        author='test',
        version='1.0',
        description='Module with a source query',
        query='SELECT domain FROM domains',
    )

    def module_run(self, sources):
        for source in sources:
            self.insert_hosts(host=source, mute=True)
'''


def _write_module(mod_path, category, name, source):
    """Write a module .py file to the temp modules directory."""
    dirpath = os.path.join(mod_path, category)
    os.makedirs(dirpath, exist_ok=True)
    filepath = os.path.join(dirpath, f'{name}.py')
    with open(filepath, 'w') as f:
        f.write(source)
    return f'{category}/{name}'


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def simple_mod(fw):
    """A minimal module instance with a real file on disk."""
    from recon.core import framework
    from recon.core.module import BaseModule

    mod_path = framework.Framework.mod_path
    mod_name = _write_module(mod_path, 'test', 'simple', _SIMPLE_MODULE)

    class MinimalModule(BaseModule):
        meta = {
            'name': 'Simple Test Module',
            'author': 'test',
            'version': '1.0',
            'description': 'A minimal module for testing',
        }

        def module_run(self):
            self.insert_domains(domain='from_module.com', mute=True)

    with patch.object(MinimalModule, '_parse_frontmatter', return_value={}), \
         patch.object(MinimalModule, '_query_keys', return_value=[]):
        mod = MinimalModule(mod_name)
    return mod


@pytest.fixture
def query_mod(fw):
    """A module that uses a source query, pre-populated with one domain."""
    from recon.core import framework
    from recon.core.module import BaseModule

    # Insert a domain so the source query returns data
    fw.insert_domains(domain='source.example.com', mute=True)

    class QueryModule(BaseModule):
        meta = {
            'name': 'Query Test Module',
            'author': 'test',
            'version': '1.0',
            'description': 'Module with a source query',
            'query': 'SELECT domain FROM domains',
        }

        def module_run(self, sources):
            for source in sources:
                self.insert_hosts(host=source, mute=True)

    with patch.object(QueryModule, '_parse_frontmatter', return_value={}), \
         patch.object(QueryModule, '_query_keys', return_value=[]):
        mod = QueryModule('test/query')
    return mod


# ---------------------------------------------------------------------------
# run() / do_run()
# ---------------------------------------------------------------------------

class TestModuleRun:
    def test_run_executes_module_run(self, simple_mod):
        simple_mod.run()
        rows = simple_mod.query(
            "SELECT domain FROM domains WHERE domain='from_module.com'")
        assert len(rows) == 1

    def test_run_increments_dashboard(self, simple_mod):
        simple_mod.run()
        # The dashboard row key is the full _modulename
        rows = simple_mod.query(
            "SELECT runs FROM dashboard WHERE module=?", (simple_mod._modulename,))
        assert rows[0][0] >= 1

    def test_run_populates_summary_counts(self, simple_mod):
        simple_mod._summary_counts = {}
        simple_mod.run()
        assert 'domains' in simple_mod._summary_counts
        assert simple_mod._summary_counts['domains']['count'] >= 1

    def test_do_run_no_exception(self, simple_mod, capsys):
        simple_mod.do_run('')
        capsys.readouterr()

    def test_do_run_prints_summary(self, simple_mod, capsys):
        simple_mod.do_run('')
        out = capsys.readouterr().out
        # Summary prints "N total (M new) domains found."
        assert 'domains' in out


class TestModuleRunWithQuery:
    def test_run_with_source_query(self, query_mod):
        query_mod.run()
        rows = query_mod.query(
            "SELECT host FROM hosts WHERE host='source.example.com'")
        assert len(rows) == 1


# ---------------------------------------------------------------------------
# Module meta with 'query' registers source option
# ---------------------------------------------------------------------------

class TestModuleWithQuery:
    def test_source_option_registered(self, query_mod):
        assert 'SOURCE' in query_mod.options

    def test_default_source_set(self, query_mod):
        assert hasattr(query_mod, '_default_source')
        assert 'SELECT domain FROM domains' in query_mod._default_source


# ---------------------------------------------------------------------------
# do_info
# ---------------------------------------------------------------------------

class TestDoInfo:
    def test_prints_name(self, simple_mod, capsys):
        simple_mod.do_info('')
        out = capsys.readouterr().out
        assert 'Simple Test Module' in out

    def test_prints_description(self, simple_mod, capsys):
        simple_mod.do_info('')
        out = capsys.readouterr().out
        assert 'minimal module' in out.lower()


# ---------------------------------------------------------------------------
# do_input
# ---------------------------------------------------------------------------

class TestDoInput:
    def test_no_source_option_prints_message(self, simple_mod, capsys):
        # simple_mod has no _default_source
        simple_mod.do_input('')
        out = capsys.readouterr().out
        assert 'not available' in out.lower() or 'Source' in out

    def test_with_source_option_prints_inputs(self, query_mod, capsys):
        # query_mod has a _default_source, options['SOURCE'] = 'default'
        query_mod.do_input('')
        out = capsys.readouterr().out
        assert 'source.example.com' in out


# ---------------------------------------------------------------------------
# module_pre / module_run / module_post hooks
# ---------------------------------------------------------------------------

class TestModuleHooks:
    def test_module_pre_returns_none(self, simple_mod):
        assert simple_mod.module_pre() is None

    def test_module_post_returns_none(self, simple_mod):
        assert simple_mod.module_post() is None


# ---------------------------------------------------------------------------
# _parse_frontmatter with a real file
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Module with 'options' in meta (covers __init__ lines 33-34)
# ---------------------------------------------------------------------------

class TestModuleWithOptions:
    def test_options_registered_from_meta(self, fw):
        from recon.core.module import BaseModule

        class OptModule(BaseModule):
            meta = {
                'name': 'Options Module',
                'author': 'test',
                'version': '1.0',
                'description': 'module with explicit options',
                'options': [
                    ('target', 'example.com', True, 'target hostname'),
                    ('depth', 3, False, 'search depth'),
                ],
            }

            def module_run(self):
                pass

        with patch.object(OptModule, '_parse_frontmatter', return_value={}), \
             patch.object(OptModule, '_query_keys', return_value=[]):
            mod = OptModule('test/opts')

        assert 'TARGET' in mod.options
        assert mod.options['TARGET'] == 'example.com'
        assert 'DEPTH' in mod.options
        assert mod.options['DEPTH'] == 3


# ---------------------------------------------------------------------------
# Module with 'required_keys' in meta (covers __init__ lines 37-51)
# ---------------------------------------------------------------------------

class TestModuleWithRequiredKeys:
    def test_required_keys_stored_in_keys_dict(self, fw):
        from recon.core.module import BaseModule

        # Pre-add the key to the DB
        fw.add_key('shodan_api_key', 'my_shodan_value')

        class KeyedModule(BaseModule):
            meta = {
                'name': 'Keyed Module',
                'author': 'test',
                'version': '1.0',
                'description': 'module with required keys',
                'required_keys': ['shodan_api_key'],
            }

            def module_run(self):
                pass

        with patch.object(KeyedModule, '_parse_frontmatter', return_value={}):
            mod = KeyedModule('test/keyed')

        assert 'shodan_api_key' in mod.keys
        assert mod.keys['shodan_api_key'] == 'my_shodan_value'

    def test_missing_required_key_still_loads(self, fw, capsys):
        from recon.core.module import BaseModule

        class MissingKeyModule(BaseModule):
            meta = {
                'name': 'Missing Key Module',
                'author': 'test',
                'version': '1.0',
                'description': 'module with missing key',
                'required_keys': ['nonexistent_service_api_key'],
            }

            def module_run(self):
                pass

        # Should load but emit an error message
        with patch.object(MissingKeyModule, '_parse_frontmatter', return_value={}):
            mod = MissingKeyModule('test/missingkey')

        out = capsys.readouterr().out
        assert mod is not None  # still loaded
        # Should have warned about missing key
        assert 'key not set' in out.lower() or 'missing' in out.lower() or '[!]' in out


# ---------------------------------------------------------------------------
# do_run exception paths
# ---------------------------------------------------------------------------

class TestDoRunErrors:
    def test_framework_exception_handled(self, fw, capsys):
        from recon.core import framework
        from recon.core.module import BaseModule

        class ErrorModule(BaseModule):
            meta = {
                'name': 'Error Module',
                'author': 'test',
                'version': '1.0',
                'description': 'module that raises FrameworkException',
            }

            def module_run(self):
                raise framework.FrameworkException('test framework error')

        with patch.object(ErrorModule, '_parse_frontmatter', return_value={}), \
             patch.object(ErrorModule, '_query_keys', return_value=[]):
            mod = ErrorModule('test/errmod')

        fw._global_options['verbosity'] = 1
        mod.do_run('')
        # Should not propagate; output will have been printed
        fw._global_options['verbosity'] = 0
        capsys.readouterr()

    def test_generic_exception_handled(self, fw, capsys):
        from recon.core.module import BaseModule

        class CrashModule(BaseModule):
            meta = {
                'name': 'Crash Module',
                'author': 'test',
                'version': '1.0',
                'description': 'module that crashes',
            }

            def module_run(self):
                raise RuntimeError('unexpected crash')

        with patch.object(CrashModule, '_parse_frontmatter', return_value={}), \
             patch.object(CrashModule, '_query_keys', return_value=[]):
            mod = CrashModule('test/crash')

        fw._global_options['verbosity'] = 1
        mod.do_run('')  # should not raise
        fw._global_options['verbosity'] = 0
        capsys.readouterr()


# ---------------------------------------------------------------------------
# do_info with extra meta fields (required_keys, comments)
# ---------------------------------------------------------------------------

class TestDoInfoMeta:
    def test_do_info_shows_keys(self, fw, capsys):
        from recon.core.module import BaseModule

        fw.add_key('twitter_api_key', 'secret')

        class KeyedModule(BaseModule):
            meta = {
                'name': 'Keyed Info Module',
                'author': 'test',
                'version': '1.0',
                'description': 'module with keys for info display',
                'required_keys': ['twitter_api_key'],
            }

            def module_run(self):
                pass

        with patch.object(KeyedModule, '_parse_frontmatter', return_value={}):
            mod = KeyedModule('test/keyinfo')

        mod.do_info('')
        out = capsys.readouterr().out
        assert 'twitter_api_key' in out

    def test_do_info_shows_comments(self, fw, capsys):
        from recon.core.module import BaseModule

        class CommentModule(BaseModule):
            meta = {
                'name': 'Comment Module',
                'author': 'test',
                'version': '1.0',
                'description': 'module with comments',
                'comments': ['This is a useful comment', '\tsub-comment here'],
            }

            def module_run(self):
                pass

        with patch.object(CommentModule, '_parse_frontmatter', return_value={}), \
             patch.object(CommentModule, '_query_keys', return_value=[]):
            mod = CommentModule('test/commentmod')

        mod.do_info('')
        out = capsys.readouterr().out
        assert 'useful comment' in out


# ---------------------------------------------------------------------------
# _validate_input with a validator
# ---------------------------------------------------------------------------

class TestValidateInput:
    def test_valid_input_passes(self, fw, capsys):
        from recon.core.module import BaseModule

        # Insert a valid domain to be used as source
        fw.insert_domains(domain='valid.example.com', mute=True)

        class DomainModule(BaseModule):
            meta = {
                'name': 'Domain Module',
                'author': 'test',
                'version': '1.0',
                'description': 'module with domain validator',
                'query': 'SELECT domain FROM domains',
                'validator': 'domain',
            }

            def module_run(self, sources):
                pass

        with patch.object(DomainModule, '_parse_frontmatter', return_value={}), \
             patch.object(DomainModule, '_query_keys', return_value=[]):
            mod = DomainModule('test/dommod')

        # run() calls _validate_input() which validates each source
        mod.run()  # should not raise
        capsys.readouterr()


class TestParseFrontmatter:
    def test_reads_yaml_from_file(self, fw):
        """_parse_frontmatter should parse YAML between --- delimiters."""
        from recon.core import framework
        from recon.core.module import BaseModule

        # Write a module file with frontmatter
        mod_path = framework.Framework.mod_path
        content = (
            '---\n'
            'name: Frontmatter Test\n'
            'author: tester\n'
            'version: 2.0\n'
            'description: tests frontmatter parsing\n'
            '---\n'
            'from recon.core.module import BaseModule\n'
            'class Module(BaseModule):\n'
            '    meta = {}\n'
            '    def module_run(self): pass\n'
        )
        mod_name = _write_module(mod_path, 'test', 'frontmatter', content)

        class FMModule(BaseModule):
            meta = {
                'name': 'Frontmatter Test',
                'author': 'tester',
                'version': '2.0',
                'description': 'tests frontmatter parsing',
            }

            def module_run(self):
                pass

        # Now call _parse_frontmatter directly (no patching) to test the real method
        with patch.object(FMModule, '_query_keys', return_value=[]):
            mod = FMModule.__new__(FMModule)
            mod._modulename = mod_name
            parsed = mod._parse_frontmatter()

        assert parsed.get('name') == 'Frontmatter Test'
        assert parsed.get('author') == 'tester'
        assert str(parsed.get('version')) == '2.0'

    def test_no_frontmatter_returns_empty(self, fw):
        """Files without --- delimiters should return empty dict."""
        from recon.core import framework
        from recon.core.module import BaseModule

        mod_path = framework.Framework.mod_path
        content = (
            'from recon.core.module import BaseModule\n'
            'class Module(BaseModule):\n'
            '    meta = {}\n'
        )
        mod_name = _write_module(mod_path, 'test', 'nofm', content)

        class NFMModule(BaseModule):
            meta = {}

            def module_run(self):
                pass

        with patch.object(NFMModule, '_query_keys', return_value=[]):
            mod = NFMModule.__new__(NFMModule)
            mod._modulename = mod_name
            parsed = mod._parse_frontmatter()

        assert parsed == {}
