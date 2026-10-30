// notes.js — trang "Ghi chú" mở ở /notes.
// Hai chế độ xem: "split" (danh sách bên trái, nội dung bên phải) và "stack" (tất cả ghi chú liền nhau: tiêu đề rồi nội dung).
// Lưu trên trình duyệt trước; có cấu hình đồng bộ thì đẩy lên tab "Notes" của Google Sheet.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiBaseOf, apiGet, apiPost, chunkText, getWords, WORDS_EVENT, WORDS_KEY } from "./translateLib";
import { buildSavedMatcher, highlightSaved, hoverSavedHandlers, swipeSelectHandlers, wordSelectHandlers } from "./assLayer";
import TranslatePopup from "./translatePopup";

const NOTES_KEY = "cctNotes";
const VIEW_KEY = "cctNotesView"; // "split" | "stack"

const loadNotes = () => {
  try {
    const list = JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
    return Array.isArray(list) ? list.filter((n) => n && n.id) : [];
  } catch (e) {
    return [];
  }
};
const saveNotes = (list) => {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(list));
  } catch (e) {}
};
const loadView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === "stack" ? "stack" : "split";
  } catch (e) {
    return "split";
  }
};
const saveView = (v) => {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch (e) {}
};
const sortNotes = (list) => [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// Tách dòng thành các câu, mỗi câu kết thúc bằng . ! ? … (giữ khoảng trắng đầu câu)
// Chỉ tách khi dấu kết thúc câu đứng sau nó là khoảng trắng hoặc cuối dòng (không tách React.js, Node.js, v1.2...)
const splitSentences = (line) => {
  const out = [];
  const re = /[.!?…]+(?=\s|$)/g;
  let start = 0;
  let m;
  while ((m = re.exec(line))) {
    const end = m.index + m[0].length;
    out.push(line.slice(start, end));
    start = end;
  }
  if (start < line.length) out.push(line.slice(start));
  return out.filter((p) => p.trim());
};
const fmtClock = (sec) => {
  const t = Math.floor(sec || 0);
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
};
const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString("vi-VN") : "");
// Ghi chú cũ chưa có ngày tạo thì dùng ngày cập nhật
const createdOf = (n) => n.createdAt || n.updatedAt;

