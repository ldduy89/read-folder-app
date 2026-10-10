/* eslint-disable react-hooks/exhaustive-deps */
// translatePopup.js — cửa sổ dịch hiện cạnh từ / đoạn đang chọn trong phụ đề (chuyển từ extension Copy-Copy Translate)
// Server: GET {apiBase}/translate?text=&target=  và  GET {apiBase}/tts?text=&lang=  (api/translate.js)
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { hitGroup } from "./assLayer";
import { apiGet, copyText, createSpeaker, getTarget, getWords, setWords, syncOps, wordId } from "./translateLib";

// Mỗi từ loại một dòng: { label: "Tính từ", words: ["hoàn toàn", ...] }, tối đa 3 nghĩa phổ biến nhất
const dictLines = (dict) =>
  ((dict && dict.pos) || [])
    .map((g) => {
      const words = [...new Set([...g.terms].sort((a, b) => (b.score || 0) - (a.score || 0)).map((t) => t.word))].slice(0, 3);
      const label = g.pos ? g.pos.charAt(0).toUpperCase() + g.pos.slice(1) : "";
      return { label, words };
    })
    .filter((l) => l.words.length);

// Nghĩa theo từ loại đã lưu dạng chữ ("Tính từ: a, b" mỗi loại một dòng) -> cùng dạng với dictLines
const parseDetail = (detail) =>
  String(detail || "")
    .split("\n")
    .map((ln) => {
      const i = ln.indexOf(": ");
      if (i < 0) return null;
      const words = ln.slice(i + 2).split(", ").map((x) => x.trim()).filter(Boolean);
      return words.length ? { label: ln.slice(0, i), words } : null;
    })
    .filter(Boolean);

const AUTO_CLOSE_MS = 500; // cửa sổ mở bằng cách rê chuột: chuột rời khỏi đoạn đó (và không ở trên cửa sổ) chừng này ms thì tự đóng

const cache = new Map();
const CACHE_MAX = 150;

