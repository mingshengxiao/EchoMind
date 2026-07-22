"""Vercel serverless entry-point for the FastAPI backend.

The backend source lives under ``backend/app/``.  Vercel's Python runtime
bundles sibling directories of the function file, so ``backend/`` is
available at run-time.  We prepend it to ``sys.path`` so that all existing
``from app.xxx import yyy`` imports resolve correctly without touching the
backend source code.
"""

import os
import sys

# Ensure ``backend/`` is on the import path so that ``from app.…`` works.
_BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.main import app  # noqa: E402, F401
