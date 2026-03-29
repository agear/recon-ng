from flask import Blueprint, current_app, request, abort
from flask_restful import Resource, Api
from recon.core.web import recon, tasks
from recon.core.web.utils import columnize
from recon.core.web.constants import EXPORTS, REPORTS
import datetime
import os
import shutil

resources = Blueprint('resources', __name__, url_prefix='/api')
api = Api()
api.init_app(resources)


class TaskList(Resource):

    def get(self):
        '''
        Gets all tasks for the current workspace
        ---
        responses:
            200:
                description: List of tasks
                schema:
                    properties:
                        tasks:
                            type: array
                            items:
                                $ref: '#/definitions/Task'
                    required:
                    - tasks
        '''
        return {
            'tasks': tasks.get_tasks(),
        }

    def post(self):
        '''
        Runs a module as a background task
        ---
        parameters:
          - name: body
            in: body
            description: Object containing the path of the module to run
            schema:
                properties:
                    path:
                        type: string
                required:
                - path
        responses:
            201:
                description: Object containing the ID of the created task
                schema:
                    properties:
                        task:
                            type: string
                    required:
                    - task
        '''
        path = request.json.get('path')
        if not path or path not in recon._loaded_modules:
            abort(404)
        job = current_app.task_queue.enqueue('recon.core.tasks.run_module', current_app.config['WORKSPACE'], path)
        tid = job.get_id()
        status = job.get_status()
        tasks.add_task(tid, status)
        return {
            'task': tid,
        }, 201

api.add_resource(TaskList, '/tasks/')


class TaskInst(Resource):

    def get(self, tid):
        '''
        Gets the specified task
        ---
        parameters:
          - name: tid
            in: path
            description: ID of the target task
            required: true
            type: string
          - name: live
            in: query
            description: If set, queries the Redis queue instead of the database
            required: false
            type: string
        responses:
            200:
                description: Object containing the specified task
                schema:
                    $ref: '#/definitions/Task'
        '''
        if tid not in tasks.get_ids():
            abort(404)
        # process requests for the rq version of the task
        if request.args.get('live'):
            # baseline task object
            task = {
                'id': tid,
                'status': 'unknown',
                'result': None,
            }
            job = current_app.task_queue.fetch_job(tid)
            if job:
                task['status'] = job.get_status()
                task['result'] = job.result
        else:
            task = tasks.get_task(tid)
        return task

api.add_resource(TaskInst, '/tasks/<string:tid>')


class ModuleList(Resource):

    def get(self):
        '''
        Gets all module names from the framework
        ---
        responses:
            200:
                description: List of module names
                schema:
                    properties:
                        modules:
                            type: array
                            items:
                                type: string
                    required:
                    - modules
        '''
        return {
            'modules': sorted(list(recon._loaded_modules.keys())),
        }

api.add_resource(ModuleList, '/modules/')


class ModuleInst(Resource):

    def get(self, module):
        '''
        Gets information about the specified module
        ---
        parameters:
          - name: module
            in: path
            description: Path of the target module
            required: true
            type: string
        responses:
            200:
                description: Object containing the specified module's information
                schema:
                    $ref: '#/definitions/Module'
        '''
        module = recon._loaded_modules.get(module)
        if module is None:
            abort(404)
        meta = {k: v for k, v in module.meta.items()}
        # provide options with more context
        options = module.options.serialize()
        if options:
            meta['options'] = options
        return meta

    def patch(self, module):
        '''
        Updates the specified module
        Options are the only modifiable property of a module object.
        ---
        parameters:
          - name: module
            in: path
            description: Name of the target module
            required: true
            type: string
          - name: body
            in: body
            description: Object containing the options to update
            schema:
                properties:
                    options:
                        type: array
                        items:
                            type: object
                            properties:
                                name:
                                    type: string
                                value:
                                    type: string
                            required:
                            - name
                            - value
                required:
                - options
        responses:
            200:
                description: Object containing the modified module's information
                schema:
                    $ref: '#/definitions/Module'
        '''
        module = recon._loaded_modules.get(module)
        if module is None:
            abort(404)
        options = request.json.get('options')
        # process options
        if options:
            for option in options:
                name = option.get('name')
                value = option.get('value')
                if name and value and name in module.options:
                    module.options[name] = value
                    module._save_config(name)
        return self.get(module._modulename)

