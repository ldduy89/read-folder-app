import React from "react";
import { ASS_DEFAULT_RES, DEFAULT_ASS_STYLE, parseAssCue, readCueMeta } from "./assText";

const H_ALIGN = ["left", "center", "right"];
const TEXT_BOX = "#000"; // nền chữ đen đặc (đổi thành "transparent" nếu muốn bỏ nền)

// Font phụ đề (khai báo @font-face trong App.css)
const SUB_FONT = '"UVN La Xanh", Tahoma, sans-serif';
// true: mọi sub dùng font trên; false: sub ASS nào khai báo font riêng thì dùng font đó, font trên chỉ là dự phòng
const SUB_FONT_FORCE = true;
// Màu chữ sub: màu mặc định của app (DEFAULT_ASS_STYLE.primary, vàng) thay cho màu khai báo trong file sub (có sub chọn màu khó nhìn)
const SUB_COLOR = DEFAULT_ASS_STYLE.primary;
// true: mọi sub dùng SUB_COLOR; false: dùng màu trong file sub (style và thẻ {\c&H...&})
const SUB_COLOR_FORCE = true;
// Chiều cao dòng (không đơn vị nên tự co giãn theo cỡ chữ). Mỗi dòng sub có nền đen riêng, vẽ theo chiều cao nội tại của font
// (font UVN La Xanh: ascent 1.112em + descent 0.251em = 1.363em) cộng padding dọc 2 x 0.04em = 1.443em.
// Nếu line-height nhỏ hơn số này thì nền đen của dòng dưới đè lên phần đuôi chữ (g, p, y, dấu nặng...) của dòng trên.
// Đổi font khác thì chỉnh lại số này cho bằng (ascent + descent + 0.08).
const SUB_LINE_HEIGHT = 1.44;

// Cỡ chữ sub tối đa theo tỉ lệ chiều cao hình video (mặc định khi file sub không đặt cỡ là 1/18 ≈ 0.056). Hạ số này nếu chữ vẫn to, tăng nếu muốn cho phép to hơn.
const SUB_FONT_MAX_RATIO = 0.07;

const segStyle = (seg, sy, resY, wrap) => ({
  fontFamily: SUB_FONT_FORCE || !seg.font ? SUB_FONT : `"${seg.font}", ${SUB_FONT}`,
  // Chặn chữ sub quá to: file sub đặt cỡ chữ lớn thì cũng không vượt SUB_FONT_MAX_RATIO chiều cao hình (resY * sy = chiều cao hình)
  fontSize: Math.min(Math.max((seg.fs || resY / 18) * sy, 8), Math.max(resY * sy * SUB_FONT_MAX_RATIO, 8)) + "px",
  fontWeight: seg.bold ? 700 : 400,
  fontStyle: seg.italic ? "italic" : "normal",
  textDecoration: [seg.underline && "underline", seg.strike && "line-through"].filter(Boolean).join(" ") || "none",
  color: SUB_COLOR_FORCE && !seg.keepColor ? SUB_COLOR : seg.color,
  background: TEXT_BOX,
  lineHeight: SUB_LINE_HEIGHT,
  padding: "0.04em 0.28em",
  whiteSpace: wrap ? "pre-wrap" : "pre",
  WebkitBoxDecorationBreak: "clone",
  boxDecorationBreak: "clone",
  // Cho phép bôi đen / copy chữ sub (lớp bao ngoài vẫn pointer-events:none nên vùng trống không chặn click của video)
  pointerEvents: "auto",
  userSelect: "text",
  WebkitUserSelect: "text",
  cursor: "text"
});


// ---------- Bấm vào một từ trong sub = bấm đúp vào từ đó ----------
const isWordChar = (ch) => !!ch && /[\p{L}\p{M}\p{N}_]/u.test(ch);

// Ký tự nằm đúng toạ độ (x, y) trong một text node; -1 nếu bấm ra ngoài chữ (vd vùng padding)
const charIndexAt = (node, x, y) => {
  const r = document.createRange();
  for (let i = 0; i < node.data.length; i++) {
    r.setStart(node, i);
    r.setEnd(node, i + 1);
    const rects = r.getClientRects();
    for (let k = 0; k < rects.length; k++) {
      const b = rects[k];
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return i;
    }
  }
  return -1;
};

