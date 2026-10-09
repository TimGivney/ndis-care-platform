from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session as OrmSession, joinedload

from ..auth import MANAGERS, audit, get_current_user, notify, require_roles
from ..db import get_db
from ..models import Message, Notification, Post, User
from ..schemas import MessageIn, PostIn

router = APIRouter(prefix="/api", tags=["comms"])


def message_out(m: Message) -> dict:
    return {
        "id": m.id, "sender_id": m.sender_id,
        "sender_name": m.sender.name if m.sender else None,
        "recipient_id": m.recipient_id,
        "recipient_name": m.recipient.name if m.recipient else None,
        "body": m.body,
        "read_at": m.read_at.isoformat() if m.read_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


# ---------- messages ----------

@router.get("/messages/conversations")
def conversations(user: User = Depends(get_current_user),
                  db: OrmSession = Depends(get_db)):
    others = db.query(User).filter(
        User.org_id == user.org_id, User.is_active == True,
        User.id != user.id).order_by(User.name).all()
    msgs = db.query(Message).filter(
        Message.org_id == user.org_id,
        or_(Message.sender_id == user.id, Message.recipient_id == user.id),
    ).order_by(Message.id.desc()).all()
    last: dict[int, Message] = {}
    unread: dict[int, int] = {}
    for m in msgs:
        other = m.recipient_id if m.sender_id == user.id else m.sender_id
        if other not in last:
            last[other] = m
        if m.recipient_id == user.id and m.read_at is None:
            unread[other] = unread.get(other, 0) + 1
    return {"conversations": [{
        "user_id": u.id, "name": u.name, "role": u.role,
        "last_message": message_out(last[u.id]) if u.id in last else None,
        "unread": unread.get(u.id, 0),
    } for u in others]}


@router.get("/messages")
def thread(with_id: int, user: User = Depends(get_current_user),
           db: OrmSession = Depends(get_db)):
    other = db.get(User, with_id)
    if not other or other.org_id != user.org_id:
        raise HTTPException(404, "User not found")
    msgs = db.query(Message).options(
        joinedload(Message.sender), joinedload(Message.recipient)
    ).filter(
        Message.org_id == user.org_id,
        or_(
            and_(Message.sender_id == user.id, Message.recipient_id == with_id),
            and_(Message.sender_id == with_id, Message.recipient_id == user.id),
        ),
    ).order_by(Message.id).limit(500).all()
    now = datetime.utcnow()
    for m in msgs:
        if m.recipient_id == user.id and m.read_at is None:
            m.read_at = now
    db.commit()
    return {"messages": [message_out(m) for m in msgs]}


@router.post("/messages")
def send_message(body: MessageIn, user: User = Depends(get_current_user),
                 db: OrmSession = Depends(get_db)):
    other = db.get(User, body.recipient_id)
    if not other or other.org_id != user.org_id:
        raise HTTPException(404, "User not found")
    m = Message(org_id=user.org_id, sender_id=user.id,
                recipient_id=other.id, body=body.body)
    db.add(m)
    db.flush()
    notify(db, user.org_id, other.id, "message",
           f"Message from {user.name}", body.body[:200], "/messages")
    audit(db, user, "create", "message", m.id)
    db.commit()
    db.refresh(m)
    m.sender = user
    m.recipient = other
    return {"message": message_out(m)}


# ---------- noticeboard ----------

def post_out(p: Post) -> dict:
    return {
        "id": p.id, "title": p.title, "body": p.body, "pinned": p.pinned,
        "author_name": p.author.name if p.author else None,
        "author_id": p.author_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/posts")
def list_posts(user: User = Depends(get_current_user),
               db: OrmSession = Depends(get_db)):
    posts = db.query(Post).options(joinedload(Post.author)).filter(
        Post.org_id == user.org_id, Post.deleted == False
    ).order_by(Post.pinned.desc(), Post.id.desc()).limit(100).all()
    return {"posts": [post_out(p) for p in posts]}


@router.post("/posts")
def create_post(body: PostIn,
                user: User = Depends(require_roles(*MANAGERS)),
                db: OrmSession = Depends(get_db)):
    p = Post(org_id=user.org_id, author_id=user.id, **body.model_dump())
    db.add(p)
    db.flush()
    others = db.query(User).filter(
        User.org_id == user.org_id, User.is_active == True,
        User.id != user.id).all()
    for u in others:
        notify(db, user.org_id, u.id, "post",
               f"Noticeboard: {p.title}", p.body[:200], "/board")
    audit(db, user, "create", "post", p.id, p.title)
    db.commit()
    return {"post": post_out(p)}


@router.put("/posts/{pid}/pin")
def pin_post(pid: int, user: User = Depends(require_roles(*MANAGERS)),
             db: OrmSession = Depends(get_db)):
    p = db.get(Post, pid)
    if not p or p.org_id != user.org_id:
        raise HTTPException(404, "Not found")
    p.pinned = not p.pinned
    db.commit()
    return {"post": post_out(p)}


@router.delete("/posts/{pid}")
def delete_post(pid: int, user: User = Depends(get_current_user),
                db: OrmSession = Depends(get_db)):
    p = db.get(Post, pid)
    if not p or p.org_id != user.org_id or p.deleted:
        raise HTTPException(404, "Not found")
    if user.role not in MANAGERS and p.author_id != user.id:
        raise HTTPException(403, "Not your post")
    p.deleted = True
    audit(db, user, "delete", "post", pid)
    db.commit()
    return {"ok": True}


# ---------- notifications ----------

def notif_out(n: Notification) -> dict:
    return {
        "id": n.id, "kind": n.kind, "title": n.title, "body": n.body,
        "link": n.link,
        "read": n.read_at is not None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("/notifications")
def list_notifications(user: User = Depends(get_current_user),
                       db: OrmSession = Depends(get_db)):
    rows = db.query(Notification).filter(
        Notification.user_id == user.id
    ).order_by(Notification.id.desc()).limit(50).all()
    unread = db.query(Notification).filter(
        Notification.user_id == user.id, Notification.read_at == None).count()
    return {"notifications": [notif_out(n) for n in rows],
            "unread_count": unread}


@router.post("/notifications/{nid}/read")
def read_notification(nid: int, user: User = Depends(get_current_user),
                      db: OrmSession = Depends(get_db)):
    n = db.get(Notification, nid)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Not found")
    n.read_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
def read_all(user: User = Depends(get_current_user),
             db: OrmSession = Depends(get_db)):
    now = datetime.utcnow()
    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.read_at == None).update({"read_at": now})
    db.commit()
    return {"ok": True}
