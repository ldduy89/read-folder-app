// translateWords.js — trang "Từ đã lưu" + cài đặt dịch, mở ở /translate-words (chuyển từ words.html / options.html của extension)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiBaseOf, apiGet, apiPost, copyText, createSpeaker, getTarget, getWords, setTarget, setWords, syncNow, syncOps } from "./translateLib";

const CSS = `
.tw{--bg:#fff;--fg:#202124;--muted:#5f6368;--line:#e3e5e8;--hover:#f3f7fd;--head:#f8f9fa;--accent:#1a73e8;min-height:100vh;background:var(--bg);color:var(--fg);font:13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left;box-sizing:border-box}
@media (prefers-color-scheme: dark){.tw{--bg:#202124;--fg:#e8eaed;--muted:#9aa0a6;--line:#3c4043;--hover:#2a2d31;--head:#292b2f;--accent:#8ab4f8}}
.tw *{box-sizing:border-box}
.tw .wrap{max-width:1100px;margin:0 auto}
.tw .sticky{position:sticky;top:0;z-index:2;background:var(--bg)}
.tw .top{padding:12px 16px 8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.tw h1{font-size:16px;margin:0 8px 0 0}
.tw input[type=search],.tw input[type=text],.tw input[type=password]{padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit;font:inherit}
.tw .q{flex:1 1 200px;min-width:140px}
.tw select{padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:inherit;font:inherit}
.tw .btn{border:1px solid var(--line);background:none;color:var(--accent);cursor:pointer;padding:6px 10px;border-radius:8px;font:inherit}
.tw .btn:hover{background:var(--hover)}
.tw .btn:disabled{opacity:.5;cursor:default}
.tw .syncstate{font-size:12px;color:var(--muted)}
.tw .syncstate.err,.tw .err{color:#d93025}
.tw .ok{color:#188038}
.tw .cols,.tw .item{display:grid;grid-template-columns:minmax(110px,1.1fr) minmax(130px,1.4fr) minmax(150px,2fr) 78px 54px;gap:10px;align-items:start;padding:0 16px}
.tw .cols{align-items:center;background:var(--head);border-top:1px solid var(--line);border-bottom:1px solid var(--line);height:28px;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.03em}
.tw .item{min-height:30px;padding-top:4px;padding-bottom:4px;border-bottom:1px solid var(--line);cursor:pointer}
.tw .item:hover{background:var(--hover)}
.tw .src{font-weight:600}
.tw .detail,.tw .meta{color:var(--muted);font-size:12px}
.tw .srcwrap{display:flex;align-items:center;gap:4px;min-width:0}
.tw .item.open .srcwrap{align-items:flex-start}
.tw .spk{flex:none;border:0;background:none;cursor:pointer;padding:1px 3px;border-radius:4px;font-size:13px;line-height:1;opacity:.75;color:inherit}
.tw .spk:hover{opacity:1;background:var(--line)}
.tw .src,.tw .meaning{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tw .detail{white-space:pre-line;line-height:1.6;word-break:break-word}
.tw .srcwrap .src{min-width:0}
.tw .item.open .src,.tw .item.open .meaning{white-space:normal;overflow:visible;word-break:break-word}
.tw .item.open{background:var(--hover)}
.tw .acts{text-align:right;white-space:nowrap;visibility:hidden}
.tw .item:hover .acts,.tw .item.open .acts{visibility:visible}
.tw .acts button{border:0;background:none;cursor:pointer;color:var(--muted);padding:2px 4px;border-radius:4px;font-size:13px}
.tw .acts button:hover{color:var(--fg);background:var(--line)}
.tw .empty{padding:40px 16px;text-align:center;color:var(--muted)}
.tw .toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#323232;color:#fff;padding:8px 14px;border-radius:8px;display:flex;gap:12px;align-items:center}
.tw .toast button{border:0;background:none;color:#8ab4f8;cursor:pointer;font:inherit}
.tw .settings{padding:8px 16px 16px;border-bottom:1px solid var(--line);display:grid;gap:10px}
.tw .settings label{display:grid;gap:3px;color:var(--muted);font-size:12px}
.tw .settings .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.tw .settings input[type=text],.tw .settings input[type=password]{width:100%;max-width:560px}
.tw .settings h2{font-size:14px;margin:8px 0 0}
@media (max-width:760px){.tw .cols,.tw .item{grid-template-columns:minmax(90px,1fr) minmax(110px,1.3fr) 54px}.tw .cols>:nth-child(3),.tw .cols>:nth-child(4),.tw .item>:nth-child(3),.tw .item>:nth-child(4){display:none}}
`;