const CSS = `
.nt{--bg:#282c34;--fg:#e6e6e6;--muted:#9aa0a6;--line:#3e4451;--hover:#333a45;--sel:#3a4150;--accent:#61afef;--title:#61afef;min-height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-sizing:border-box}
.nt *{box-sizing:border-box}
.nt .top{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.nt h1{font-size:16px;margin:0 8px}
.nt .sp{flex:1}
.nt .btn{border:1px solid var(--line);background:none;color:var(--accent);cursor:pointer;padding:6px 12px;border-radius:8px;font:inherit;text-decoration:none;display:inline-block}
.nt .btn:hover{background:var(--hover)}
.nt .btn:disabled{opacity:.5;cursor:default}
.nt .btn.pri{background:var(--accent);color:var(--bg)}
.nt .btn.danger{color:#d93025}
.nt .btn.sm{padding:2px 8px;font-size:12px}
.nt .body{display:flex;flex-direction:column;flex:1;min-height:0;width:100%;max-width:1200px;margin:0 auto}
.nt .split{display:flex;flex:1;min-height:0}
.nt .list{width:300px;flex-shrink:0;border-right:1px solid var(--line);overflow-y:auto}
.nt .item{padding:10px 14px;border-bottom:1px solid var(--line);cursor:pointer}
.nt .item:hover{background:var(--hover)}
.nt .item.on{background:var(--sel)}
.nt .item b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nt .item small,.nt .muted{color:var(--muted);font-size:12px}
.nt .view{flex:1;min-width:0;overflow-y:auto;padding:20px 24px}
.nt .view h2{margin:0 0 4px;font-size:20px;word-break:break-word}
.nt .view .actions{display:flex;gap:8px;margin:12px 0}
.nt .content{word-break:break-word;padding-top:10px;border-top:1px solid var(--line)}
.nt .content>div,.nt .txt>div{white-space:pre-wrap;min-height:1.5em;font-size:16px;line-height:1.5;user-select:text;-webkit-user-select:text}
.nt .content [data-sub-hit],.nt .txt [data-sub-hit]{cursor:pointer}
.nt .snd{display:inline-flex;align-items:center;vertical-align:middle;margin:0 4px;padding:2px;border:0;border-radius:4px;background:none;color:var(--muted);cursor:pointer;user-select:none;-webkit-user-select:none}
.nt .snd:hover{color:var(--accent);background:var(--hover)}
.nt .stack{flex:1;overflow-y:auto;padding:12px 24px 40px;width:100%;max-width:860px;margin:0 auto}
.nt .blk{padding:14px 0;border-bottom:1px solid var(--line)}
.nt .blk h3{margin:0 0 6px;font-size:18px;font-weight:400;color:var(--title);display:flex;align-items:center;gap:8px;word-break:break-word}
.nt .txt{word-break:break-word}
.nt .inl{display:grid;gap:8px;padding:4px 0 8px}
.nt .inl input[type=text]{font-size:18px;font-weight:400}
.nt .inl textarea{font-size:16px;line-height:1.5;min-height:120px}
.nt .inl .actions{display:flex;justify-content:flex-end;gap:8px}
.nt .empty{color:var(--muted);padding:24px}
.nt .player{position:fixed;left:0;right:0;bottom:0;display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--bg);border-top:1px solid var(--line);z-index:40}
.nt .player input[type=range]{flex:1;min-width:80px}
.nt.has-player{padding-bottom:64px}
.nt .status{color:var(--muted);font-size:12px}
.nt .status.err{color:#d93025}
.nt .overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:50}
.nt .modal{background:var(--bg);color:var(--fg);border-radius:12px;width:min(560px,100%);padding:18px;display:grid;gap:12px;box-shadow:0 8px 30px rgba(0,0,0,.3)}
.nt .modal h3{margin:0;font-size:16px}
.nt .modal label{display:grid;gap:4px;color:var(--muted);font-size:13px}
.nt input[type=text],.nt textarea{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit;font:inherit}
.nt textarea{min-height:200px;resize:vertical}
.nt .modal .actions{display:flex;justify-content:flex-end;gap:8px}
@media (max-width:700px){
  .nt .split{flex-direction:column}
  .nt .list{width:auto;max-height:40vh;border-right:0;border-bottom:1px solid var(--line)}
  .nt .stack{padding:8px 14px 40px}
}
`;

