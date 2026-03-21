# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FoodSaver Connect is a Django 4.2 web application for real-time food rescue — connecting surplus food donors with needy locations via volunteer scouts. It uses Django REST Framework for the API, Django's built-in auth for signup/signin, and a Bootstrap-based frontend served via Django templates with Leaflet.js maps.

## Commands

```bash
# Install dependencies
pip install django djangorestframework pillow

# Apply migrations
python manage.py migrate

# Run development server
python manage.py runserver 8000

# Create migrations after model changes
python manage.py makemigrations core

# Run tests
python manage.py test core

# Create superuser for admin access
python manage.py createsuperuser
```

Database: SQLite (db.sqlite3). No external services required for local development.

## Project Structure

```
├── manage.py                   # Django entry point
├── foodsaver/                  # Django project config (backend)
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── core/                       # Django app (backend)
│   ├── models.py               # FoodListing, NeedyLocation, DeliveryTask, ScoutBookmark
│   ├── views.py                # Auth views + DRF API viewsets
│   ├── urls.py                 # URL routing (pages + API)
│   ├── serializers.py          # DRF serializers
│   ├── admin.py                # Admin registration
│   ├── static/core/            # Dashboard CSS & JS
│   │   ├── css/styles.css      # Base dashboard styles
│   │   ├── css/theme-light.css # Light theme override + utility classes
│   │   ├── css/effects.css     # Bottom navbar + layout
│   │   ├── js/script.js        # Dashboard interactivity
│   │   └── js/effects.js       # Bottom nav tab switching
│   └── templates/core/         # Django templates
│       ├── index.html          # Dashboard (requires login)
│       ├── landing.html        # Landing page
│       ├── signin.html         # Sign in page
│       └── signup.html         # Sign up page
├── frontend/                   # Landing page static assets
│   ├── css/                    # Bootstrap, FontAwesome, custom landing CSS
│   ├── js/                     # jQuery, Bootstrap JS, landing page scripts
│   ├── fonts/                  # Icon fonts (FontAwesome, Linearicons)
│   └── img/                    # Landing page images
└── assets/
    └── effects/                # UI effect templates (gooey, magnet)
```

## Architecture

**Backend: `foodsaver/` + `core/`**

- **Models** (`core/models.py`): Four models centered around the food rescue workflow:
  - `FoodListing` — donor posts surplus food (has lat/lng for self-delivery)
  - `NeedyLocation` — scout-reported locations needing food (auto-expires after 4 hours, deduplicates within ~200m)
  - `DeliveryTask` — links a FoodListing to a NeedyLocation with a scout, tracks delivery lifecycle
  - `ScoutBookmark` — saved locations per scout user

- **Auth** (`core/views.py`): Django's built-in auth system — `signup_view`, `signin_view`, `signout_view`, `dashboard_view` (login required). Uses email as username.

- **API** (`core/views.py`, `core/urls.py`): DRF ViewSet-based REST API at `/api/`:
  - `/api/food/` — FoodListing CRUD
  - `/api/locations/` — NeedyLocation CRUD (filters to active, non-expired). Custom actions: `refresh/`, `accept/`
  - `/api/tasks/` — DeliveryTask CRUD. Custom actions: `claim/`, `complete/`
  - `/api/bookmarks/` — ScoutBookmark CRUD (filtered to authenticated user)
  - `/api/stats/` — Dashboard aggregate stats
  - `/api/scout-stats/` — Scout performance metrics with gamification

**Frontend: `frontend/` + `core/templates/` + `core/static/`**

- Landing page uses Bootstrap + Poppins font + custom CSS from `frontend/`
- Dashboard uses the same light theme (`#61D2B4` green palette) with bottom navigation bar
- Maps use Leaflet + MarkerCluster + Leaflet.heat

## URL Routes

| URL | View | Auth Required |
|-----|------|--------------|
| `/` | Landing page | No |
| `/signup/` | Sign up | No |
| `/signin/` | Sign in | No |
| `/signout/` | Log out | No |
| `/dashboard/` | Dashboard | Yes |
| `/admin/` | Django admin | Superuser |
| `/api/...` | REST API | Varies |

## Key Behaviors

- Auth views redirect authenticated users to `/dashboard/` automatically.
- API viewsets fall back to `User.objects.first()` or create a `demo_donor` user when unauthenticated (demo/dev purposes).
- Stats endpoints return hardcoded fallback values when DB has no data.
- NeedyLocation creation rejects locations within ~200m of existing active ones (409).