const fmtDate = (t) => (t ? new Date(t).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "");
const fmtDateCsv = (t) => (t ? new Date(t).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");

// ---------- Nhập / xuất CSV ----------
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
const HEADER_ALIASES = {
  src: ["tu", "word", "src", "front", "term", "source"],
  meaning: ["nghia", "meaning", "translation", "back", "dich"],
  detail: ["chi tiet", "detail", "details", "note", "notes"],
  lang: ["ngon ngu", "language", "lang"],
  date: ["ngay luu", "ngay", "date", "saved", "savedat"]
};

// Đọc CSV: hỗ trợ dấu ngoặc kép, dấu phẩy / chấm phẩy / tab, xuống dòng trong ô, BOM
const parseCsv = (text) => {
  text = text.replace(/^\ufeff/, "");
  const firstLine = (text.split(/\r?\n/, 1)[0] || "").replace(/"[^"]*"/g, "");
  const count = (ch) => firstLine.split(ch).length - 1;
  const delim = [",", ";", "\t"].sort((a, b) => count(b) - count(a))[0];
  const rows = [];
  let row = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
};

const parseDate = (s) => {
  s = String(s || "").trim();
  if (!s) return null;
  if (/^\d{10,13}$/.test(s)) return s.length === 10 ? Number(s) * 1000 : Number(s);
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/); // ngày/tháng/năm (kiểu Việt Nam)
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const t = new Date(y, Number(m[2]) - 1, Number(m[1])).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
};

const csvToWords = (rows) => {
  if (!rows.length) return [];
  const header = rows[0].map(norm);
  const col = {};
  for (const [key, names] of Object.entries(HEADER_ALIASES)) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) col[key] = i;
  }
  let data;
  if (col.src != null) data = rows.slice(1);
  else {
    data = rows;
    Object.assign(col, { src: 0, meaning: 1, detail: 2, lang: 3, date: 4 }); // không có tiêu đề: theo thứ tự cột
  }
  const get = (r, k) => (col[k] != null && r[col[k]] != null ? r[col[k]].trim() : "");
  const seen = new Set();
  const now = Date.now();
  const out = [];
  data.forEach((r, i) => {
    const src = get(r, "src");
    if (!src) return;
    const id = src.toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    const [from = "", to = ""] = get(r, "lang").split(/→|->/).map((x) => x.trim());
    out.push({
      id,
      src: src.slice(0, 500),
      meaning: get(r, "meaning"),
      detail: get(r, "detail").replace(/ \| /g, "\n"), // khi xuất CSV, xuống dòng được đổi thành " | "
      from,
      to,
      savedAt: parseDate(get(r, "date")) || now - i
    });
  });
  return out;
};

const readCsvFile = async (file) => {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch (e) {
    return new TextDecoder("windows-1258").decode(buf).normalize("NFC"); // Excel tiếng Việt đôi khi lưu CSV không phải UTF-8
  }
};