api.add_resource(ModuleInst, '/modules/<path:module>')


class WorkspaceList(Resource):

    def get(self):
        '''
        Gets all workspace names from the framework
        ---
        responses:
            200:
                description: List of workspace names
                schema:
                    properties:
                        workspaces:
                            type: array
                            items:
                                type: string
                    required:
                    - workspaces
        '''
        return {
            'workspaces': sorted(recon._get_workspaces()),
        }

    def post(self):
        '''
        Creates a new workspace
        ---
        parameters:
          - name: body
            in: body
            description: Object containing the name of the workspace to create
            schema:
                properties:
                    name:
                        type: string
                required:
                - name
        responses:
            201:
                description: Object containing the created workspace's information
            409:
                description: Workspace already exists
        '''
        name = request.json.get('name')
        if not name:
            abort(400)
        if name in recon._get_workspaces():
            abort(409)
        recon._init_workspace(name)
        return {
            'name': name,
            'status': 'inactive',
            'options': [],
        }, 201

api.add_resource(WorkspaceList, '/workspaces/')


class WorkspaceInst(Resource):

    def get(self, workspace):
        '''
        Gets information about the specified workspace
        Only returns options for the active workspace.
        ---
        parameters:
          - name: workspace
            in: path
            description: Name of the target workspace
            required: true
            type: string
        responses:
            200:
                description: Object containing the specified workspace's information
                schema:
                    $ref: '#/definitions/Workspace'
        '''
        if workspace not in recon._get_workspaces():
            abort(404)
        status = 'inactive'
        options = []
        if workspace == current_app.config['WORKSPACE']:
            status = 'active'
            options = recon.options.serialize()
        return {
            'name': workspace,
            'status': status,
            'options': options,
        }

    def patch(self, workspace):
        '''
        Updates the specified workspace
        Activating a workspace deactivates the currently activated workspace, and only the active workspace's options can be modified.
        ---
        parameters:
          - name: workspace
            in: path
            description: Name of the target workspace
            required: true
            type: string
          - name: body
            in: body
            description: Object containing the properties to update
            schema:
                properties:
                    status:
                        type: string
                    options:
                        type: array
                        items:
                            type: object
                            properties:
                                name:
                                    type: string
                                value:
                                    type: string
                            required:
                            - name
                            - value
        responses:
            200:
                description: Object containing the modified workspace's information
                schema:
                    $ref: '#/definitions/Workspace'
        '''
        if workspace not in recon._get_workspaces():
            abort(404)
        status = request.json.get('status')
        options = request.json.get('options')
        # process status
        if status:
            # ignore everything but a request to activate
            if status == 'active':
                # only continue if the workspace is not already active
                if current_app.config['WORKSPACE'] != workspace:
                    # re-initialize the workspace and tasks object
                    recon._init_workspace(workspace)
                    tasks.__init__(recon)
                    # add the workspace name the to global object
                    current_app.config['WORKSPACE'] = workspace
                    print((f" * Workspace initialized: {workspace}"))
        # process options
        if options:
            # only continue if the workspace is active
            if current_app.config['WORKSPACE'] == workspace:
                for option in options:
                    name = option.get('name')
                    value = option.get('value')
                    if name and value and name in recon.options:
                        recon.options[name] = value
                        recon._save_config(name)
        return self.get(workspace)

    def delete(self, workspace):
        '''
        Deletes the specified workspace
        ---
        parameters:
          - name: workspace
            in: path
            description: Name of the workspace to delete
            required: true
            type: string
        responses:
            204:
                description: Workspace deleted
            400:
                description: Cannot delete the active workspace
            404:
                description: Workspace not found
        '''
        if workspace not in recon._get_workspaces():
            abort(404)
        if workspace == current_app.config['WORKSPACE']:
            abort(400)
        if not recon.remove_workspace(workspace):
            abort(500)
        return '', 204

