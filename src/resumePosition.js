// Lưu vị trí xem video (localStorage). Khoá là đường dẫn file, giá trị là số giây đã xem.
const STORAGE_KEY = "resumePositions";
export const RESUME_MAX_FRACTION = 0.9; // xem quá 90% thì coi như đã xem xong, xoá lưu

const readAll = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
};

const writeAll = (map) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {}
};

// Trả về số giây đã lưu của file, hoặc null nếu không có
export const getResume = (path) => {
  const s = readAll()[path];
  return typeof s === "number" && s > 0 ? s : null;
};

export const setResume = (path, seconds) => {
  const sec = Math.floor(seconds);
  const map = readAll();
  if (map[path] === sec) return; // không ghi lại khi không đổi
  map[path] = sec;
  writeAll(map);
};

export const clearResume = (path) => {
  const map = readAll();
  if (!(path in map)) return;
  delete map[path];
  writeAll(map);
};

// Xoá các vị trí của file trong thư mục đã không còn tồn tại
export const pruneResumeInFolder = (folder, fileNames) => {
  const prefix = folder ? `${folder}/` : "";
  const keep = new Set(fileNames);
  const map = readAll();
  let changed = false;
  for (const key of Object.keys(map)) {
    if (!key.startsWith(prefix)) continue;
    const name = key.slice(prefix.length);
    if (name.includes("/") || keep.has(name)) continue; // chỉ xét file trực tiếp trong thư mục
    delete map[key];
    changed = true;
  }
  if (changed) writeAll(map);
};
