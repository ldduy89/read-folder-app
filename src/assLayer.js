import React from "react";
import { ASS_DEFAULT_RES, DEFAULT_ASS_STYLE, parseAssCue, readCueMeta } from "./assText";

const H_ALIGN = ["left", "center", "right"];
const TEXT_BOX = "#000"; // nền chữ đen đặc (đổi thành "transparent" nếu muốn bỏ nền)

const segStyle = (seg, sy, resY, wrap) => ({
  fontFamily: seg.font ? `"${seg.font}", Tahoma, sans-serif` : "Tahoma, sans-serif",
  fontSize: Math.max((seg.fs || resY / 18) * sy, 8) + "px",
  fontWeight: seg.bold ? 700 : 400,
  fontStyle: seg.italic ? "italic" : "normal",
  textDecoration: [seg.underline && "underline", seg.strike && "line-through"].filter(Boolean).join(" ") || "none",
  color: seg.color,
  background: TEXT_BOX,
  lineHeight: 1.25,
  padding: "0.04em 0.28em",
  whiteSpace: wrap ? "pre-wrap" : "pre",
  WebkitBoxDecorationBreak: "clone",
  boxDecorationBreak: "clone"
});

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
export const buildAssLayer = (liveCues, assMeta, pic) => {
  if (!pic || !pic.width || !pic.height || !liveCues || !liveCues.length) return null;
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
        <div
          key={key}
          style={{
            position: "absolute",
            left: parsed.pos.x * sx + "px",
            top: parsed.pos.y * sy + "px",
            width: "max-content",
            transform: `translate(${["0%", "-50%", "-100%"][col]}, ${["-100%", "-50%", "0%"][row]})`,
            zIndex: m.layer || 0
          }}
        >
          {renderLines(parsed, sy, resY, col, false)}
        </div>
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
      // Dưới: chừa chỗ cho thanh điều khiển của player
      st.bottom = `calc(var(--width-bar, 50px) + ${mV}px)`;
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
    >
      {groupEls}
      {positioned}
    </div>
  );
};