api.add_resource(WorkspaceInst, '/workspaces/<string:workspace>')


class DashboardInst(Resource):

    def get(self):
        '''
        Gets summary information about the current workspace
        ---
        responses:
            200:
                description: Object containing the summary information
                schema:
                    $ref: '#/definitions/Dashboard'
        '''
        # build the activity object
        dashboard = recon.query('SELECT * FROM dashboard', include_header=True)
        columns = dashboard.pop(0)
        activity = columnize(columns, dashboard)
        # build the records object
        records = []
        tables = recon.get_tables()
        for table in tables:
            count = recon.query(f"SELECT COUNT(*) AS 'COUNT' FROM {table}")
            records.append({'name': table, 'count':count[0][0]})
        # sort both lists in descending order
        records.sort(key=lambda r: r['count'], reverse=True)
        activity.sort(key=lambda m: m['runs'], reverse=True)
        return {
            'workspace': current_app.config['WORKSPACE'],
            'records': records,
            'activity': activity,
        }

api.add_resource(DashboardInst, '/dashboard')


class ReportList(Resource):

    def get(self):
        '''
        Gets all report types from the framework
        ---
        responses:
            200:
                description: List of report types
                schema:
                    properties:
                        reports:
                            type: array
                            items:
                                type: string
                    required:
                    - reports
        '''
        return {
            'reports': sorted(list(REPORTS.keys())),
        }

api.add_resource(ReportList, '/reports/')


class ReportInst(Resource):

    def get(self, report):
        '''
        Runs the specified report for the current workspace
        ---
        parameters:
          - name: report
            in: path
            description: Name of the report type
            required: true
            type: string
        '''
        if report not in REPORTS:
            abort(404)
        return REPORTS[report]()

api.add_resource(ReportInst, '/reports/<string:report>')


class TableList(Resource):

    def get(self):
        '''
        Gets all table names for the current workspace
        ---
        responses:
            200:
                description: Object containing the list of tables names
                schema:
                    properties:
                        workspace:
                            type: string
                        tables:
                            type: array
                            items:
                                type: string
                    required:
                    - workspace
                    - tables
        '''
        return {
            'workspace': current_app.config['WORKSPACE'],
            'tables': sorted(recon.get_tables()),
        }

api.add_resource(TableList, '/tables/')


class TableInst(Resource):

    def get(self, table):
        '''
        Dumps the contents of the specified table
        ---
        parameters:
          - name: table
            in: path
            description: Name of the target table
            required: true
            type: string
          - name: format
            in: query
            description: Export type
            required: false
            type: string
        responses:
            200:
                description: Object containing the specified table's contents
                schema:
                    $ref: '#/definitions/Table'
        '''
        if table not in recon.get_tables():
            abort(404)
        # filter rows for columns if needed
        columns = request.values.get('columns')
        if columns:
            rows = recon.query(f"SELECT {columns} FROM {table}", include_header=True)
        else:
            # include rowid for delete/notes support
            rows = recon.query(f"SELECT rowid, * FROM {table}", include_header=True)
        columns = rows.pop(0)
        rows = columnize(columns, rows)
        # dynamically determine and call export function
        _format = request.args.get('format')
        if _format and _format in EXPORTS:
            # strip rowid before exporting
            export_rows = [{k: v for k, v in r.items() if k != 'rowid'} for r in rows]
            return EXPORTS[_format](rows=export_rows)
        return {
            'workspace': current_app.config['WORKSPACE'],
            'table': table,
            'columns': columns,
            'rows': rows,
        }

api.add_resource(TableInst, '/tables/<string:table>')


class ExportList(Resource):

    def get(self):
        '''
        Gets all export types from the framework
        ---
        responses:
            200:
                description: List of export types
                schema:
                    properties:
                        exports:
                            type: array
                            items:
                                type: string
                    required:
                    - exports
        '''
        return {
            'exports': sorted(list(EXPORTS.keys())),
        }

