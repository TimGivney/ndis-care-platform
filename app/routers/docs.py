import os
import re
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session as OrmSession, joinedload

from ..auth import MANAGERS, audit, get_current_user
from ..db import DB_PATH, get_db
from ..models import Document, Participant, User, Worker

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = os.path.join(os.path.dirname(DB_PATH) or ".", "uploads")
MAX_BYTES = 20 * 1024 * 1024


def doc_out(d: Document) -> dict:
    return {
        "id": d.id, "owner_type": d.owner_type, "owner_id": d.owner_id,
        "filename": d.filename, "content_type": d.content_type,
        "category": d.category,
        "expires_on": d.expires_on.isoformat() if d.expires_on else None,
        "uploaded_by": d.uploader.name if d.uploader else None,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _can_access(user: User, owner_type: str, owner_id: int) -> bool:
    if user.role in MANAGERS:
        return True
    if user.role == "worker":
        return owner_type == "worker" and owner_id == user.worker_id
    if user.role == "participant":
        return owner_type == "participant" and owner_id == user.participant_id
    return False


def _check_owner(db: OrmSession, org_id: int, owner_type: str, owner_id: int):
    model = {"participant": Participant, "worker": Worker}.get(owner_type)
    if not model:
        raise HTTPException(400, "owner_type must be participant or worker")
    obj = db.get(model, owner_id)
    if not obj or obj.org_id != org_id:
        raise HTTPException(400, "Unknown owner")


@router.get("")
def list_documents(owner_type: str, owner_id: int,
                   user: User = Depends(get_current_user),
                   db: OrmSession = Depends(get_db)):
    if not _can_access(user, owner_type, owner_id):
        raise HTTPException(403, "No access to these documents")
    _check_owner(db, user.org_id, owner_type, owner_id)
    docs = db.query(Document).options(joinedload(Document.uploader)).filter(
        Document.org_id == user.org_id, Document.owner_type == owner_type,
        Document.owner_id == owner_id, Document.deleted == False,
    ).order_by(Document.id.desc()).all()
    return {"documents": [doc_out(d) for d in docs]}


@router.post("")
async def upload_document(
    owner_type: str = Form(...), owner_id: int = Form(...),
    category: str | None = Form(None), expires_on: date | None = Form(None),
    file: UploadFile = ...,
    user: User = Depends(get_current_user),
    db: OrmSession = Depends(get_db),
):
    if not _can_access(user, owner_type, owner_id):
        raise HTTPException(403, "No access to these documents")
    _check_owner(db, user.org_id, owner_type, owner_id)
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "File too large (20 MB max)")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(file.filename or "file"))
    stored = f"{uuid.uuid4().hex}_{safe}"
    with open(os.path.join(UPLOAD_DIR, stored), "wb") as f:
        f.write(data)
    d = Document(org_id=user.org_id, owner_type=owner_type, owner_id=owner_id,
                 uploaded_by=user.id, filename=file.filename or safe,
                 stored_name=stored, content_type=file.content_type,
                 category=category or None, expires_on=expires_on)
    db.add(d)
    db.flush()
    audit(db, user, "create", "document", d.id, d.filename)
    db.commit()
    return {"document": doc_out(d)}


@router.get("/{did}/file")
def download(did: int, user: User = Depends(get_current_user),
             db: OrmSession = Depends(get_db)):
    d = db.get(Document, did)
    if not d or d.org_id != user.org_id or d.deleted:
        raise HTTPException(404, "Not found")
    if not _can_access(user, d.owner_type, d.owner_id):
        raise HTTPException(403, "No access to this document")
    path = os.path.join(UPLOAD_DIR, d.stored_name)
    if not os.path.isfile(path):
        raise HTTPException(404, "File missing")
    audit(db, user, "view", "document", d.id)
    db.commit()
    return FileResponse(path, filename=d.filename,
                        media_type=d.content_type or "application/octet-stream")


@router.delete("/{did}")
def delete_document(did: int, user: User = Depends(get_current_user),
                    db: OrmSession = Depends(get_db)):
    d = db.get(Document, did)
    if not d or d.org_id != user.org_id or d.deleted:
        raise HTTPException(404, "Not found")
    if user.role not in MANAGERS and d.uploaded_by != user.id:
        raise HTTPException(403, "Only managers or the uploader can delete")
    d.deleted = True
    audit(db, user, "delete", "document", d.id)
    db.commit()
    return {"ok": True}