// { range, text } bao trọn từ ở vị trí bấm (giống cách trình duyệt chọn khi bấm đúp), hoặc cả đoạn đã lưu nếu bấm vào chữ đang tô sáng; null nếu bấm vào khoảng trắng / ngoài chữ
// Đoạn chữ (data-sub-seg) có thể gồm nhiều text node vì từ đã lưu nằm trong <span> riêng, nên duyệt hết các text node
const wordRangeAt = (target, x, y) => {
  const root = target && ((target.closest && target.closest("[data-sub-seg]")) || target);
  if (!root) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const at = charIndexAt(node, x, y);
    if (at < 0) continue;
    const text = node.data;
    // Bấm vào từ / cụm / câu đã lưu (đang tô sáng): chọn nguyên cả đoạn đã lưu, không chỉ một từ
    const hitId = node.parentNode && node.parentNode.getAttribute ? node.parentNode.getAttribute("data-sub-hit") : null;
    if (hitId) {
      const els = hitGroup(hitId); // câu đã lưu có thể nằm trên nhiều dòng / nhiều đoạn: lấy cả nhóm
      if (els.length) return { range: hitGroupRange(els), text: hitGroupText(els) };
    }
    // dấu ' nằm giữa 2 chữ (don't) vẫn thuộc về từ
    const inWord = (i) =>
      i >= 0 && i < text.length && (isWordChar(text[i]) || ((text[i] === "'" || text[i] === "\u2019") && isWordChar(text[i - 1]) && isWordChar(text[i + 1])));
    if (!inWord(at)) return null;
    let s = at;
    let e = at + 1;
    while (inWord(s - 1)) s--;
    while (inWord(e)) e++;
    const range = document.createRange();
    range.setStart(node, s);
    range.setEnd(node, e);
    return { range, text: range.toString().replace(/\s+/g, " ").trim() };
  }
  return null;
};

// Thời gian chờ từ lúc bấm đến lúc bôi đen từ (ms). Đổi số này để chỉnh nhanh / chậm.
const SELECT_DELAY_MS = 0; // 0 = bôi đen và dịch ngay khi bấm
// Sau khi người dùng tự bôi đen bằng chuột, chờ chừng này ms rồi mới dịch (không dịch từng nhịp kéo chọn)
const MANUAL_SELECT_MS = 350;
let selectTimer = null;
let manualTimer = null;

const anchorOf = (range) => {
  const r = range.getBoundingClientRect();
  return { x: r.left, y: r.bottom, top: r.top };
};

// Bấm một lần vào một từ trong sub -> bôi đen từ đó và dịch (opts.onWord), sau SELECT_DELAY_MS ms nếu số này > 0
const dblClickWord = (e, opts) => {
  clearTimeout(selectTimer); // bấm chỗ khác thì huỷ lần bôi đen đang chờ
  if (e.detail > 1) return; // người dùng tự bấm đúp thật: trình duyệt đã tự chọn từ (mouseup bên dưới sẽ lo việc dịch)
  const sel = window.getSelection && window.getSelection();
  if (!sel || !sel.isCollapsed) return; // vừa kéo chuột bôi đen: giữ nguyên vùng chọn của người dùng
  const found = wordRangeAt(e.target, e.clientX, e.clientY);
  if (!found) return;
  const { range, text } = found;
  const run = () => {
    const cur = window.getSelection();
    if (!cur || !cur.isCollapsed) return; // trong lúc chờ người dùng đã tự bôi đen
    if (!range.startContainer.isConnected) return; // sub đã đổi sang câu khác
    cur.removeAllRanges();
    cur.addRange(range);
    if (opts && opts.onWord) opts.onWord(text, anchorOf(range));
  };
  if (SELECT_DELAY_MS > 0) selectTimer = setTimeout(run, SELECT_DELAY_MS);
  else run(); // không chờ: chạy luôn trong cú bấm
};

// Người dùng tự bôi đen (kéo chuột hoặc bấm đúp thật) trong chữ sub -> dịch đoạn đang chọn
const manualSelect = (e, opts) => {
  if (!e.nativeEvent.isTrusted) return;
  const layer = e.currentTarget;
  clearTimeout(manualTimer);
  manualTimer = setTimeout(() => {
    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const text = sel.toString().replace(/\s+/g, " ").trim(); // xuống dòng coi như dấu cách
    if (!text || !layer.contains(sel.anchorNode)) return;
    if (opts && opts.onWord) opts.onWord(text, anchorOf(sel.getRangeAt(0)));
  }, MANUAL_SELECT_MS);
};

