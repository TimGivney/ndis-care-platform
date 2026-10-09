import { useEffect, useRef, useState } from "react";

import { del, get, upload } from "./api";
import { Doc } from "./types";
import { Btn, Card, inputCls } from "./ui";

export default function DocumentsCard({ ownerType, ownerId, canManage }: {
  ownerType: "participant" | "worker";
  ownerId: number;
  canManage: boolean;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [category, setCategory] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    get<{ documents: Doc[] }>(
      `/api/documents?owner_type=${ownerType}&owner_id=${ownerId}`,
    ).then((r) => setDocs(r.documents)).catch(() => {});

  useEffect(() => {
    if (ownerId) load();
  }, [ownerId]);

  const doUpload = async (f: File) => {
    const form = new FormData();
    form.append("owner_type", ownerType);
    form.append("owner_id", String(ownerId));
    if (category) form.append("category", category);
    if (expiresOn) form.append("expires_on", expiresOn);
    form.append("file", f);
    try {
      await upload("/api/documents", form);
      setCategory("");
      setExpiresOn("");
      setErr("");
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <Card>
      <h3 className="mb-2 font-semibold text-slate-800">Documents</h3>
      {docs.length === 0 && (
        <p className="mb-2 text-sm text-slate-400">No documents yet.</p>
      )}
      <ul className="mb-3 divide-y divide-slate-100">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <div className="min-w-0">
              <a
                className="font-medium text-teal-700 hover:underline"
                href={`/api/documents/${d.id}/file`}
              >
                {d.filename}
              </a>
              <div className="text-xs text-slate-400">
                {d.category ?? "file"}
                {d.expires_on ? ` · expires ${d.expires_on}` : ""}
                {d.uploaded_by ? ` · by ${d.uploaded_by}` : ""}
              </div>
            </div>
            {canManage && (
              <button
                className="shrink-0 text-xs text-slate-400 hover:text-red-600"
                onClick={() => del(`/api/documents/${d.id}`).then(load)}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputCls} max-w-[140px]`}
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            className={`${inputCls} max-w-[150px]`}
            type="date"
            title="Expiry (optional)"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doUpload(f);
              e.target.value = "";
            }}
          />
          <Btn kind="ghost" onClick={() => fileRef.current?.click()}>
            Upload file
          </Btn>
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>
      )}
    </Card>
  );
}
