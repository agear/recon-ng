# The Recon-ng Framework (Web UI Fork)

> **This is a fork of [lanmaster53/recon-ng](https://github.com/lanmaster53/recon-ng)** that adds a modern React-based web UI for managing workspaces, modules, keys, and reconnaissance jobs through a browser — on top of the existing Flask REST API and RQ worker backend.

## Building and Running This Fork

### Prerequisites

- Python 3
- Node.js 18+ and npm
- Redis (for background job execution)

### Quick Start

**1. Create and activate a virtual environment:**

```bash
python3 -m venv venv
source venv/bin/activate
```

**2. Install Python dependencies:**

```bash
pip install -r REQUIREMENTS
```

**3. Build the frontend** (React/TypeScript → compiled into `recon/core/web/static/dist/`):

```bash
cd frontend
npm install
npm run build
cd ..
```

**4. Start everything with `start.sh`:**

```bash
./start.sh
```

This activates the venv, starts Redis, starts an RQ worker, and launches the Flask web server. Press `Ctrl+C` to shut everything down cleanly.

Then open `http://localhost:5000` in your browser.

### Frontend Development

To run the Vite dev server with hot module reloading (proxies API calls to `localhost:5000`):

```bash
cd frontend
npm run dev
```

### Docker (all-in-one)

```bash
docker-compose up
```

This starts the Flask web server, RQ worker, and Redis together. The UI is served at `http://localhost:5000`.

---

[Recon-ng content now available on Pluralsight!](https://app.pluralsight.com/library/courses/technical-information-gathering-recon-ng)

Recon-ng is a full-featured reconnaissance framework designed with the goal of providing a powerful environment to conduct open source web-based reconnaissance quickly and thoroughly.

Recon-ng has a look and feel similar to the Metasploit Framework, reducing the learning curve for leveraging the framework. However, it is quite different. Recon-ng is not intended to compete with existing frameworks, as it is designed exclusively for web-based open source reconnaissance. If you want to exploit, use the Metasploit Framework. If you want to social engineer, use the Social-Engineer Toolkit. If you want to conduct reconnaissance, use Recon-ng! See the [Wiki](https://github.com/lanmaster53/recon-ng/wiki) to get started.

Recon-ng is a completely modular framework and makes it easy for even the newest of Python developers to contribute. See the [Development Guide](https://github.com/lanmaster53/recon-ng/wiki/Development-Guide) for more information on building and maintaining modules.

## Sponsors

[![Black Hills Information Security](https://www.blackhillsinfosec.com/wp-content/uploads/2016/03/BHIS-logo-web.png)](http://www.blackhillsinfosec.com)

<br>

[![Practical Security Services](https://www.practisec.com/static/images/imgs/sticky-logo.png)](http://www.practisec.com)

## Donations

Recon-ng is free software. However, large amounts of time and effort go into its continued development. If you are interested in financially supporting the project, you can view and assist in marketing the [Pluralsight content](https://app.pluralsight.com/library/courses/technical-information-gathering-recon-ng), or send a donation to tjt1980[at]gmail.com via PayPal. Thank you.
