# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FoodSaver Connect is a Django 4.2 web application for real-time food rescue — connecting surplus food donors with needy locations via volunteer scouts. It uses Django REST Framework for the API and a single-page frontend served via Django templates with Leaflet.js maps.

## Commands

```bash
# Install dependencies (no requirements.txt exists yet — these are the needed packages)
pip install django djangorestframework pillow

# Run development server
python manage.py runserver

# Apply migrations
python manage.py migrate

# Create migrations after model changes
python manage.py makemigrations core

# Run tests
python manage.py test core

# Create superuser for admin access
python manage.py createsuperuser
```

Database: SQLite (db.sqlite3). No external services required for local development.

## Architecture

**Django project: `foodsaver/`** — Settings, root URL config, WSGI/ASGI entry points.

**Single app: `core/`** — Contains all application logic:

- **Models** (`core/models.py`): Four models centered around the food rescue workflow:
  - `FoodListing` — donor posts surplus food (has lat/lng for self-delivery)
  - `NeedyLocation` — scout-reported locations needing food (auto-expires after 4 hours, deduplicates within ~200m)
  - `DeliveryTask` — links a FoodListing to a NeedyLocation with a scout, tracks delivery lifecycle
  - `ScoutBookmark` — saved locations per scout user

- **API** (`core/views.py`, `core/urls.py`): DRF ModelViewSet-based REST API mounted at `/api/`:
  - `/api/food/` — FoodListing CRUD
  - `/api/locations/` — NeedyLocation CRUD (filters to active, non-expired only). Custom actions: `POST .../refresh/` (extend expiry 2h), `POST .../accept/`
  - `/api/tasks/` — DeliveryTask CRUD. Custom actions: `POST .../claim/`, `POST .../complete/` (both update linked NeedyLocation status)
  - `/api/bookmarks/` — ScoutBookmark CRUD (filtered to authenticated user)
  - `/api/stats/` — Dashboard aggregate stats
  - `/api/scout-stats/` — Scout performance metrics with gamification (karma, ranks, badges)

- **Frontend** (`core/templates/core/index.html`, `core/static/core/`): Single HTML template with vanilla JS. Uses Leaflet + MarkerCluster + Leaflet.heat for map visualization. Polls `/api/stats/` every 30s.

**Key behaviors:**
- Auth falls back to `User.objects.first()` or creates a `demo_donor` user when unauthenticated — this is intentional for demo/dev purposes.
- Stats endpoints return hardcoded fallback values when DB has no data.
- NeedyLocation creation rejects locations within ~200m of existing active ones (raises 409).
- Django admin is registered for FoodListing, NeedyLocation, and DeliveryTask at `/admin/`.
