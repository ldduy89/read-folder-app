import React from "react";
import { CheckIcon } from "../icons";

// Nút một mục trong menu popup (phụ đề, tốc độ, font, audio, độ trễ).
// action: nút hành động (không có trạng thái chọn, có class v-action).
// active: đang được chọn.
// Các prop còn lại (data-*, style, ...) được truyền thẳng xuống <button>.
export default function TrackButton({ action = false, active = false, children, ...rest }) {
  return (
    <button
      className={`v-trackButton ${action ? "v-action " : ""}block w-full appearance-none border-none outline-none cursor-pointer [font-family:inherit] text-left relative whitespace-nowrap bg-[#f3f4f6] text-[#1b2233] rounded-[10px] py-[0.6em] pl-[1em] pr-[2.8em] [transition:background-color_0.25s_ease] hover:bg-[#eceef3] [&.v-active]:!bg-[#e6eeff] [&.v-active]:!text-[#0f1a33] [&.v-active]:!font-semibold [&.v-action]:pr-[1.1em] coarse:min-h-[44px] coarse:!p-[10px_44px_10px_16px] [&.v-action]:coarse:!pr-[16px]${active ? " v-active" : ""}`}
      {...rest}
    >
      {!action && <CheckIcon />}
      {children}
    </button>
  );
}
