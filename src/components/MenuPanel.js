import React from "react";

// Khung popup nổi phía trên nút trên thanh điều khiển.
// open: bật/tắt hiển thị. extra: class thêm (ví dụ căn phải cho menu audio).
const BASE =
  "v-subtitlesList box-border !p-[0.8em_0.8em_0.7em] bg-[rgba(250,250,252,0.98)] text-[#1b2233] !border !border-solid !border-[rgba(0,0,0,0.06)] rounded-[14px] shadow-[0_10px_30px_rgba(0,0,0,0.45)] overflow-auto max-w-[calc(100vw-20px)] max-h-[var(--menu-max-h,70vh)] absolute bottom-[calc(var(--width-bar)+var(--bar-gap,0px))] left-1/2 z-30 [transform:translateX(-50%)] [transition:opacity_0.25s_ease,visibility_0.25s_ease]";

export default function MenuPanel({ open, extra = "", children }) {
  return (
    <div className={`${BASE}${extra ? ` ${extra}` : ""} ${open ? "v-active opacity-100 visible" : "opacity-0 invisible"}`}>
      {children}
    </div>
  );
}
