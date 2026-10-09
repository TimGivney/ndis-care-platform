import { useEffect, useRef, useState } from "react";

import { get, post } from "../lib/api";
import { Conversation, Message } from "../lib/types";
import { Btn, Card, Page, inputCls } from "../lib/ui";

export default function Messages() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConvs = () =>
    get<{ conversations: Conversation[] }>("/api/messages/conversations")
      .then((r) => setConvs(r.conversations));

  const loadThread = (uid: number) =>
    get<{ messages: Message[] }>(`/api/messages?with_id=${uid}`)
      .then((r) => setThread(r.messages));

  useEffect(() => {
    loadConvs();
    const t = setInterval(loadConvs, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (active == null) return;
    loadThread(active);
    const t = setInterval(() => {
      loadThread(active);
      loadConvs();
    }, 10000);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  const send = async () => {
    if (!draft.trim() || active == null) return;
    await post("/api/messages", { recipient_id: active, body: draft.trim() });
    setDraft("");
    loadThread(active);
    loadConvs();
  };

  const activeConv = convs.find((c) => c.user_id === active);

  return (
    <Page title="Messages">
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto p-2">
          {convs.map((c) => (
            <button
              key={c.user_id}
              onClick={() => setActive(c.user_id)}
              className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                active === c.user_id
                  ? "bg-teal-100 text-teal-900"
                  : "hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                {c.unread > 0 && (
                  <span className="rounded-full bg-teal-600 px-2 text-xs font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-slate-500">
                {c.role} · {c.last_message?.body ?? "Start a conversation"}
              </div>
            </button>
          ))}
        </Card>

        <Card className="flex h-[70vh] flex-col">
          {active == null ? (
            <div className="flex flex-1 items-center justify-center text-slate-400">
              Pick someone on the left to start chatting
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 pb-2 text-sm font-semibold text-teal-900">
                {activeConv?.name}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {activeConv?.role}
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto py-3">
                {thread.length === 0 && (
                  <p className="text-center text-sm text-slate-400">
                    No messages yet — say hi!
                  </p>
                )}
                {thread.map((m) => {
                  const mine = m.sender_id !== active;
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "ml-auto bg-teal-600 text-white"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div
                        className={`mt-0.5 text-right text-[10px] ${
                          mine ? "text-teal-100" : "text-slate-400"
                        }`}
                      >
                        {m.created_at
                          ? new Date(m.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="flex gap-2 border-t border-slate-100 pt-2">
                <input
                  className={inputCls}
                  placeholder="Type a message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                <Btn onClick={send} disabled={!draft.trim()}>
                  Send
                </Btn>
              </div>
            </>
          )}
        </Card>
      </div>
    </Page>
  );
}
