import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .db import Base, SessionLocal, engine
from .routers import auth as auth_router
from .routers import ops as ops_router
from .routers import people as people_router
from .routers import roster as roster_router
from .seed import seed_if_empty

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
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


# Serve the SPA: real files first, everything else falls back to index.html
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
    uvicorn.run("app.main:app", host="0.0.0.0",
                port=int(os.environ.get("PORT", "8000")))
