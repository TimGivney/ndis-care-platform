"""Root shim — the real app lives in app/main.py (deployer requirement)."""
import os

from app.main import app  # noqa: F401


def run():
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0",
                port=int(os.environ.get("PORT", "8000")))


if __name__ == "__main__":
    run()
