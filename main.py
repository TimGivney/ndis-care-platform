"""NDIS Care Platform — FastAPI entrypoint.

Serves /api/* routers plus the built SPA from app/static.
Run: uvicorn main:app --host 0.0.0.0 --port $PORT
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.db import Base, SessionLocal, engine
from app.routers import auth as auth_router
from app.routers import ops as ops_router
from app.routers import people as people_router
from app.routers import roster as roster_router
from app.seed import seed_if_empty

STATIC_DIR = Path(__file__).parent / "app" / "static"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(title="NDIS Care Platform", lifespan=lifespan)

app.include_router(auth_router.router)
app.include_router(people_router.router)
app.include_router(roster_router.router)
app.include_router(ops_router.router)


@app.get("/api/health")
def health():
    return {"ok": True}


if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"),
              name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")


def run():
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0",
                port=int(os.environ.get("PORT", "8000")))


if __name__ == "__main__":
    run()
