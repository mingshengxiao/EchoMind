"""Vercel serverless entry-point for the FastAPI backend.

The backend source lives under ``backend/app/``.  Vercel's Python runtime
may flatten the function directory, so we try multiple strategies to locate
the ``backend/`` directory at import time.  All resolve to the same
``<project-root>/backend/`` path under normal conditions.
"""

import os
import sys

# Strategy 1: resolve relative to this file (works in most runtimes).
# Strategy 2: resolve relative to the current working directory (works when
#   Vercel sets cwd to the project root, e.g. the @vercel/python builder).
_BACKEND_DIR = None
_candidates = [
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"),  # from file
    os.path.join(os.getcwd(), "backend"),                                 # from cwd
]
_seen = set()
for _candidate in _candidates:
    _resolved = os.path.realpath(_candidate)
    if _resolved not in _seen and os.path.isdir(os.path.join(_resolved, "app")):
        _BACKEND_DIR = _resolved
        break
    _seen.add(_resolved)

if _BACKEND_DIR is None:
    raise RuntimeError(
        f"Cannot locate backend/ directory. Tried: {_candidates} "
        f"(resolved: {list(_seen)})"
    )

if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.main import app  # noqa: E402, F401
