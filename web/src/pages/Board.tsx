import { useEffect, useState } from "react";

import { del, get, post, put } from "../lib/api";
import { Post } from "../lib/types";
import { Badge, Btn, Card, Field, Page, inputCls } from "../lib/ui";
import { useAuth } from "../App";

export default function Board() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const isManager = user?.role === "admin" || user?.role === "manager";

  const load = () =>
    get<{ posts: Post[] }>("/api/posts").then((r) => setPosts(r.posts));

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    await post("/api/posts", { title, body, pinned });
    setTitle("");
    setBody("");
    setPinned(false);
    setShowForm(false);
    load();
  };

  return (
    <Page
      title="Noticeboard"
      actions={
        isManager ? (
          <Btn onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "New post"}
          </Btn>
        ) : undefined
      }
    >
      {showForm && (
        <Card className="mb-4">
          <div className="space-y-3">
            <Field label="Title">
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Message">
              <textarea
                className={inputCls}
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              Pin to top
            </label>
            <Btn onClick={submit} disabled={!title.trim() || !body.trim()}>
              Post to board
            </Btn>
          </div>
        </Card>
      )}

      {posts.length === 0 && (
        <Card>
          <p className="text-center text-slate-500">
            Nothing posted yet — check back soon.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {posts.map((p) => (
          <Card key={p.id} className={p.pinned ? "border-teal-300 bg-teal-50" : ""}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  {p.pinned && <Badge tone="blue">Pinned</Badge>}
                  <h2 className="font-semibold text-slate-800">{p.title}</h2>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {p.author_name} ·{" "}
                  {p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}
                </p>
              </div>
              {isManager && (
                <div className="flex shrink-0 gap-2">
                  <button
                    className="text-xs text-slate-400 hover:text-teal-700"
                    onClick={() => put(`/api/posts/${p.id}/pin`).then(load)}
                  >
                    {p.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    className="text-xs text-slate-400 hover:text-red-600"
                    onClick={() => del(`/api/posts/${p.id}`).then(load)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {p.body}
            </p>
          </Card>
        ))}
      </div>
    </Page>
  );
}
