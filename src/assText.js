// assText.js — đọc text của cue ASS (thẻ override) để vẽ phụ đề theo thiết lập trong sub

// Kích thước khung sub mặc định khi server không có PlayRes (cache cũ)
export const ASS_DEFAULT_RES = { x: 1920, y: 1080 };

// Style dùng khi không có thông tin style từ sub (giữ kiểu cũ: chữ vàng, đậm)
export const DEFAULT_ASS_STYLE = {
  fontName: "Tahoma",
  fontSize: 0, // 0 = tự tính theo chiều cao khung (PlayResY / 18)
  primary: "#ffd700",
  bold: true,
  italic: false,
  underline: false,
  strike: false,
  alignment: 2,
  marginL: 0,
  marginR: 0,
  marginV: 0
};

// identifier của cue: "ass:" + encodeURIComponent(JSON {s: style, l: layer, a: marginL, b: marginR, v: marginV})
export const readCueMeta = (id) => {
  if (!id || String(id).indexOf("ass:") !== 0) return {};
  try {
    const o = JSON.parse(decodeURIComponent(String(id).slice(4)));
    return { style: o.s, layer: o.l || 0, marginL: o.a || 0, marginR: o.b || 0, marginV: o.v || 0 };
  } catch (e) {
    return {};
  }
};

// \c&HBBGGRR& -> #rrggbb
const tagColor = (value) => {
  const m = /^&?H?([0-9a-f]{1,8})&?$/i.exec(String(value || "").trim());
  if (!m) return null;
  const hex = m[1].padStart(6, "0").slice(-6);
  return `#${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}`;
};

// \a (kiểu SSA cũ) -> \an
const LEGACY_AN = { 1: 1, 2: 2, 3: 3, 5: 7, 6: 8, 7: 9, 9: 4, 10: 5, 11: 6 };

// Tách các thẻ trong một khối {...}; thẻ có ngoặc (\t(...), \fad(...)) không bị cắt giữa chừng
const splitTags = (block) => {
  const tags = [];
  let depth = 0;
  let cur = null;
  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (ch === "\\" && depth === 0) {
      if (cur !== null) tags.push(cur);
      cur = "";
      continue;
    }
    if (cur === null) continue; // chữ ghi chú trước thẻ đầu tiên
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    cur += ch;
  }
  if (cur !== null) tags.push(cur);
  return tags;
};

const styleToState = (st) => ({
  fs: st.fontSize || 0,
  color: st.primary || DEFAULT_ASS_STYLE.primary,
  bold: !!st.bold,
  italic: !!st.italic,
  underline: !!st.underline,
  strike: !!st.strike,
  font: st.fontName || ""
});

/**
 * Đọc text của một cue ASS.
 * Trả về { pos: {x,y}|null, an: number|null, lines: [[{text, fs, color, bold, italic, underline, strike, font}]] }
 *  - pos: toạ độ \pos / \move (đơn vị PlayRes)
 *  - an: alignment kiểu numpad (1-9) nếu cue có \an / \a
 *  - lines: các dòng (\N), mỗi dòng gồm các đoạn chữ có định dạng riêng
 */
export const parseAssCue = (rawText, style, styles) => {
  const base = styleToState(style || DEFAULT_ASS_STYLE);
  let cur = { ...base };
  let pos = null;
  let an = null;
  let drawing = false;
  let lines = [[]];
  let buf = "";

  const flush = () => {
    if (buf && !drawing) lines[lines.length - 1].push({ text: buf, ...cur });
    buf = "";
  };

  const applyTag = (t) => {
    let m;
    if ((m = /^pos\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/.exec(t))) {
      pos = { x: parseFloat(m[1]), y: parseFloat(m[2]) };
    } else if ((m = /^move\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/.exec(t))) {
      if (!pos) pos = { x: parseFloat(m[1]), y: parseFloat(m[2]) };
    } else if ((m = /^an([1-9])$/.exec(t))) {
      an = parseInt(m[1], 10);
    } else if ((m = /^a(\d+)$/.exec(t))) {
      if (LEGACY_AN[m[1]]) an = LEGACY_AN[m[1]];
    } else if ((m = /^fs(\d+(?:\.\d+)?)$/.exec(t))) {
      cur.fs = parseFloat(m[1]);
    } else if (t === "fs") {
      cur.fs = base.fs;
    } else if ((m = /^fn(.*)$/.exec(t))) {
      cur.font = m[1].trim() || base.font;
    } else if ((m = /^1?c(&?H?[0-9a-f]+&?)$/i.exec(t))) {
      const c = tagColor(m[1]);
      if (c) cur.color = c;
    } else if (/^1?c$/.test(t)) {
      cur.color = base.color;
    } else if ((m = /^b(\d+)$/.exec(t))) {
      const v = parseInt(m[1], 10);
      cur.bold = v === 1 || v >= 600;
    } else if (t === "b") {
      cur.bold = base.bold;
    } else if ((m = /^i(\d)$/.exec(t))) {
      cur.italic = m[1] === "1";
    } else if ((m = /^u(\d)$/.exec(t))) {
      cur.underline = m[1] === "1";
    } else if ((m = /^s(\d)$/.exec(t))) {
      cur.strike = m[1] === "1";
    } else if ((m = /^r(.*)$/.exec(t))) {
      const name = m[1].trim();
      cur = { ...(name && styles && styles[name] ? styleToState({ ...DEFAULT_ASS_STYLE, ...styles[name] }) : base) };
    } else if ((m = /^p(\d+)$/.exec(t))) {
      drawing = parseInt(m[1], 10) > 0; // chế độ vẽ hình vector: bỏ qua phần chữ lệnh vẽ
    }
    // Các thẻ khác (\t, \fad, \clip, \bord, \shad, \blur, \frz, \fsc, ...) không hỗ trợ -> bỏ qua
  };

  const text = String(rawText === undefined || rawText === null ? "" : rawText).replace(/<\/?(?:i|b|u|s|font)\b[^>]*>/gi, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\r") continue;
    if (ch === "\n") {
      flush(); // xuống dòng thật (sub SRT) giống \N
      lines.push([]);
      continue;
    }
    if (ch === "{") {
      const end = text.indexOf("}", i);
      if (end > i) {
        flush();
        splitTags(text.slice(i + 1, end)).forEach(applyTag);
        i = end;
        continue;
      }
    }
    if (ch === "\\" && i + 1 < text.length) {
      const nx = text[i + 1];
      if (nx === "N") {
        flush();
        lines.push([]);
        i++;
        continue;
      }
      if (nx === "n") {
        buf += " "; // xuống dòng mềm của ASS -> khoảng trắng
        i++;
        continue;
      }
      if (nx === "h") {
        buf += "\u00a0";
        i++;
        continue;
      }
    }
    buf += ch;
  }
  flush();

  // Bỏ dòng trống ở đầu/cuối, dòng trống ở giữa giữ lại một khoảng trắng để không bị xẹp
  while (lines.length && !lines[0].length) lines.shift();
  while (lines.length && !lines[lines.length - 1].length) lines.pop();
  lines = lines.map((l) => (l.length ? l : [{ text: "\u00a0", ...base }]));

  return { pos, an, lines };
};

// Văn bản thuần của cue (dùng cho khung danh sách phụ đề)
export const plainCueText = (rawText) =>
  parseAssCue(rawText, DEFAULT_ASS_STYLE, null)
    .lines.map((l) => l.map((s) => s.text).join(""))
    .join(" ")
    .replace(/\u00a0/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
