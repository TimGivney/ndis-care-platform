"""Entrypoint for deployment: exposes `app` at top level (uvicorn main:app)."""
from app.main import app  # noqa: F401

if __name__ == "__main__":
    import os

    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