const Words = () => {
  const apiBase = useMemo(apiBaseOf, []);
  const speaker = useMemo(() => createSpeaker(apiBase), [apiBase]);
  const rootRef = useRef(null);
  const fileRef = useRef(null);
  const toastTimer = useRef(null);
  const lastDeleted = useRef(null);
  const [words, setList] = useState(getWords);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("new");
  const [open, setOpen] = useState({});
  const [toast, setToast] = useState(null); // { text, undo }
  const [sync, setSync] = useState({ busy: false, text: "", err: false });
  const [showSet, setShowSet] = useState(() => new URLSearchParams(window.location.search).get("settings") === "1"); // /translate-words?settings=1 mở sẵn cấu hình

  useEffect(() => {
    document.title = "Từ đã lưu";
    return () => speaker.stop();
  }, []);

  const save = (list) => {
    setWords(list);
    setList(list);
  };
  const showToast = (text, undo) => {
    setToast({ text, undo });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      lastDeleted.current = null;
    }, 5000);
  };

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    const a = words.filter((w) => !k || `${w.src} ${w.meaning} ${w.detail || ""}`.toLowerCase().includes(k));
    if (sort === "old") a.sort((x, y) => (x.savedAt || 0) - (y.savedAt || 0));
    else if (sort === "az") a.sort((x, y) => x.src.localeCompare(y.src, undefined, { sensitivity: "base" }));
    else a.sort((x, y) => (y.savedAt || 0) - (x.savedAt || 0));
    return a;
  }, [words, q, sort]);

  const remove = (w) => {
    lastDeleted.current = w;
    save(words.filter((x) => x.id !== w.id));
    syncOps(apiBase, [{ action: "remove", id: w.id }]);
    showToast(`Đã xóa "${w.src.slice(0, 30)}"`, true);
  };
  const undo = () => {
    const w = lastDeleted.current;
    if (!w) return;
    save([w, ...words.filter((x) => x.id !== w.id)]);
    syncOps(apiBase, [{ action: "add", word: w }]);
    lastDeleted.current = null;
    setToast(null);
  };

  const exportCsv = () => {
    const esc = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""').replace(/\n/g, " | ")}"`;
    const rows = [["Từ", "Nghĩa", "Chi tiết", "Ngôn ngữ", "Ngày lưu"], ...shown.map((w) => [w.src, w.meaning, w.detail, `${w.from || ""}→${w.to || ""}`, fmtDateCsv(w.savedAt)])];
    const csv = "\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\r\n"); // BOM để Excel đọc đúng tiếng Việt
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "tu-da-luu.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importFile = async (file) => {
    let imported;
    try {
      imported = csvToWords(parseCsv(await readCsvFile(file)));
    } catch (e) {
      return showToast("Không đọc được file: " + e.message);
    }
    if (!imported.length) return showToast("Không tìm thấy từ nào trong file. Cột đầu tiên cần là từ, cột thứ hai là nghĩa.");
    const byId = new Map(words.map((x) => [x.id, x]));
    const dups = imported.filter((x) => byId.has(x.id)).length;
    const overwrite = dups > 0 && window.confirm(`${dups} từ trong file đã có trong danh sách.\n\nOK = ghi đè nghĩa bằng dữ liệu trong file\nHủy = giữ nguyên, bỏ qua các từ trùng`);
    const added = [];
    const updated = [];
    for (const x of imported) {
      const old = byId.get(x.id);
      if (!old) added.push(x);
      else if (overwrite) {
        const merged = { ...old, meaning: x.meaning || old.meaning, detail: x.detail || old.detail, from: x.from || old.from, to: x.to || old.to };
        byId.set(x.id, merged);
        updated.push(merged);
      }
    }
    save([...added, ...words.map((x) => byId.get(x.id) || x)]);
    const ops = [...added, ...updated].map((x) => ({ action: "add", word: x }));
    if (ops.length) syncOps(apiBase, ops);
    const skipped = dups - updated.length;
    showToast(`Đã nhập ${added.length} từ mới` + (updated.length ? `, cập nhật ${updated.length}` : "") + (skipped > 0 ? `, bỏ qua ${skipped} từ trùng` : ""));
  };

  const doSync = async () => {
    setSync({ busy: true, text: "Đang đồng bộ…", err: false });
    const r = await syncNow(apiBase);
    setList(getWords());
    setSync(r.ok ? { busy: false, text: `Đã đồng bộ ✓ (kéo về ${r.pulled}, đẩy lên ${r.pushed})`, err: false } : { busy: false, text: r.error || "Không đồng bộ được.", err: true });
  };

  return (
    <div className="tw" ref={rootRef}>
      <style>{CSS}</style>
      <div className="wrap">
        <div className="sticky">
          <div className="top">
            <h1>Từ đã lưu ({words.length})</h1>
            <input className="q" type="search" placeholder="Tìm từ, nghĩa…" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
            <select title="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="new">Mới nhất</option>
              <option value="old">Cũ nhất</option>
              <option value="az">A → Z</option>
            </select>
            <button className="btn" disabled={sync.busy} title="Gộp danh sách với Google Sheet" onClick={doSync}>
              Đồng bộ
            </button>
            <span className={"syncstate" + (sync.err ? " err" : "")}>{sync.text}</span>
            <button className="btn" title="Nhập từ file CSV" onClick={() => fileRef.current && fileRef.current.click()}>
              Nhập CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv"
              hidden
              onChange={async (e) => {
                const f = e.target.files && e.target.files[0];
                e.target.value = ""; // cho phép chọn lại cùng một file
                if (f) await importFile(f);
              }}
            />
            <button className="btn" onClick={exportCsv}>
              Xuất CSV
            </button>
            <button className="btn" onClick={() => setShowSet((v) => !v)}>
              Cài đặt
            </button>
          </div>
          {showSet && <Settings apiBase={apiBase} host={rootRef} />}
          <div className="cols">
            <span>Từ</span>
            <span>Nghĩa</span>
            <span>Chi tiết</span>
            <span>Ngày</span>
            <span></span>
          </div>
        </div>
        <div>
          {!shown.length && <div className="empty">{words.length ? "Không có kết quả." : "Chưa có từ nào. Dịch một từ rồi bấm ☆ Lưu trên cửa sổ dịch."}</div>}
          {shown.map((w) => {
            const lang = /^[a-z]{2,3}(-[A-Za-z]+)?$/.test(w.from || "") ? w.from : "en";
            return (
              <div key={w.id} className={"item" + (open[w.id] ? " open" : "")} onClick={() => setOpen((o) => ({ ...o, [w.id]: !o[w.id] }))}>
                <span className="srcwrap">
                  <button
                    type="button"
                    className="spk"
                    title="Đọc"
                    onClick={(e) => {
                      e.stopPropagation();
                      speaker.speak(w.src, lang);
                    }}
                  >
                    🔊
                  </button>
                  <span className="src" title={w.src}>
                    {w.src}
                  </span>
                </span>
                <span className="meaning" title={w.meaning}>
                  {w.meaning}
                </span>
                <span className="detail" title={w.detail || ""}>
                  {w.detail || ""}
                </span>
                <span className="meta" title={`${w.from || "?"} → ${w.to || "?"}`}>
                  {fmtDate(w.savedAt)}
                </span>
                <span className="acts">
                  <button
                    type="button"
                    title="Copy"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyText([w.src, w.meaning, w.detail].filter(Boolean).join("\n"), rootRef.current);
                    }}
                  >
                    📋
                  </button>
                  <button
                    type="button"
                    title="Xóa"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(w);
                    }}
                  >
                    ✕
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {toast && (
        <div className="toast">
          <span>{toast.text}</span>
          {toast.undo && <button onClick={undo}>Hoàn tác</button>}
        </div>
      )}
    </div>
  );
};

