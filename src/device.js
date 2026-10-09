// Nhận biết đang chạy trên TV hay PC/điện thoại.
// Có thể ép thủ công bằng cách thêm ?tv=1 (ép TV) hoặc ?tv=0 (ép chuột) vào địa chỉ trang.
const TV_UA = /SmartTV|Smart-TV|SMART-TV|Tizen|Web0S|WebOS|NetCast|HbbTV|VIDAA|BRAVIA|Hisense|Viera|PhilipsTV|Opera TV|GoogleTV|Android TV|AFTT|AFTM|AFTB|CrKey|AppleTV|Roku/i;

export const isTV = () => {
  try {
    const forced = new URLSearchParams(window.location.search).get("tv");
    if (forced === "1") return true;
    if (forced === "0") return false;
  } catch (e) {}

  const ua = navigator.userAgent || "";

  // 1. UA của TV thường có từ khoá riêng (Samsung Tizen, LG webOS, Fire TV, Chromecast...)
  if (TV_UA.test(ua)) return true;

  // 2. Android TV box: UA là Android nhưng không có "Mobile", và không có con trỏ hoặc màn hình lớn
  const isAndroidBox = /Android/i.test(ua) && !/Mobile/i.test(ua);
  const noPointer = window.matchMedia && window.matchMedia("(pointer: none)").matches;
  if (isAndroidBox && (noPointer || window.screen.width >= 1280)) return true;

  return false;
};

// Màn hình cảm ứng là thiết bị chính (điện thoại, máy tính bảng). Ép thủ công bằng ?touch=1 / ?touch=0 (để thử trên máy tính).
export const isTouch = () => {
  try {
    const forced = new URLSearchParams(window.location.search).get("touch");
    if (forced === "1") return true;
    if (forced === "0") return false;
  } catch (e) {}
  const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  return coarse && (navigator.maxTouchPoints || 0) > 0;
};
