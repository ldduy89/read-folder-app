// translateText.js — trang "Dịch đoạn văn" mở ở /translate-text: dán đoạn văn rồi dịch.
// Dành cho điện thoại: không cần bôi đen chữ trên trang khác, chỉ cần dán (hoặc gõ) rồi bấm Dịch.
import React, { useEffect, useMemo, useState } from "react";
import { apiBaseOf, apiGet, getTarget } from "./translateLib";
import { CSS } from "./translateWords";

const CHUNK = 4000; // mỗi lần gửi tối đa ~4000 ký tự, đoạn dài hơn được tách theo dòng

// Tách đoạn dài thành các phần nhỏ theo dòng để không vượt giới hạn server
const splitText = (text) => {
  const lines = text.split(/\n/);
  const chunks = [];
  let cur = "";
  for (const line of lines) {
    if ((cur + "\n" + line).length > CHUNK && cur) {
      chunks.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
};

const TranslateText = () => {
  const apiBase = useMemo(apiBaseOf, []);
  const target = getTarget();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = "Dịch đoạn văn";
  }, []);

  const paste = async () => {
    setError("");
    try {
      const t = await navigator.clipboard.readText();
      if (!t) return setError("Clipboard đang trống.");
      setInput(t);
    } catch (e) {
      setError("Không đọc được clipboard. Hãy nhấn giữ ô bên dưới rồi chọn Dán.");
    }
  };

  const run = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setOutput("");
    const chunks = splitText(text);
    const results = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        setProgress(chunks.length > 1 ? `Đang dịch ${i + 1}/${chunks.length}…` : "Đang dịch…");
        const r = await apiGet(apiBase, `/translate?target=${encodeURIComponent(target)}&text=${encodeURIComponent(chunks[i])}`);
        if (!r || !r.ok) throw new Error((r && r.error) || "Dịch lỗi.");
        results.push(r.text);
        setOutput(results.join("\n"));
      }
    } catch (e) {
      setError(e.message || "Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setError("Không sao chép được. Hãy bôi đen kết quả rồi sao chép.");
    }
  };


  return (
    <div className="tw">
      <style>{CSS}</style>
      <div className="wrap px-4 pt-3 pb-8">
        <div className="top items-center !pb-3">
          <a className="btn" href="/translate-words">← Từ đã lưu</a>
          <h1 className="m-0 text-[18px]">Dịch đoạn văn</h1>
        </div>

        <textarea
          className="box-border min-h-[160px] max-h-[50vh] w-full resize-y rounded-[10px] border border-[var(--line)] bg-[var(--bg)] p-3 [font-family:inherit] text-[16px] leading-normal text-[var(--fg)]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Dán hoặc gõ đoạn văn cần dịch vào đây…"
          autoCapitalize="sentences"
        />

        <div className="flex flex-wrap gap-2 my-3">
          <button className="btn min-h-[44px] !px-4 !text-[16px] !rounded-[10px]" onClick={paste} disabled={busy}>Dán</button>
          <button className="btn min-h-[44px] !px-4 !text-[16px] !rounded-[10px]" onClick={() => { setInput(""); setOutput(""); setError(""); }} disabled={busy || (!input && !output)}>Xoá</button>
          <button className="btn min-h-[44px] !px-4 !text-[16px] !rounded-[10px] flex-1 !font-semibold" onClick={run} disabled={busy || !input.trim()}>
            {busy ? progress || "Đang dịch…" : `Dịch sang ${target}`}
          </button>
        </div>

        {error && <div className="err mb-2 text-[#d93025]">{error}</div>}

        {output && (
          <>
            <div className="whitespace-pre-wrap break-words min-h-[80px] rounded-[10px] border border-[var(--line)] p-3 text-[16px] leading-[1.6]">{output}</div>
            <div className="flex gap-2 mt-2.5">
              <button className="btn min-h-[44px] !px-4 !text-[16px] !rounded-[10px]" onClick={copy}>{copied ? "Đã sao chép ✓" : "Sao chép"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TranslateText;