// ---------- Cài đặt: ngôn ngữ đích, Gemini, đồng bộ Google Sheet ----------
const Settings = ({ apiBase, host }) => {
  const [cfg, setCfg] = useState(null);
  const [target, setTargetState] = useState(getTarget());
  const [gKey, setGKey] = useState("");
  const [gModel, setGModel] = useState("");
  const [sUrl, setSUrl] = useState("");
  const [sSecret, setSSecret] = useState("");
  const [msg, setMsg] = useState({ g: null, s: null, t: null });
  const say = (k, text, ok) => setMsg((m) => ({ ...m, [k]: text ? { text, ok } : null }));

  const load = () =>
    apiGet(apiBase, "/translate-config")
      .then((c) => {
        setCfg(c);
        setGModel(c.geminiModel || "");
        setSUrl(c.syncUrl || "");
      })
      .catch(() => setCfg(false));
  useEffect(() => {
    load();
  }, []);

  if (cfg === false) return <div className="settings err">Không kết nối được máy chủ (cổng 8081).</div>;
  if (!cfg) return <div className="settings">Đang tải…</div>;

  const post = (path, body) => apiPost(apiBase, path, body).catch(() => ({ ok: false, error: "Không kết nối được máy chủ." }));

  const saveTarget = () => {
    const t = target.trim() || "vi";
    setTarget(t);
    setTargetState(t);
    say("t", "Đã lưu ✓", true);
  };
  const saveGemini = async () => {
    const body = { geminiModel: gModel };
    if (gKey.trim()) body.geminiKey = gKey; // để trống = giữ key cũ
    const r = await post("/translate-config", body);
    if (r.ok) {
      setGKey("");
      await load();
    }
    say("g", r.ok ? "Đã lưu ✓" : r.error, r.ok);
  };
  const clearGemini = async () => {
    const r = await post("/translate-config", { geminiKey: "" });
    if (r.ok) await load();
    say("g", r.ok ? "Đã xóa key ✓" : r.error, r.ok);
  };
  const testGemini = async () => {
    say("g", "Đang thử…", true);
    const r = await post("/gemini-test", { key: gKey, model: gModel });
    say("g", r.ok ? `Dùng được ✓ (they're all over him → ${r.sample})` : r.error, r.ok);
  };
  const saveSync = async () => {
    const body = { syncUrl: sUrl };
    if (sSecret.trim()) body.syncSecret = sSecret; // để trống = giữ mã cũ
    const r = await post("/translate-config", body);
    if (r.ok) {
      setSSecret("");
      await load();
    }
    say("s", r.ok ? "Đã lưu ✓" : r.error, r.ok);
  };
  const testSync = async () => {
    say("s", "Đang thử…", true);
    const r = await post("/sync-test", { url: sUrl, secret: sSecret });
    say("s", r.ok ? `Kết nối được ✓ (${r.count} từ trên Sheet)` : r.error, r.ok);
  };

  const Msg = ({ k }) => (msg[k] ? <span className={msg[k].ok ? "ok" : "err"}>{msg[k].text}</span> : null);

  return (
    <div className="settings">
      <h2>Ngôn ngữ đích</h2>
      <div className="row">
        <input type="text" style={{ width: 90 }} value={target} onChange={(e) => setTargetState(e.target.value)} placeholder="vi" />
        <button className="btn" onClick={saveTarget}>
          Lưu
        </button>
        <Msg k="t" />
        <span className="syncstate">Mã ngôn ngữ, ví dụ vi, en, ja. Áp dụng cho trình duyệt này.</span>
      </div>

      <h2>Gemini (dịch cụm từ / câu)</h2>
      <label>
        API key {cfg.hasGeminiKey ? "(đã có key, để trống nếu giữ nguyên)" : "(chưa có, bỏ trống thì dùng Google Translate)"}
        <input type="password" value={gKey} onChange={(e) => setGKey(e.target.value)} autoComplete="off" placeholder={cfg.hasGeminiKey ? "••••••••" : ""} />
      </label>
      <label>
        Model
        <input type="text" value={gModel} onChange={(e) => setGModel(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn" onClick={saveGemini}>
          Lưu
        </button>
        <button className="btn" onClick={testGemini}>
          Thử
        </button>
        {cfg.hasGeminiKey && (
          <button className="btn" onClick={clearGemini}>
            Xóa key
          </button>
        )}
        <Msg k="g" />
      </div>

      <h2>Đồng bộ Google Sheet</h2>
      <label>
        URL Apps Script (kết thúc bằng /exec)
        <input type="text" value={sUrl} onChange={(e) => setSUrl(e.target.value)} />
      </label>
      <label>
        Mã bí mật {cfg.hasSyncSecret ? "(đã có, để trống nếu giữ nguyên)" : ""}
        <input type="password" value={sSecret} onChange={(e) => setSSecret(e.target.value)} autoComplete="off" placeholder={cfg.hasSyncSecret ? "••••••••" : ""} />
      </label>
      <div className="row">
        <button className="btn" onClick={saveSync}>
          Lưu
        </button>
        <button className="btn" onClick={testSync}>
          Thử kết nối
        </button>
        <Msg k="s" />
      </div>
      <span className="syncstate">Key và mã bí mật được lưu trong file translate-config.json trên máy chạy server, không gửi về trình duyệt.</span>
    </div>
  );
};

export default Words;
