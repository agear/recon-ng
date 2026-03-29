from recon.core import base
from recon.core import framework
from recon.core.web.db import Tasks
from rq import get_current_job
import io
import re
import traceback

_ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

def _strip_ansi(text):
    return _ANSI_ESCAPE.sub('', text)

# These tasks exist outside the web directory to avoid loading the entire
# application (which reloads the framework) on every task execution.

def run_module(workspace, module_path):

    results = {}
    output_buffer = io.StringIO()
    tasks = None
    module = None
    try:
        # instantiate important objects
        job = get_current_job()
        recon = base.Recon(check=False, analytics=False, marketplace=False)
        recon.start(base.Mode.JOB, workspace=workspace)
        tasks = Tasks(recon)
        # update the task's status
        tasks.update_task(job.id, status=job.get_status().value)
        # execute the task; base.py replaces the built-in print() with
        # spool_print(), which in JOB mode suppresses terminal output but
        # writes to Framework._spool when it is set. Point _spool at our
        # StringIO buffer so all output/alert/verbose calls are captured.
        module = recon._loaded_modules.get(module_path)
        if module is None:
            raise ValueError(f"Module '{module_path}' not found in loaded modules.")
        framework.Framework._spool = output_buffer
        try:
            module.run()
        finally:
            framework.Framework._spool = None
    except Exception as e:
        results['error'] = {
            'type': str(type(e)),
            'message': str(e),
            'traceback': traceback.format_exc(),
        }
    results['summary'] = getattr(module, '_summary_counts', {})
    results['output'] = _strip_ansi(output_buffer.getvalue())
    # update the task's status and results
    if tasks is not None:
        tasks.update_task(job.id, status='finished', result=results)
    return results
