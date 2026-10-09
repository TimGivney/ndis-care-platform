from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session as OrmSession

from ..auth import (
    MANAGERS, SESSION_COOKIE, audit, create_session, get_current_user,
    hash_password, require_roles, verify_password,
)
from ..db import get_db
from ..models import Session as Sess, User
from ..schemas import LoginIn, UserIn

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_out(u: User) -> dict:
    return {
        "id": u.id, "name": u.name, "email": u.email, "role": u.role,
        "org_id": u.org_id, "worker_id": u.worker_id,
        "participant_id": u.participant_id,
    }


@router.post("/login")
def login(body: LoginIn, response: Response, db: OrmSession = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    create_session(db, user, response)
    audit(db, user, "login", "user", user.id)
    db.commit()
    return {"user": user_out(user)}


@router.post("/logout")
def logout(response: Response, user: User = Depends(get_current_user),
           db: OrmSession = Depends(get_db)):
    sess = db.query(Sess).filter(Sess.user_id == user.id, Sess.revoked == False) \
        .order_by(Sess.id.desc()).first()
    if sess:
        sess.revoked = True
    audit(db, user, "logout", "user", user.id)
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"user": user_out(user)}


@router.get("/users")
def list_users(user: User = Depends(require_roles(*MANAGERS)),
               db: OrmSession = Depends(get_db)):
    users = db.query(User).filter(User.org_id == user.org_id).all()
    return {"users": [user_out(u) | {"is_active": u.is_active} for u in users]}


@router.post("/users")
def create_user(body: UserIn, user: User = Depends(require_roles(*MANAGERS)),
                db: OrmSession = Depends(get_db)):
    if body.role not in ("admin", "manager", "worker", "participant"):
        raise HTTPException(400, "Invalid role")
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(400, "Email already in use")
    u = User(
        org_id=user.org_id, email=body.email.lower(), name=body.name,
        password_hash=hash_password(body.password), role=body.role,
        worker_id=body.worker_id, participant_id=body.participant_id,
    )
    db.add(u)
    db.flush()
    audit(db, user, "create", "user", u.id, f"Created {u.role} account {u.email}")
    db.commit()
    return {"user": user_out(u)}


@router.post("/users/{uid}/deactivate")
def deactivate_user(uid: int, user: User = Depends(require_roles(*MANAGERS)),
                    db: OrmSession = Depends(get_db)):
    u = db.get(User, uid)
    if not u or u.org_id != user.org_id:
        raise HTTPException(404, "Not found")
    u.is_active = False
    db.query(Sess).filter(Sess.user_id == u.id).update({"revoked": True})
    audit(db, user, "deactivate", "user", u.id)
    db.commit()
    return {"ok": True}
