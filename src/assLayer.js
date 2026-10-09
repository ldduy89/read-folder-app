import React from "react";
import { ASS_DEFAULT_RES, DEFAULT_ASS_STYLE, parseAssCue, readCueMeta } from "./assText";

const H_ALIGN = ["left", "center", "right"];
const TEXT_BOX = "#000"; // nền chữ đen đặc (đổi thành "transparent" nếu muốn bỏ nền)

// Font phụ đề (khai báo @font-face trong App.css)
const SUB_FONT = '"UVN La Xanh", Tahoma, sans-serif';
// true: mọi sub dùng font trên; false: sub ASS nào khai báo font riêng thì dùng font đó, font trên chỉ là dự phòng
const SUB_FONT_FORCE = true;
// Chiều cao dòng (không đơn vị nên tự co giãn theo cỡ chữ). Mỗi dòng sub có nền đen riêng, vẽ theo chiều cao nội tại của font
// (font UVN La Xanh: ascent 1.112em + descent 0.251em = 1.363em) cộng padding dọc 2 x 0.04em = 1.443em.
// Nếu line-height nhỏ hơn số này thì nền đen của dòng dưới đè lên phần đuôi chữ (g, p, y, dấu nặng...) của dòng trên.
// Đổi font khác thì chỉnh lại số này cho bằng (ascent + descent + 0.08).
const SUB_LINE_HEIGHT = 1.44;

const segStyle = (seg, sy, resY, wrap) => ({
  fontFamily: SUB_FONT_FORCE || !seg.font ? SUB_FONT : `"${seg.font}", ${SUB_FONT}`,
  fontSize: Math.max((seg.fs || resY / 18) * sy, 8) + "px",
  fontWeight: seg.bold ? 700 : 400,
  fontStyle: seg.italic ? "italic" : "normal",
  textDecoration: [seg.underline && "underline", seg.strike && "line-through"].filter(Boolean).join(" ") || "none",
  color: seg.color,
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

const renderLines = (parsed, sy, resY, col, wrap) =>
  parsed.lines.map((line, li) => (
    <div key={li} style={{ fontSize: 0, lineHeight: 0, textAlign: H_ALIGN[col] }}>
      {line.map((seg, si) => (
        <span key={si} style={segStyle(seg, sy, resY, wrap)}>
          {seg.text}
        </span>
      ))}
    </div>
  ));

/**
 * Vẽ các cue đang hiển thị theo thiết lập trong sub ASS.
 *  liveCues: [{ key, id, text }]   id = identifier của cue (mang tên style, margin)
 *  assMeta:  { playResX, playResY, styles } từ /subtitles-style (có thể rỗng)
 *  pic:      { left, top, width, height } vùng hình video thật sự hiển thị trong khung
 */
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
          {renderLines(parsed, sy, resY, col, false)}
        </PositionedCue>
      );
      return;
    }

    // Không có \pos: xếp theo alignment + margin; các dòng cùng vị trí xếp chồng lên nhau
    const g = groups[an] || (groups[an] = { col, row, style, m, nodes: [] });
    g.nodes.push(
      <div key={key} style={{ textAlign: H_ALIGN[col] }}>
        {renderLines(parsed, sy, resY, col, true)}
      </div>
    );
  });

  // Sub 2: chữ thường (không đậm), nhỏ hơn, nằm dưới sub 1 (nút đầu tiên của nhóm căn dưới-giữa = sát đáy)
  const secondary = (opts.secondary || []).filter((c) => c && c.text);
  if (secondary.length) {
    const baseStyle = styles.Default || styles[styleNames[0]] || {};
    const secFs = (baseStyle.fontSize || resY / 18) * 0.8;
    const secLines = [];
    secondary.forEach((c) => {
      parseAssCue(c.text, DEFAULT_ASS_STYLE, null).lines.forEach((line) => {
        const t = line.map((seg) => seg.text).join("").replace(/\u00a0/g, " ").trim();
        if (t) secLines.push(t);
      });
    });
    if (secLines.length) {
      const segSec = { font: "", fs: secFs, bold: false, italic: false, underline: false, strike: false, color: "#f2f2f2" };
      const node = (
        <div key="sec2" style={{ textAlign: "center" }}>
          {secLines.map((t, i) => (
            <div key={i} style={{ fontSize: 0, lineHeight: 0, textAlign: "center" }}>
              <span style={segStyle(segSec, sy, resY, true)}>{t}</span>
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
      if (opts.controlsHidden) {
        // Thanh điều khiển đã ẩn: hạ phụ đề xuống sát đáy hình (margin theo sub, tối thiểu 4% chiều cao)
        st.bottom = Math.max(mV, pic.height * 0.04) + "px";
      } else {
        // Thanh điều khiển đang hiện: chừa chỗ phía trên nó
        st.bottom = `calc(var(--width-bar, 50px) + var(--bar-gap, 0px) + ${mV}px)`;
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
        zIndex: 15,
        pointerEvents: "none"
      }}
      // sự kiện chuột chỉ tới được đây khi bấm trúng chữ sub: không cho lan ra làm play/pause hay phóng to
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
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
