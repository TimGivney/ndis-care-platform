import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DB_PATH = os.environ.get(
    "NDIS_DB_PATH",
    "/data/app.db" if os.path.isdir("/data") else "data/app.db",
)
os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _):
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=WAL")
    cur.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate():
    """Add columns introduced after a table was created (SQLite has no
    create_all migrations). Safe to run on every boot."""
    wanted = {
        "users": [("quiet_start", "VARCHAR(5)"), ("quiet_end", "VARCHAR(5)")],
        "shifts": [("support_item_code", "VARCHAR(60)")],
    }
    with engine.begin() as conn:
        for table, cols in wanted.items():
            existing = {r[1] for r in conn.exec_driver_sql(
                f"PRAGMA table_info({table})")}
            for name, ddl in cols:
                if name not in existing:
                    conn.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