// Cue có \pos: neo theo toạ độ của sub, nhưng nếu khối chữ rộng hơn khoảng trống thì đẩy lại cho nằm trọn trong khung hình
// (tránh bị cắt mất một đầu như "anh Long Tông"), giống cách libass giữ sub trong màn hình.
const PositionedCue = ({ left, top, tx, ty, picW, picH, zIndex, children }) => {
  const ref = React.useRef(null);
  const [shift, setShift] = React.useState({ x: 0, y: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const l = left + tx * w; // mép trái/trên khi chưa dịch
    const t = top + ty * h;
    let x = 0;
    let y = 0;
    if (w >= picW) x = -l; // rộng hơn cả khung: ưu tiên hiện từ mép trái
    else if (l < 0) x = -l;
    else if (l + w > picW) x = picW - (l + w);
    if (h >= picH) y = -t;
    else if (t < 0) y = -t;
    else if (t + h > picH) y = picH - (t + h);
    setShift((p) => (Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5 ? p : { x, y }));
  });
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: left + "px",
        top: top + "px",
        width: "max-content",
        maxWidth: picW + "px",
        transform: `translate(calc(${tx * 100}% + ${shift.x}px), calc(${ty * 100}% + ${shift.y}px))`,
        zIndex
      }}
    >
      {children}
    </div>
  );
};

// ---------- Tô sáng từ đã lưu trong sub ----------
const SAVED_HL = { color: "#4fc3f7", textDecoration: "underline" };
const WORD_BEFORE = "(^|[^\\p{L}\\p{M}\\p{N}_])";
const WORD_AFTER = "(?![\\p{L}\\p{M}\\p{N}_])";

// Gộp danh sách từ / cụm / câu đã lưu (tối đa 300 ký tự mỗi mục) thành một biểu thức chính quy (khớp nguyên từ, không phân biệt hoa thường). Rỗng hoặc lỗi -> null
export const buildSavedMatcher = (list) => {
  const items = [...new Set((list || []).map((x) => String(x || "").trim().toLowerCase()).filter((x) => x && x.length <= 300))].sort((a, b) => b.length - a.length);
  if (!items.length) return null;
  try {
    const alt = items.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")).join("|");
    return new RegExp(WORD_BEFORE + "(" + alt + ")" + WORD_AFTER, "giu");
  } catch (e) {
    return null;
  }
};

// Vị trí các đoạn đã lưu trong text: [{ start, end }] (tăng dần, không chồng nhau)
const findHits = (text, re) => {
  const out = [];
  if (!re) return out;
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text))) {
    const start = m.index + m[1].length;
    const end = start + m[2].length;
    if (end === start) {
      re.lastIndex++;
      continue;
    }
    out.push({ start, end });
  }
  return out;
};

// Một đoạn đã lưu có thể nằm trên nhiều <span> (câu ngắt dòng \N, hoặc đổi màu giữa câu): các <span> cùng data-sub-hit là một nhóm
export const hitGroup = (id) => Array.from(document.querySelectorAll("[data-sub-hit]")).filter((el) => el.getAttribute("data-sub-hit") === id);

// Ghép chữ của nhóm: khác dòng -> 1 dấu cách (\N coi như dấu cách), cùng dòng (đổi màu giữa câu) -> nối liền
const hitGroupText = (els) => {
  let text = "";
  let prevLine = null;
  els.forEach((el) => {
    const line = el.closest("div");
    if (prevLine && line !== prevLine) text += " ";
    text += el.textContent;
    prevLine = line;
  });
  return text.replace(/\s+/g, " ").trim();
};

const hitGroupRange = (els) => {
  const r = document.createRange();
  r.setStartBefore(els[0]);
  r.setEndAfter(els[els.length - 1]);
  return r;
};

// ---------- Rê chuột vào từ đã lưu một lúc -> dịch luôn ----------
const HOVER_MS = 500; // rê chuột lên từ đã lưu chừng này ms thì mở cửa sổ dịch. Đổi số này để chỉnh nhanh / chậm
let hoverTimer = null;
let hoverId = null;