const C = {
  card: {
    position: "fixed",
    zIndex: 2147483000,
    width: 380,
    maxWidth: "92vw",
    boxSizing: "border-box",
    background: "#fff",
    color: "#202124",
    border: "1px solid #dadce0",
    borderRadius: 10,
    boxShadow: "0 6px 24px rgba(0,0,0,.35)",
    font: "14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    textAlign: "left",
    overflow: "hidden",
    cursor: "default"
  },
  bar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "#f1f3f4", fontSize: 12, color: "#5f6368" },
  btn: { border: 0, background: "none", cursor: "pointer", color: "#5f6368", fontSize: 12, padding: "2px 6px" },
  icon: { border: 0, background: "none", cursor: "pointer", color: "#80868b", fontSize: 14, lineHeight: 1, padding: "2px 4px", borderRadius: 4, verticalAlign: "middle" },
  spk: { border: 0, background: "none", cursor: "pointer", color: "#5f6368", fontSize: 16, lineHeight: 1, padding: "2px 4px", marginRight: 6, borderRadius: 4, verticalAlign: "middle" },
  src: { padding: "8px 12px", maxHeight: 100, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#fafafa", color: "#5f6368", borderBottom: "1px solid #eee", fontSize: 13 },
  out: { padding: "10px 12px", maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  dict: { padding: "6px 12px 8px", borderTop: "1px solid #eee", maxHeight: 200, overflow: "auto" }
};

/**
 * props:
 *  apiBase: "http://host:8081"
 *  text:    đoạn cần dịch
 *  anchor:  { x, y, top } vị trí từ trên màn hình (y = mép dưới, top = mép trên) để đặt cửa sổ
 *  onClose: đóng cửa sổ
 */
const TranslatePopup = ({ apiBase, text, anchor, hoverId, onClose }) => {
  const cardRef = useRef(null);
  const [res, setRes] = useState(null); // null = đang dịch
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");
  const [pos, setPos] = useState({ left: -9999, top: 0 });
  const target = getTarget();
  const src = text.slice(0, 1000);

  const speakerRef = useRef(null);
  if (!speakerRef.current) speakerRef.current = createSpeaker(apiBase);
  const speaker = speakerRef.current;
  const [retry, setRetry] = useState(0);

  // Dịch
  useEffect(() => {
    let alive = true;
    setRes(null);
    const key = target + "|" + text;
    // Từ / cụm đã lưu: lấy nghĩa trong danh sách đã lưu cho nhanh, không gọi server (chỉ khi cùng ngôn ngữ đích và có nghĩa)
    const sw = getWords().find((w) => w.id === wordId(text));
    if (sw && sw.meaning && (!sw.to || sw.to === target)) {
      setRes({ ok: true, text: sw.meaning, from: sw.from || "auto", to: sw.to || target, via: "saved", detail: sw.detail || "" });
      setSaved(true);
      return () => {
        alive = false;
      };
    }
    const finish = (r) => {
      if (!alive) return;
      setRes(r);
      if (r.ok) setSaved(getWords().some((w) => w.id === wordId(text)));
    };
    if (cache.has(key)) {
      finish(cache.get(key));
      return () => {
        alive = false;
      };
    }
    apiGet(apiBase, `/translate?target=${encodeURIComponent(target)}&text=${encodeURIComponent(text.slice(0, 5000))}`)
      .then((r) => {
        if (r.ok) {
          if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
          cache.set(key, r);
        }
        finish(r);
      })
      .catch(() => finish({ ok: false, error: "Không kết nối được máy chủ dịch (cổng 8081)." }));
    return () => {
      alive = false;
    };
  }, [text, apiBase, retry]);

  // Đặt vị trí: ưu tiên dưới từ, hết chỗ thì lên trên; luôn nằm trong màn hình
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const w = card.offsetWidth;
    const h = card.offsetHeight || 80;
    const a = anchor || { x: window.innerWidth / 2 - w / 2, y: window.innerHeight / 3, top: window.innerHeight / 3 };
    const left = Math.min(Math.max(8, a.x), Math.max(8, window.innerWidth - w - 8));
    let top = a.y + 8;
    if (top + h + 8 > window.innerHeight) top = Math.max(8, a.top - h - 8);
    top = Math.min(Math.max(8, top), Math.max(8, window.innerHeight - h - 8));
    setPos((p) => (Math.abs(p.left - left) < 1 && Math.abs(p.top - top) < 1 ? p : { left, top }));
  }, [res, anchor]);

  // Mở bằng cách rê chuột lên từ đã lưu: chuột không còn ở trên đoạn đó cũng không ở trên cửa sổ trong AUTO_CLOSE_MS thì đóng.
  // Dùng :hover thay vì lắng nghe sự kiện để vẫn đúng khi sub đổi câu (đoạn bị xoá khỏi trang) mà chuột đứng yên.
  useEffect(() => {
    if (!hoverId) return undefined;
    let outSince = null;
    const timer = setInterval(() => {
      const card = cardRef.current;
      const inside = (card && card.matches(":hover")) || hitGroup(hoverId).some((el) => el.matches(":hover"));
      if (inside) outSince = null;
      else if (outSince == null) outSince = Date.now();
      else if (Date.now() - outSince >= AUTO_CLOSE_MS) onClose();
    }, 100);
    return () => clearInterval(timer);
  }, [hoverId]);

  // Đóng: Esc, bấm ra ngoài; dừng đọc khi đóng
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown, true);
      speaker.stop();
    };
  }, []);

  const speak = (t, lang) => speaker.speak(t, lang);
  const copy = (str, tag) =>
    copyText(str, cardRef.current, () => {
      setCopied(tag);
      setTimeout(() => setCopied(""), 1200);
    });

  const lines = res && res.ok ? (res.via === "saved" ? parseDetail(res.detail) : dictLines(res.dict)) : [];
  const detail = lines.map((l) => l.label + ": " + l.words.join(", ")).join("\n");

  const toggleSave = () => {
    if (!res || !res.ok) return;
    const list = getWords();
    const id = wordId(text);
    const has = list.some((w) => w.id === id);
    const next = has
      ? list.filter((w) => w.id !== id)
      : [{ id, src: text.slice(0, 500), meaning: res.text, detail, from: res.from, to: res.to, savedAt: Date.now() }, ...list];
    if (setWords(next)) {
      setSaved(!has);
      syncOps(apiBase, [has ? { action: "remove", id } : { action: "add", word: next[0] }]); // đồng bộ lên Google Sheet (nếu đã cấu hình)
    }
  };

  // Không cho sự kiện chuột lan ra làm phát / tạm dừng video hay phóng to
  const stop = (e) => e.stopPropagation();

  return (
    <div ref={cardRef} style={{ ...C.card, left: pos.left, top: pos.top }} onClick={stop} onMouseDown={stop} onDoubleClick={stop} onMouseUp={stop}>
      <div style={C.bar}>
        <span>{!res ? "Đang dịch…" : res.ok ? `${res.from} → ${res.to}${res.via === "gemini" ? " · Gemini" : res.via === "saved" ? " · đã lưu" : ""}` : "Lỗi"}</span>
        <span>
          {res && res.ok && (
            <button type="button" style={{ ...C.btn, color: saved ? "#f9ab00" : "#5f6368" }} onClick={toggleSave}>
              {saved ? "★ Đã lưu" : "☆ Lưu"}
            </button>
          )}
          <button type="button" style={C.btn} onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </span>
      </div>
      <div style={C.src}>
        <button type="button" style={C.spk} title="Nghe văn bản gốc" onClick={() => speak(src, res && res.ok ? res.from : "en")}>
          🔊
        </button>
        <span>{src}</span>
        <button type="button" style={{ ...C.icon, marginLeft: 6 }} title="Sao chép văn bản gốc" onClick={() => copy(text, "src")}>
          {copied === "src" ? "✓" : "📋"}
        </button>
      </div>
      <div style={C.out}>
        {!res && <span style={{ color: "#80868b" }}>…</span>}
        {res && !res.ok && (
          <>
            <span>{res.error || "Không dịch được."}</span>
            <div style={{ marginTop: 6 }}>
              <button type="button" style={{ ...C.btn, border: "1px solid #dadce0", borderRadius: 6, padding: "4px 10px", fontSize: 13, color: "#202124" }} onClick={() => setRetry((n) => n + 1)}>
                Thử lại
              </button>
            </div>
          </>
        )}
        {res && res.ok && (
          <>
            <button type="button" style={C.spk} title="Nghe bản dịch" onClick={() => speak(res.text, res.to)}>
              🔊
            </button>
            <span>{res.text}</span>
            <button type="button" style={{ ...C.icon, marginLeft: 6 }} title="Sao chép bản dịch" onClick={() => copy(detail ? res.text + "\n" + detail : res.text, "out")}>
              {copied === "out" ? "✓" : "📋"}
            </button>
          </>
        )}
      </div>
      {lines.length > 0 && (
        <div style={C.dict}>
          {lines.map((l, i) => (
            <div key={i} style={{ margin: "2px 0", fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: "#5f6368" }}>{l.label}: </span>
              <span>{l.words.join(", ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TranslatePopup;
