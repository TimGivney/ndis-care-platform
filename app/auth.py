import secrets
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request, Response, status
from pwdlib import PasswordHash
from sqlalchemy.orm import Session as OrmSession

from .db import get_db
from .models import AuditLog, Session, User

password_hash = PasswordHash.recommended()

SESSION_COOKIE = "ndis_session"
SESSION_DAYS = 7


def hash_password(pw: str) -> str:
    return password_hash.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return password_hash.verify(pw, hashed)
    except Exception:
        return False


def create_session(db: OrmSession, user: User, response: Response) -> Session:
    token = secrets.token_urlsafe(32)
    sess = Session(
        token=token, user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=SESSION_DAYS),
    )
    db.add(sess)
    db.commit()
    response.set_cookie(
        SESSION_COOKIE, token, max_age=SESSION_DAYS * 86400,
        httponly=True, samesite="lax", path="/",
    )
    return sess


def get_current_user(request: Request, db: OrmSession = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")
    sess = db.query(Session).filter(Session.token == token).first()
    if not sess or sess.revoked or sess.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    user = db.get(User, sess.user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account disabled")
    return user


def require_roles(*roles: str):
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return dep


MANAGERS = ("admin", "manager")


def audit(db: OrmSession, user: User | None, action: str, entity: str,
          entity_id: int | None = None, detail: str | None = None,
          org_id: int | None = None):
    db.add(AuditLog(
        org_id=org_id or (user.org_id if user else 0),
        user_id=user.id if user else None,
        user_name=user.name if user else None,
        action=action, entity=entity, entity_id=entity_id, detail=detail,
    ))