const clearHover = () => {
  clearTimeout(hoverTimer);
  hoverTimer = null;
  hoverId = null;
};

/**
 * Trả về { onMouseOver, onMouseOut } gắn vào một khung chứa chữ sub (lớp phụ đề trên video, khung danh sách bên phải).
 * Chỉ từ / câu đã lưu (đang tô sáng, có data-sub-hit) mới kích hoạt; onWord(text, anchor) giống lúc bấm chọn từ.
 */
export const hoverSavedHandlers = (onWord) => ({
  onMouseOver: (e) => {
    const hit = e.target && e.target.closest ? e.target.closest("[data-sub-hit]") : null;
    if (!hit) return clearHover();
    const id = hit.getAttribute("data-sub-hit");
    if (id === hoverId) return; // vẫn đang ở trên cùng đoạn đó
    clearHover();
    if (e.buttons) return; // đang giữ nút chuột (kéo bôi đen): không dịch
    hoverId = id; // giữ hoverId sau khi đã mở để rê tiếp trên cùng đoạn không mở lại; ra khỏi đoạn rồi vào lại mới mở lại
    hoverTimer = setTimeout(() => {
      hoverTimer = null;
      const els = hitGroup(id);
      if (!els.length) return;
      const text = hitGroupText(els);
      const r = hitGroupRange(els).getBoundingClientRect();
      if (text && onWord) onWord(text, { x: r.left, y: r.bottom, top: r.top }, { hoverId: id }); // hoverId: để cửa sổ dịch tự đóng khi chuột rời khỏi đoạn này
    }, HOVER_MS);
  },
  onMouseOut: (e) => {
    if (!hoverId) return;
    const to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest("[data-sub-hit]") : null;
    if (!to || to.getAttribute("data-sub-hit") !== hoverId) clearHover();
  }
});

// Hiển thị một đoạn chữ nằm từ vị trí `offset` của cả cue; phần giao với các đoạn đã lưu (hits) được tô sáng. uid: mã của cue, để gom các phần của cùng một đoạn đã lưu
const renderPieces = (text, offset, hits, uid) => {
  const a = offset;
  const b = offset + text.length;
  const nodes = [];
  let pos = a;
  hits.forEach((h, hi) => {
    const st = Math.max(h.start, a);
    const en = Math.min(h.end, b);
    if (en <= st) return;
    if (st > pos) nodes.push(<React.Fragment key={"t" + hi}>{text.slice(pos - a, st - a)}</React.Fragment>);
    nodes.push(
      <span key={"h" + hi} data-sub-hit={uid + ":" + hi} style={SAVED_HL}>
        {text.slice(st - a, en - a)}
      </span>
    );
    pos = en;
  });
  if (!nodes.length) return text;
  if (pos < b) nodes.push(<React.Fragment key="end">{text.slice(pos - a)}</React.Fragment>);
  return nodes;
};

// Dùng cho khung danh sách phụ đề bên phải (home.js): uid phải khác nhau giữa các câu (vd "c" + số thứ tự)
export const highlightSaved = (text, saved, uid = "p") => renderPieces(text, 0, findHits(text, saved), uid);

// Ghép cả cue thành một chuỗi (xuống dòng \N = 1 dấu cách) rồi mới khớp, để câu đã lưu nằm trên nhiều dòng / nhiều đoạn chữ vẫn được tô sáng
const renderLines = (parsed, sy, resY, col, wrap, saved, uid) => {
  const starts = [];
  const parts = [];
  let pos = 0;
  parsed.lines.forEach((line, li) => {
    if (li > 0) {
      parts.push(" ");
      pos += 1;
    }
    starts[li] = [];
    line.forEach((seg, si) => {
      starts[li][si] = pos;
      parts.push(seg.text);
      pos += seg.text.length;
    });
  });
  const hits = findHits(parts.join(""), saved);
  return parsed.lines.map((line, li) => (
    <div key={li} style={{ fontSize: 0, lineHeight: 0, textAlign: H_ALIGN[col] }}>
      {line.map((seg, si) => (
        <span key={si} data-sub-seg="1" style={segStyle(seg, sy, resY, wrap)}>
          {renderPieces(seg.text, starts[li][si], hits, uid)}
        </span>
      ))}
    </div>
  ));
};

