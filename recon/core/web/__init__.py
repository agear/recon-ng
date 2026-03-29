from flask import Flask, cli, send_from_directory
import os
from flasgger import Swagger
from recon.core import base
from recon.core.constants import BANNER_WEB
from recon.core.web.db import Tasks
from redis import Redis
import os
import rq

# disable the development server warning banner
cli.show_server_banner = lambda *x: None

print(BANNER_WEB)

# create an application-wide framework and tasks instance
recon = base.Recon(check=False, analytics=False, marketplace=True)
recon.start(base.Mode.WEB)
tasks = Tasks(recon)

# configuration
DEBUG = False
SECRET_KEY = 'we keep no secrets here.'
JSON_SORT_KEYS = False
REDIS_URL = os.environ.get('REDIS_URL', 'redis://')
SWAGGER = {
    'title': 'Swagger',
    'info': {
        'title': 'Recon-API',
        'description': 'A RESTful API for Recon-ng',
        'version': '0.0.1',
    },
    'uiversion': 3,
    'specs_route': '/api/',
}
WORKSPACE = recon.workspace.split('/')[-1]
print((f" * Workspace initialized: {WORKSPACE}"))

def create_app():

    app = Flask(__name__, static_folder=None)
    app.config.from_object(__name__)

    Swagger(app, template_file='definitions.yaml')

    app.redis = Redis.from_url(app.config['REDIS_URL'])
    app.task_queue = rq.Queue('recon-tasks', connection=app.redis)

    @app.after_request
    def disable_cache(response):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response

    dist_dir = os.path.join(os.path.dirname(__file__), 'static', 'dist')

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def index(path):
        # Serve real files (JS, CSS, assets) from dist/, fall back to index.html for SPA routing
        if path and os.path.isfile(os.path.join(dist_dir, path)):
            return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, 'index.html')

    from recon.core.web.api import resources
    app.register_blueprint(resources)

    return app