api.add_resource(ExportList, '/exports')


class MarketplaceList(Resource):

    def get(self):
        '''
        Gets all modules from the marketplace index
        ---
        parameters:
          - name: q
            in: query
            description: Optional search term
            required: false
            type: string
        responses:
            200:
                description: List of marketplace modules
        '''
        recon._update_module_index()
        q = request.args.get('q', '').strip()
        if q:
            modules = recon._search_module_index(q)
        else:
            modules = list(recon._module_index)
        return {'modules': sorted(modules, key=lambda m: m['path'])}

api.add_resource(MarketplaceList, '/marketplace/')


class MarketplaceInst(Resource):

    def get(self, path):
        '''
        Gets info about a specific marketplace module
        ---
        parameters:
          - name: path
            in: path
            required: true
            type: string
        responses:
            200:
                description: Module marketplace info
            404:
                description: Module not found in index
        '''
        recon._update_module_index()
        module = recon._get_module_from_index(path)
        if module is None:
            abort(404)
        return module

    def post(self, path):
        '''
        Installs a module from the marketplace
        ---
        parameters:
          - name: path
            in: path
            required: true
            type: string
        responses:
            200:
                description: Module installed
            404:
                description: Module not found in index
        '''
        recon._update_module_index()
        module = recon._get_module_from_index(path)
        if module is None:
            abort(404)
        try:
            recon._install_module(path)
            recon._do_modules_reload('')
            recon._update_module_index()
        except Exception as e:
            abort(500, str(e))
        return recon._get_module_from_index(path)

    def delete(self, path):
        '''
        Removes an installed marketplace module
        ---
        parameters:
          - name: path
            in: path
            required: true
            type: string
        responses:
            204:
                description: Module removed
            404:
                description: Module not found or not installed
        '''
        recon._update_module_index()
        module = recon._get_module_from_index(path)
        if module is None or module.get('status') not in ('installed', 'disabled', 'outdated'):
            abort(404)
        recon._remove_module(path)
        recon._do_modules_reload('')
        return '', 204

api.add_resource(MarketplaceInst, '/marketplace/<path:path>')


class MarketplaceRefresh(Resource):

    def post(self):
        '''
        Refreshes the marketplace module index from the remote repository
        ---
        responses:
            200:
                description: Index refreshed
        '''
        recon._fetch_module_index()
        recon._update_module_index()
        return {'count': len(recon._module_index)}

api.add_resource(MarketplaceRefresh, '/marketplace/refresh')


class KeyList(Resource):

    def get(self):
        '''
        Gets all API keys from the keystore
        ---
        responses:
            200:
                description: List of API keys (values are returned; mask in the UI)
                schema:
                    properties:
                        keys:
                            type: array
                            items:
                                type: object
                    required:
                    - keys
        '''
        names = recon._get_key_names()
        keys = [{'name': n, 'value': recon.get_key(n)} for n in sorted(names)]
        return {'keys': keys}

    def post(self):
        '''
        Adds or updates an API key in the keystore
        ---
        parameters:
          - name: body
            in: body
            description: Object containing the key name and value
            schema:
                properties:
                    name:
                        type: string
                    value:
                        type: string
                required:
                - name
                - value
        responses:
            201:
                description: Key added
        '''
        name = request.json.get('name')
        value = request.json.get('value')
        if not name or not value:
            abort(400)
        recon.add_key(name, value)
        return {'name': name}, 201

api.add_resource(KeyList, '/keys/')


class KeyInst(Resource):

    def delete(self, name):
        '''
        Removes an API key from the keystore
        ---
        parameters:
          - name: name
            in: path
            description: Name of the key to remove
            required: true
            type: string
        responses:
            204:
                description: Key removed
            404:
                description: Key not found
        '''
        if name not in recon._get_key_names():
            abort(404)
        recon.remove_key(name)
        return '', 204