/**
 * Vẽ các cue đang hiển thị theo thiết lập trong sub ASS.
 *  liveCues: [{ key, id, text }]   id = identifier của cue (mang tên style, margin)
 *  assMeta:  { playResX, playResY, styles } từ /subtitles-style (có thể rỗng)
 *  pic:      { left, top, width, height } vùng hình video thật sự hiển thị trong khung
 */
// Khoảng cách giữa sub và thanh điều khiển / thanh thời lượng khi thanh đang hiện, tính theo tỉ lệ chiều cao hình video. Tăng số này để sub cao hơn nữa.
const SUB_BAR_GAP_RATIO = 0.025;

export const buildAssLayer = (liveCues, assMeta, pic, opts = {}) => {
  if (!pic || !pic.width || !pic.height) return null;
  liveCues = liveCues || [];
  if (!liveCues.length && !(opts.secondary && opts.secondary.length)) return null;
  const meta = assMeta || {};
  // Thiếu PlayRes (cache cũ / track không có header): dùng kích thước thật của video thay vì 1920x1080 cố định,
  // vì đa số sub được làm theo đúng độ phân giải video (vd 4K = 3840x2160) -> vị trí & cỡ chữ không bị lệch 2 lần
  const hasRes = meta.playResX && meta.playResY;
  const resX = hasRes ? meta.playResX : pic.vw || ASS_DEFAULT_RES.x;
  const resY = hasRes ? meta.playResY : pic.vh || ASS_DEFAULT_RES.y;
  const sx = pic.width / resX;
  const sy = pic.height / resY;
  const styles = meta.styles || {};
  const styleNames = Object.keys(styles);
  const hasStyles = styleNames.length > 0;

  const positioned = [];
  const groups = {};

  liveCues.forEach((c, idx) => {
    const m = readCueMeta(c.id);
    const found = hasStyles ? styles[m.style] || styles.Default || styles[styleNames[0]] : null;
    const style = { ...DEFAULT_ASS_STYLE, ...(found || {}) };
    const parsed = parseAssCue(c.text, style, hasStyles ? styles : null);
    if (!parsed.lines.length) return;

    const an = parsed.an || style.alignment || 2;
    const col = (an - 1) % 3; // 0 trái, 1 giữa, 2 phải
    const row = Math.floor((an - 1) / 3); // 0 dưới, 1 giữa, 2 trên
    const key = `${idx}:${c.key}`;

    if (parsed.pos) {
      // Có \pos / \move: đặt đúng toạ độ, neo theo alignment của dòng
      positioned.push(
        <PositionedCue
          key={key}
          left={parsed.pos.x * sx}
          top={parsed.pos.y * sy}
          tx={[0, -0.5, -1][col]}
          ty={[-1, -0.5, 0][row]}
          picW={pic.width}
          picH={pic.height}
          zIndex={m.layer || 0}
        >
          {renderLines(parsed, sy, resY, col, false, opts.saved, key)}
        </PositionedCue>
      );
      return;
    }

    // Không có \pos: xếp theo alignment + margin; các dòng cùng vị trí xếp chồng lên nhau
    const g = groups[an] || (groups[an] = { col, row, style, m, nodes: [] });
    g.nodes.push(
      <div key={key} style={{ textAlign: H_ALIGN[col] }}>
        {renderLines(parsed, sy, resY, col, true, opts.saved, key)}
      </div>
    );
  });

  // Sub 2: chữ thường (không đậm), nhỏ hơn, nằm dưới sub 1 (nút đầu tiên của nhóm căn dưới-giữa = sát đáy)
  const secondary = (opts.secondary || []).filter((c) => c && c.text);
  if (secondary.length) {
    const baseStyle = styles.Default || styles[styleNames[0]] || {};
    const secFs = Math.min((baseStyle.fontSize || resY / 18) * 0.8, resY * SUB_FONT_MAX_RATIO * 0.8); // sub 2 nhỏ hơn sub 1 và cũng bị chặn cỡ tối đa
    const secLines = [];
    secondary.forEach((c) => {
      parseAssCue(c.text, DEFAULT_ASS_STYLE, null).lines.forEach((line) => {
        const t = line.map((seg) => seg.text).join("").replace(/\u00a0/g, " ").trim();
        if (t) secLines.push(t);
      });
    });
    if (secLines.length) {
      const segSec = { font: "", fs: secFs, bold: false, italic: false, underline: false, strike: false, color: "#f2f2f2", keepColor: true }; // keepColor: sub 2 giữ màu trắng riêng, không bị ép sang màu sub 1
      const secStarts = [];
      let secPos = 0;
      secLines.forEach((t, i) => {
        if (i > 0) secPos += 1; // xuống dòng = 1 dấu cách
        secStarts[i] = secPos;
        secPos += t.length;
      });
      const secHits = findHits(secLines.join(" "), opts.saved);
      const node = (
        <div key="sec2" style={{ textAlign: "center" }}>
          {secLines.map((t, i) => (
            <div key={i} style={{ fontSize: 0, lineHeight: 0, textAlign: "center" }}>
              <span data-sub-seg="1" style={segStyle(segSec, sy, resY, true)}>{renderPieces(t, secStarts[i], secHits, "sec")}</span>
            </div>
          ))}
        </div>
      );
      const g = groups[2] || (groups[2] = { col: 1, row: 0, style: { ...DEFAULT_ASS_STYLE }, m: {}, nodes: [] });
      g.nodes.unshift(node);
    }
  }

  const groupEls = Object.keys(groups).map((k) => {
    const g = groups[k];
    const mL = (g.m.marginL || g.style.marginL || 0) * sx;
    const mR = (g.m.marginR || g.style.marginR || 0) * sx;
    const mV = (g.m.marginV || g.style.marginV || 0) * sy;
    const st = {
      position: "absolute",
      left: mL + "px",
      right: mR + "px",
      display: "flex",
      flexDirection: g.row === 0 ? "column-reverse" : "column"
    };
    if (g.row === 0) {
      st.transition = "bottom .25s ease-in"; // cùng tốc độ với thanh điều khiển ẩn/hiện
      const gap = Math.max(10, Math.round(pic.height * SUB_BAR_GAP_RATIO));
      if (opts.controlsHidden) {
        // Thanh điều khiển đã ẩn: hạ phụ đề xuống sát đáy hình (margin theo sub, tối thiểu 4% chiều cao).
        // Thanh ẩn vẫn nằm đè ở đó, nên lớp sub được nâng lên trên thanh (zIndex bên dưới) để bấm vào chữ không bị trúng thanh thời lượng
        st.bottom = Math.max(mV, pic.height * 0.04) + "px";
      } else {
        // Thanh điều khiển đang hiện: chừa chỗ phía trên nó + một khoảng trống nhỏ để khỏi bấm nhầm vào thanh thời lượng
        st.bottom = `calc(var(--width-bar, 50px) + var(--bar-gap, 0px) + ${mV + gap}px)`;
      }
    } else if (g.row === 2) {
      st.top = mV + "px";
    } else {
      st.top = "50%";
      st.transform = "translateY(-50%)";
    }
    return (
      <div key={`g${k}`} style={st}>
        {g.nodes}
      </div>
    );
  });

  return (
    <div
      style={{
        position: "absolute",
        left: pic.left + "px",
        top: pic.top + "px",
        width: pic.width + "px",
        height: pic.height + "px",
        zIndex: opts.controlsHidden ? 35 : 15, // thanh điều khiển ẩn: sub nổi trên thanh (30) để không bấm nhầm vào thanh vô hình
        pointerEvents: "none"
      }}
      // sự kiện chuột chỉ tới được đây khi bấm trúng chữ sub: không cho lan ra làm play/pause hay phóng to
      onClick={(e) => {
        e.stopPropagation();
        dblClickWord(e, opts);
      }}
      onMouseUp={(e) => manualSelect(e, opts)}
      {...(opts.hover ? hoverSavedHandlers(opts.onWord) : {})}
      // Không chặn dblclick: lớp phụ đề không nằm trong lớp bắt phóng to nên không cần, và chặn sẽ làm sự kiện không tới được tiện ích tra từ
      onMouseDown={(e) => {
        e.stopPropagation();
        if (opts.onGrab) opts.onGrab(); // bấm vào chữ -> tạm dừng để bôi đen kịp
      }}
    >
      {groupEls}
      {positioned}
    </div>
  );
};
