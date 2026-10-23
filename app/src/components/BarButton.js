import React from "react";

// Ô nút trên thanh điều khiển video.
// name: "v-subtitle" dùng icon bọc trong span.v-subIcon và style [&_.v-subIcon_svg];
//       các nút khác (v-volume, v-fullscreen) dùng style [&_svg].
// icon: nội dung icon. children: menu popup (nếu có) đặt cạnh icon.
// extra: class thêm vào (v-muted, v-exit).
const BASE = "relative inline-block w-[var(--width-bar)] h-full cursor-pointer";
const SUB_ICON =
  "[&_.v-subIcon_svg]:fill-white [&_.v-subIcon_svg]:opacity-[.85] [&_.v-subIcon_svg]:h-full [&_.v-subIcon_svg]:w-full [&_.v-subIcon_svg]:[transition:opacity_.25s]";
const ICON = "[&_svg]:fill-white [&_svg]:opacity-[.85] [&_svg]:h-full [&_svg]:w-full [&_svg]:[transition:opacity_.25s]";

export default function BarButton({ name, id, style, onClick, extra = "", icon, children }) {
  const isSub = name === "v-subtitle";
  return (
    <div
      className={`${name} ${BASE} ${isSub ? SUB_ICON : ICON}${extra ? ` ${extra}` : ""}`}
      id={id}
      style={style}
      onClick={onClick}
    >
      {isSub ? <span className="v-subIcon w-full h-full">{icon}</span> : icon}
      {children}
    </div>
  );
}