api.add_resource(KeyInst, '/keys/<string:name>')


# ==============================================================
# TABLE ROW OPERATIONS (insert, delete, notes)
# ==============================================================

class TableSchema(Resource):

    def get(self, table):
        '''Returns the column schema for the specified table'''
        if table not in recon.get_tables():
            abort(404)
        columns = recon.get_columns(table)
        return {'table': table, 'columns': [{'name': c[0], 'type': c[1]} for c in columns]}

api.add_resource(TableSchema, '/tables/<string:table>/schema')


class TableRowList(Resource):

    def post(self, table):
        '''Inserts a row into the specified table'''
        if table not in recon.get_tables():
            abort(404)
        insert_fn = getattr(recon, f'insert_{table}', None)
        if insert_fn is None:
            abort(400)
        record = {k: v or None for k, v in (request.json or {}).items()}
        try:
            rowcount = insert_fn(mute=True, **record)
        except TypeError as e:
            abort(400, str(e))
        return {'inserted': rowcount}, 201

api.add_resource(TableRowList, '/tables/<string:table>/rows')


class TableRowInst(Resource):

    def delete(self, table, rowid):
        '''Deletes the specified row from the table'''
        if table not in recon.get_tables():
            abort(404)
        rowcount = recon.query(f'DELETE FROM {table} WHERE rowid=?', (rowid,))
        if rowcount == 0:
            abort(404)
        return '', 204

    def patch(self, table, rowid):
        '''Updates the notes field on the specified row'''
        if table not in recon.get_tables():
            abort(404)
        notes = (request.json or {}).get('notes', '')
        recon.query(f'UPDATE {table} SET notes=? WHERE rowid=?', (notes, rowid))
        rows = recon.query(f'SELECT rowid, * FROM {table} WHERE rowid=?', (rowid,), include_header=True)
        if not rows or len(rows) < 2:
            abort(404)
        columns = rows[0]
        return columnize(columns, rows[1:])[0]

api.add_resource(TableRowInst, '/tables/<string:table>/rows/<int:rowid>')


class QueryInst(Resource):

    def post(self):
        '''Executes a read-only SQL query against the workspace database'''
        sql = (request.json or {}).get('sql', '').strip()
        if not sql:
            abort(400)
        # only allow SELECT statements for safety
        if not sql.upper().startswith('SELECT'):
            abort(400)
        try:
            rows = recon.query(sql, include_header=True)
        except Exception as e:
            return {'error': str(e)}, 400
        columns = rows.pop(0) if rows else []
        return {
            'columns': columns,
            'rows': columnize(columns, rows),
        }

api.add_resource(QueryInst, '/query')


# ==============================================================
# SNAPSHOTS
# ==============================================================

class SnapshotList(Resource):

    def get(self):
        '''Lists all snapshots for the current workspace'''
        snapshots = sorted(recon._get_snapshots(), reverse=True)
        return {'snapshots': snapshots}

    def post(self):
        '''Takes a snapshot of the current workspace database'''
        ts = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
        name = f'snapshot_{ts}.db'
        src = os.path.join(recon.workspace, 'data.db')
        dst = os.path.join(recon.workspace, name)
        shutil.copyfile(src, dst)
        return {'name': name}, 201

api.add_resource(SnapshotList, '/snapshots/')


class SnapshotInst(Resource):

    def post(self, name):
        '''Loads (restores) a snapshot over the current workspace database'''
        if name not in recon._get_snapshots():
            abort(404)
        src = os.path.join(recon.workspace, name)
        dst = os.path.join(recon.workspace, 'data.db')
        shutil.copyfile(src, dst)
        # reinitialize workspace so the restored DB is live
        recon._init_workspace(current_app.config['WORKSPACE'])
        return {'name': name}

    def delete(self, name):
        '''Deletes a snapshot'''
        if name not in recon._get_snapshots():
            abort(404)
        os.remove(os.path.join(recon.workspace, name))
        return '', 204

api.add_resource(SnapshotInst, '/snapshots/<string:name>')
