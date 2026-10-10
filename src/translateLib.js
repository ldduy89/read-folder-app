// translateLib.js — phần dùng chung cho cửa sổ dịch (translatePopup.js) và trang từ đã lưu (words.js)
export const TARGET_KEY = "cctTarget"; // ngôn ngữ đích, mặc định "vi"
export const WORDS_KEY = "cctWords"; // danh sách từ đã lưu

export const apiBaseOf = () => `http://${window.location.hostname}:8081`;

export const getTarget = () => {
  try {
    return localStorage.getItem(TARGET_KEY) || "vi";
  } catch (e) {
    return "vi";
  }
};
export const setTarget = (t) => {
  try {
    localStorage.setItem(TARGET_KEY, t);
  } catch (e) {}
};

export const getWords = () => {
  try {
    return JSON.parse(localStorage.getItem(WORDS_KEY) || "[]") || [];
  } catch (e) {
    return [];
  }
};
export const WORDS_EVENT = "cct-words"; // phát ra khi danh sách từ đổi trong trang này (tab khác thì dùng sự kiện "storage")
export const setWords = (list) => {
  try {
    localStorage.setItem(WORDS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(WORDS_EVENT));
    return true;
  } catch (e) {
    return false;
  }
};
export const wordId = (s) => s.trim().toLowerCase();

// ---- Server (api/translate.js) ----
export const apiGet = (apiBase, path) => fetch(apiBase + path).then((r) => r.json());
export const apiPost = (apiBase, path, body) =>
  fetch(apiBase + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then((r) => r.json());

// Báo server đồng bộ lên Google Sheet (không làm gì nếu chưa cấu hình; lỗi mạng thì server giữ lại gửi sau)
export const syncOps = (apiBase, ops) => apiPost(apiBase, "/words-sync", { ops }).catch(() => {});

// Gộp hai chiều: Sheet thắng nếu trùng từ; từ chỉ có ở máy này thì đẩy lên Sheet
export const syncNow = async (apiBase) => {
  try {
    const r = await apiGet(apiBase, "/words-pull");
    if (!r.ok) return { ok: false, error: r.error || "Không đồng bộ được." };
    const remote = r.words || [];
    const remoteIds = new Set(remote.map((w) => w.id));
    const local = getWords();
    const localIds = new Set(local.map((w) => w.id));
    const localOnly = local.filter((w) => !remoteIds.has(w.id));
    const pulled = remote.filter((w) => !localIds.has(w.id)).length;
    setWords([...remote, ...localOnly]);
    if (localOnly.length) await syncOps(apiBase, localOnly.map((w) => ({ action: "add", word: w })));
    return { ok: true, pulled, pushed: localOnly.length, total: remote.length + localOnly.length };
  } catch (e) {
    return { ok: false, error: "Không kết nối được máy chủ (cổng 8081)." };
  }
};

// ---- Giọng đọc ----
// Google TTS chỉ nhận đoạn ngắn (~200 ký tự): cắt theo câu / khoảng trắng
export const chunkText = (text, max = 180) => {
  const pieces = text.match(/[^.!?。！？\n]+[.!?。！？]?/g) || [text];
  const chunks = [];
  let cur = "";
  const push = (s) => {
    if (s.trim()) chunks.push(s.trim());
  };
  for (let p of pieces) {
    while (p.length > max) {
      let cut = p.lastIndexOf(" ", max);
      if (cut < max / 2) cut = max;
      if ((cur + p.slice(0, cut)).length > max) {
        push(cur);
        cur = "";
      }
      push(cur + p.slice(0, cut));
      cur = "";
      p = p.slice(cut);
    }
    if ((cur + p).length > max) {
      push(cur);
      cur = p;
    } else cur += p;
  }
  push(cur);
  return chunks;
};

// Ưu tiên giọng Google Translate (qua server), lỗi thì dùng giọng của máy. Dùng: const sp = createSpeaker(apiBase); sp.speak(text, lang); sp.stop();
export const createSpeaker = (apiBase) => {
  let id = 0;
  let audio = null;
  const stop = () => {
    id++;
    if (audio) {
      audio.pause();
      audio = null;
    }
    try {
      window.speechSynthesis && window.speechSynthesis.cancel();
    } catch (e) {}
  };
  const speakWeb = (t, lang) => {
    const synth = window.speechSynthesis;
    if (!synth || !t) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(t.slice(0, 1000));
    u.lang = lang;
    const base = String(lang).toLowerCase().split("-")[0];
    const v = synth.getVoices().find((x) => x.lang.toLowerCase().startsWith(base));
    if (v) u.voice = v;
    u.rate = 0.95;
    synth.speak(u);
  };
  const speak = (t, lang) => {
    if (!t) return;
    stop();
    const mine = id;
    const chunks = chunkText(t.slice(0, 1500));
    const fail = () => {
      if (mine === id) speakWeb(t, lang || "en");
    };
    const playAt = (i) => {
      if (mine !== id || i >= chunks.length) return;
      const a = new Audio(`${apiBase}/tts?lang=${encodeURIComponent(lang || "en")}&text=${encodeURIComponent(chunks[i])}`);
      audio = a;
      a.onended = () => playAt(i + 1);
      a.onerror = fail;
      a.play().catch(fail);
    };
    playAt(0);
  };
  return { speak, stop };
};

// navigator.clipboard chỉ có trên https / localhost, mở bằng http://IP thì phải dùng cách cũ. host: phần tử để gắn textarea tạm (vẫn chạy khi toàn màn hình)
export const copyText = (str, host, done) => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(str).then(done).catch(() => {});
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = str;
  ta.style.cssText = "position:fixed;left:-9999px;top:0;";
  (host || document.body).appendChild(ta);
  ta.select();
  try {
    if (document.execCommand("copy") && done) done();
  } catch (e) {}
  ta.remove();
};