const Notes = () => {
  const apiBase = apiBaseOf();
  const [notes, setNotes] = useState(() => sortNotes(loadNotes()));
  const [view, setView] = useState(loadView);
  const [selId, setSelId] = useState(null);
  const [modal, setModal] = useState(null); // null | { id?, title, content, err } — hộp thoại (chế độ danh sách)
  const [inline, setInline] = useState(null); // null | { id, title, content, err } — sửa trực tiếp (chế độ liền nhau)
  const [sync, setSync] = useState({ busy: false, text: "", err: false });
  const [trWord, setTrWord] = useState(null); // { text, anchor, id, hoverId } từ / đoạn đang dịch

  const current = notes.find((n) => n.id === selId) || notes[0] || null;

  // Từ đã lưu -> tô sáng trong nội dung; cập nhật ngay khi lưu / xoá từ (kể cả ở tab khác)
  const [savedSrcs, setSavedSrcs] = useState(() => getWords().map((w) => w.src));
  const savedMatcher = useMemo(() => buildSavedMatcher(savedSrcs), [savedSrcs]);
  useEffect(() => {
    const refresh = () => setSavedSrcs(getWords().map((w) => w.src));
    const onStorage = (e) => {
      if (!e.key || e.key === WORDS_KEY) refresh();
    };
    window.addEventListener(WORDS_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WORDS_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Esc: đóng hộp thoại hoặc huỷ sửa trực tiếp
  useEffect(() => {
    if (!modal && !inline) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (modal) setModal(null);
      else setInline(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, inline]);

  const openTranslate = (text, anchor, meta) =>
    text && setTrWord({ text, anchor, id: Date.now(), hoverId: meta && meta.hoverId });

  // ---- Đọc ghi chú bằng Gemini TTS ----
  // Các đoạn WAV (cache trên server) được ghép thành một file, phát bằng một trình phát có thanh tua.
  const [tts, setTts] = useState(null); // { noteId, busy } khi đang tải để đọc
  const [player, setPlayer] = useState(null); // { noteId, duration, cur, playing } khi có trình phát
  const ttsRef = useRef({ id: 0, audio: null, url: null });

  const stopSpeak = () => {
    ttsRef.current.id++;
    const { audio, url } = ttsRef.current;
    if (audio) {
      audio.pause();
      audio.ontimeupdate = audio.onloadedmetadata = audio.onplay = audio.onpause = audio.onended = null;
    }
    if (url) URL.revokeObjectURL(url);
    ttsRef.current.audio = null;
    ttsRef.current.url = null;
    setTts(null);
    setPlayer(null);
  };
  useEffect(() => stopSpeak, []); // dừng khi rời trang

  // Tải một đoạn WAV từ server (đã cache thì trả về ngay)
  const fetchChunk = async (noteId, index, text) => {
    const res = await fetch(apiBase + "/notes-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: noteId, index, text }),
    });
    if (!(res.headers.get("content-type") || "").startsWith("audio/")) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Không đọc được nội dung.");
    }
    return res.arrayBuffer();
  };

  // Giải mã từng đoạn (WAV từ Gemini hoặc MP3 từ Google Translate) rồi ghép thành một WAV 24kHz 16-bit mono
  const toPcmWav = async (bufs) => {
    const RATE = 24000;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ sampleRate: RATE });
    try {
      const decoded = [];
      for (const b of bufs) decoded.push(await ctx.decodeAudioData(b.slice(0)));
      const total = decoded.reduce((n, d) => n + d.length, 0);
      const out = new ArrayBuffer(44 + total * 2);
      const dv = new DataView(out);
      const str = (off, t) => [...t].forEach((c, k) => dv.setUint8(off + k, c.charCodeAt(0)));
      str(0, "RIFF");
      dv.setUint32(4, 36 + total * 2, true);
      str(8, "WAVE");
      str(12, "fmt ");
      dv.setUint32(16, 16, true);
      dv.setUint16(20, 1, true);
      dv.setUint16(22, 1, true);
      dv.setUint32(24, RATE, true);
      dv.setUint32(28, RATE * 2, true);
      dv.setUint16(32, 2, true);
      dv.setUint16(34, 16, true);
      str(36, "data");
      dv.setUint32(40, total * 2, true);
      let off = 44;
      for (const d of decoded) {
        const ch = d.getChannelData(0);
        for (let k = 0; k < ch.length; k++, off += 2) {
          const v = Math.max(-1, Math.min(1, ch[k]));
          dv.setInt16(off, Math.round(v < 0 ? v * 0x8000 : v * 0x7fff), true);
        }
      }
      return new Blob([out], { type: "audio/wav" });
    } finally {
      ctx.close();
    }
  };

  // Đọc một dãy đoạn văn bản thành một file có thanh tua
  const speakTexts = async (noteId, texts) => {
    stopSpeak();
    const mine = ttsRef.current.id;
    if (!texts.length) return;
    setTts({ noteId, busy: true });
    try {
      const bufs = [];
      for (let k = 0; k < texts.length; k++) {
        bufs.push(await fetchChunk(noteId, k, texts[k]));
        if (mine !== ttsRef.current.id) return; // đã bấm dừng
      }
      const url = URL.createObjectURL(await toPcmWav(bufs));
      const audio = new Audio(url);
      ttsRef.current.audio = audio;
      ttsRef.current.url = url;
      audio.onloadedmetadata = () =>
        setPlayer((p) => p && { ...p, duration: isFinite(audio.duration) ? audio.duration : 0 });
      audio.ontimeupdate = () => setPlayer((p) => p && { ...p, cur: audio.currentTime });
      audio.onplay = () => setPlayer((p) => p && { ...p, playing: true });
      audio.onpause = () => setPlayer((p) => p && { ...p, playing: false });
      audio.onended = () => setPlayer((p) => p && { ...p, playing: false, cur: 0 });
      setTts(null);
      setPlayer({ noteId, duration: 0, cur: 0, playing: false });
      await audio.play();
    } catch (e) {
      if (mine === ttsRef.current.id) {
        stopSpeak();
        setSync({ busy: false, text: e.message || "Không đọc được.", err: true });
      }
    }
  };

  // Đọc toàn bộ nội dung ghi chú (tách thành đoạn dưới 3000 ký tự để tiết kiệm yêu cầu)
  const speakNote = (note) => speakTexts(note.id, chunkText((note.content || "").trim(), 3000)); // đoạn lớn để ít yêu cầu Gemini

  const togglePlay = () => {
    const a = ttsRef.current.audio;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  };
  const seek = (t) => {
    const a = ttsRef.current.audio;
    if (a) a.currentTime = t;
    setPlayer((p) => p && { ...p, cur: t });
  };

  const speakButton = (note) => {
    const loading = tts && tts.noteId === note.id;
    const active = loading || (player && player.noteId === note.id);
    return (
      <button
        type="button"
        className="btn sm"
        onClick={() => (active ? stopSpeak() : speakNote(note))}
        disabled={loading && tts.busy}
      >
        {loading ? "Đang tải…" : active ? "■ Dừng" : "🔊 Đọc"}
      </button>
    );
  };

  const commit = (list) => {
    const sorted = sortNotes(list);
    setNotes(sorted);
    saveNotes(sorted);
  };

  const changeView = (v) => {
    setView(v);
    saveView(v);
  };

  // Gọi máy chủ; lỗi mạng hoặc chưa cấu hình đồng bộ đều trả về { ok:false, error }
  const call = (path, body) =>
    apiPost(apiBase, path, body).catch(() => ({ ok: false, error: "Không kết nối được máy chủ." }));

  const report = (r, okText) =>
    setSync({ busy: false, text: r.ok ? okText : `Đã lưu trên máy này. ${r.error || "Chưa đồng bộ được."}`, err: !r.ok });

  // Lưu một ghi chú (thêm mới nếu không có id). Trả về chuỗi lỗi, hoặc "" nếu đã lưu.
  const saveNote = (draft) => {
    const title = draft.title.trim();
    if (!title) return "Hãy nhập tiêu đề.";
    const now = Date.now();
    const existing = draft.id ? notes.find((n) => n.id === draft.id) : null;
    const note = existing
      ? { ...existing, title, content: draft.content, updatedAt: now, createdAt: createdOf(existing) }
      : { id: newId(), title, content: draft.content, updatedAt: now, createdAt: now };
    commit(existing ? notes.map((n) => (n.id === note.id ? note : n)) : [note, ...notes]);
    setSelId(note.id);
    setSync({ busy: true, text: "Đang lưu…", err: false });
    call("/notes-upsert", { note }).then((r) => report(r, "Đã đồng bộ lên Sheet ✓"));
    return "";
  };

  const submit = (e) => {
    e.preventDefault();
    const err = saveNote(modal);
    if (err) return setModal({ ...modal, err });
    setModal(null);
  };

  const inlineSave = () => {
    const err = saveNote(inline);
    if (err) return setInline({ ...inline, err });
    setInline(null);
  };

  const remove = async (note) => {
    if (!note || !window.confirm(`Xóa ghi chú "${note.title}"?`)) return;
    const id = note.id;
    commit(notes.filter((n) => n.id !== id));
    setSelId(null);
    setSync({ busy: true, text: "Đang xóa…", err: false });
    report(await call("/notes-remove", { id }), "Đã xóa trên Sheet ✓");
  };

  // Gộp hai chiều: bản mới hơn (theo updatedAt) thắng; máy nào mới hơn thì đẩy lên Sheet
  const syncAll = async () => {
    setSync({ busy: true, text: "Đang đồng bộ…", err: false });
    const r = await apiGet(apiBase, "/notes-pull").catch(() => ({ ok: false, error: "Không kết nối được máy chủ." }));
    if (!r.ok) return setSync({ busy: false, text: r.error || "Không đồng bộ được.", err: true });

    const remote = r.notes || [];
    const remoteById = new Map(remote.map((n) => [n.id, n]));
    const merged = new Map(loadNotes().map((n) => [n.id, n]));
    let pulled = 0;
    remote.forEach((rn) => {
      const ln = merged.get(rn.id);
      if (!ln || (rn.updatedAt || 0) > (ln.updatedAt || 0)) {
        merged.set(rn.id, rn);
        pulled++;
      }
    });
    const list = [...merged.values()];
    commit(list);

    let pushed = 0;
    for (const n of list) {
      const rn = remoteById.get(n.id);
      if (!rn || (n.updatedAt || 0) > (rn.updatedAt || 0)) {
        await call("/notes-upsert", { note: n });
        pushed++;
      }
    }
    setSync({ busy: false, text: `Đã đồng bộ ✓ (kéo về ${pulled}, đẩy lên ${pushed})`, err: false });
  };

  const openEdit = (note) => setModal({ id: note.id, title: note.title, content: note.content || "", err: "" });

  // Nội dung có tô sáng từ đã lưu, bôi đen để dịch, rê chuột vào từ đã lưu để xem nghĩa (dùng chung cho cả hai chế độ)
  // Chặn sự kiện bôi đen / dịch khi bấm icon đọc câu
  const stopAll = (e) => e.stopPropagation();
  const renderText = (note, cls) => (
    <div
      className={cls}
      {...hoverSavedHandlers(openTranslate)}
      {...wordSelectHandlers({ onWord: openTranslate })}
      {...swipeSelectHandlers({ onWord: openTranslate })}
    >
      {(note.content || "").split("\n").map((line, i) => (
        <div key={i} data-sub-seg="1">
          {splitSentences(line).map((part, k) => {
            const lead = part.match(/^\s*/)[0];
            const core = part.trim();
            return (
              <React.Fragment key={k}>
                {lead}
                {highlightSaved(core, savedMatcher, note.id + "-" + i + "-" + k)}
                <button
                  type="button"
                  className="snd"
                  title="Đọc câu này"
                  aria-label="Đọc câu này"
                  onMouseDown={stopAll}
                  onMouseUp={stopAll}
                  onDoubleClick={stopAll}
                  onTouchStart={stopAll}
                  onTouchEnd={stopAll}
                  onClick={(e) => {
                    e.stopPropagation();
                    speakTexts(note.id, [core]);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
                  </svg>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className={"nt" + (player ? " has-player" : "")}>
      <style>{CSS}</style>

      <div className="body">
        <div className="top">
          <Link className="btn" to="/">← Trang chủ</Link>
          <h1>Ghi chú</h1>
          <span className="sp" />
          <button type="button" className="btn" onClick={() => changeView(view === "split" ? "stack" : "split")}>
            {view === "split" ? "Xem liền nhau" : "Xem danh sách"}
          </button>
          <button type="button" className="btn pri" onClick={() => setModal({ title: "", content: "", err: "" })}>
            + Thêm
          </button>
          <button type="button" className="btn" onClick={syncAll} disabled={sync.busy}>
            Đồng bộ Sheet
          </button>
          {sync.text && <span className={"status" + (sync.err ? " err" : "")}>{sync.text}</span>}
        </div>
      {view === "stack" ? (
        <div className="stack">
          {notes.length === 0 && <div className="empty">Chưa có ghi chú. Bấm “+ Thêm” để tạo.</div>}
          {notes.map((n) => (
            <div className="blk" key={n.id}>
              <h3>
                <span>{n.title}</span>
                <span className="sp" />
                {inline && inline.id === n.id ? (
                  <>
                    <button type="button" className="btn sm" onClick={() => setInline(null)}>
                      Hủy
                    </button>
                    <button type="button" className="btn sm pri" onClick={inlineSave}>
                      Lưu
                    </button>
                  </>
                ) : (
                  <>
                    {speakButton(n)}
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setInline({ id: n.id, title: n.title, content: n.content || "", err: "" })}
                    >
                      Sửa
                    </button>
                    <button type="button" className="btn sm danger" onClick={() => remove(n)}>
                      Xóa
                    </button>
                  </>
                )}
              </h3>
              {inline && inline.id === n.id ? (
                <div className="inl">
                  <input
                    type="text"
                    autoFocus
                    aria-label="Tiêu đề"
                    placeholder="Tiêu đề *"
                    value={inline.title}
                    onChange={(e) => setInline({ ...inline, title: e.target.value, err: "" })}
                  />
                  <textarea
                    aria-label="Nội dung"
                    placeholder="Nội dung"
                    rows={Math.max(4, (inline.content.split("\n").length) + 1)}
                    value={inline.content}
                    onChange={(e) => setInline({ ...inline, content: e.target.value })}
                  />
                  {inline.err && <span className="status err">{inline.err}</span>}
                </div>
              ) : (
                renderText(n, "txt")
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="split">
          <div className="list">
            {notes.length === 0 && <div className="empty">Chưa có ghi chú. Bấm “+ Thêm” để tạo.</div>}
            {notes.map((n) => (
              <div key={n.id} className={"item" + (current && current.id === n.id ? " on" : "")} onClick={() => setSelId(n.id)}>
                <b>{n.title}</b>
                <small>{fmtDate(createdOf(n))}</small>
              </div>
            ))}
          </div>

          <div className="view">
            {current ? (
              <>
                <h2>{current.title}</h2>
                <span className="muted">Ngày tạo: {fmtDate(createdOf(current))}</span>
                <div className="actions">
                  {speakButton(current)}
                  <button type="button" className="btn" onClick={() => openEdit(current)}>
                    Sửa
                  </button>
                  <button type="button" className="btn danger" onClick={() => remove(current)}>
                    Xóa
                  </button>
                </div>
                {renderText(current, "content")}
              </>
            ) : (
              <div className="empty">Chọn một ghi chú bên trái.</div>
            )}
          </div>
        </div>
      )}
      </div>

      {player && (
        <div className="player">
          <button type="button" className="btn" onClick={togglePlay}>
            {player.playing ? "❚❚" : "▶"}
          </button>
          <input
            type="range"
            min={0}
            max={player.duration || 0}
            step={0.1}
            value={Math.min(player.cur, player.duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Tua"
          />
          <span className="muted">
            {fmtClock(player.cur)} / {fmtClock(player.duration)}
          </span>
          <button type="button" className="btn" onClick={stopSpeak}>
            ■
          </button>
        </div>
      )}

      {trWord && (
        <TranslatePopup
          key={trWord.id}
          apiBase={apiBase}
          text={trWord.text}
          anchor={trWord.anchor}
          hoverId={trWord.hoverId}
          onClose={() => setTrWord(null)}
        />
      )}

      {modal && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <form className="modal" onSubmit={submit}>
            <h3>{modal.id ? "Sửa ghi chú" : "Thêm ghi chú"}</h3>
            <label>
              Tiêu đề *
              <input type="text" autoFocus value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value, err: "" })} />
            </label>
            <label>
              Nội dung
              <textarea value={modal.content} onChange={(e) => setModal({ ...modal, content: e.target.value })} />
            </label>
            {modal.err && <span className="status err">{modal.err}</span>}
            <div className="actions">
              <button type="button" className="btn" onClick={() => setModal(null)}>
                Hủy
              </button>
              <button type="submit" className="btn pri">
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Notes;
