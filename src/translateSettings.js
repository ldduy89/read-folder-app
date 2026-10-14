// translateSettings.js — trang "Cài đặt dịch" riêng, mở ở /translate-settings (tách khỏi trang Từ đã lưu)
import React, { useEffect, useMemo, useState } from "react";
import { apiBaseOf, apiGet, apiPost, getTarget, setTarget } from "./translateLib";
import { CSS } from "./translateWords";

// Khối hướng dẫn gấp/mở được, đặt ngay dưới tiêu đề mỗi mục
const Guide = ({ title, children }) => (
  <details open className="guide" style={{ margin: "2px 0 10px", color: "var(--muted)", lineHeight: 1.6, fontSize: 13 }}>
    <summary style={{ cursor: "pointer", color: "var(--accent)", userSelect: "none" }}>{title}</summary>
    <ol style={{ margin: "6px 0 0", paddingLeft: 22 }}>{children}</ol>
  </details>
);

// ---------- Cài đặt: ngôn ngữ đích, Gemini, đồng bộ Google Sheet ----------
const Settings = ({ apiBase }) => {
  const [cfg, setCfg] = useState(null);
  const [target, setTargetState] = useState(getTarget());
  const [gKey, setGKey] = useState("");
  const [gModel, setGModel] = useState("");
  const [sUrl, setSUrl] = useState("");
  const [sSecret, setSSecret] = useState("");
  const [msg, setMsg] = useState({ g: null, s: null, t: null });
  const say = (k, text, ok) => setMsg((m) => ({ ...m, [k]: text ? { text, ok } : null }));

  const load = () =>
    apiGet(apiBase, "/translate-config")
      .then((c) => {
        setCfg(c);
        setGModel(c.geminiModel || "");
        setSUrl(c.syncUrl || "");
      })
      .catch(() => setCfg(false));
  useEffect(() => {
    load();
  }, []);

  if (cfg === false) return <div className="settings err">Không kết nối được máy chủ (cổng 8081).</div>;
  if (!cfg) return <div className="settings">Đang tải…</div>;

  const post = (path, body) => apiPost(apiBase, path, body).catch(() => ({ ok: false, error: "Không kết nối được máy chủ." }));

  const saveTarget = () => {
    const t = target.trim() || "vi";
    setTarget(t);
    setTargetState(t);
    say("t", "Đã lưu ✓", true);
  };
  const saveGemini = async () => {
    const body = { geminiModel: gModel };
    if (gKey.trim()) body.geminiKey = gKey; // để trống = giữ key cũ
    const r = await post("/translate-config", body);
    if (r.ok) {
      setGKey("");
      await load();
    }
    say("g", r.ok ? "Đã lưu ✓" : r.error, r.ok);
  };
  const clearGemini = async () => {
    const r = await post("/translate-config", { geminiKey: "" });
    if (r.ok) await load();
    say("g", r.ok ? "Đã xóa key ✓" : r.error, r.ok);
  };
  const testGemini = async () => {
    say("g", "Đang thử…", true);
    const r = await post("/gemini-test", { key: gKey, model: gModel });
    say("g", r.ok ? `Dùng được ✓ (they're all over him → ${r.sample})` : r.error, r.ok);
  };
  const saveSync = async () => {
    const body = { syncUrl: sUrl };
    if (sSecret.trim()) body.syncSecret = sSecret; // để trống = giữ mã cũ
    const r = await post("/translate-config", body);
    if (r.ok) {
      setSSecret("");
      await load();
    }
    say("s", r.ok ? "Đã lưu ✓" : r.error, r.ok);
  };
  const testSync = async () => {
    say("s", "Đang thử…", true);
    const r = await post("/sync-test", { url: sUrl, secret: sSecret });
    say("s", r.ok ? `Kết nối được ✓ (${r.count} từ trên Sheet)` : r.error, r.ok);
  };

  const Msg = ({ k }) => (msg[k] ? <span className={msg[k].ok ? "ok" : "err"}>{msg[k].text}</span> : null);

  return (
    <div className="settings">
      <h2>Ngôn ngữ đích</h2>
      <div className="row">
        <input type="text" style={{ width: 90 }} value={target} onChange={(e) => setTargetState(e.target.value)} placeholder="vi" />
        <button className="btn" onClick={saveTarget}>
          Lưu
        </button>
        <Msg k="t" />
        <span className="syncstate">Mã ngôn ngữ, ví dụ vi, en, ja. Áp dụng cho trình duyệt này.</span>
      </div>

      <h2>Gemini (dịch cụm từ / câu)</h2>
      <Guide title="Hướng dẫn: lấy và cấu hình Gemini">
        <li>Không bắt buộc. Nếu bỏ trống key, cụm từ và câu sẽ được dịch bằng Google Translate.</li>
        <li>Vào Google AI Studio (aistudio.google.com/apikey), đăng nhập bằng tài khoản Google và bấm "Create API key".</li>
        <li>Dán key vào ô API key, bấm Lưu, sau đó bấm Thử để kiểm tra key dùng được. Nếu thành công sẽ hiện một câu dịch mẫu.</li>
        <li>Model mặc định là gemini-flash-lite-latest. Chỉ đổi khi bạn biết rõ model khác.</li>
        <li>Key được lưu trên máy chạy server, không gửi về trình duyệt.</li>
      </Guide>
      <label>
        API key {cfg.hasGeminiKey ? "(đã có key, để trống nếu giữ nguyên)" : "(chưa có, bỏ trống thì dùng Google Translate)"}
        <input type="password" value={gKey} onChange={(e) => setGKey(e.target.value)} autoComplete="off" placeholder={cfg.hasGeminiKey ? "••••••••" : ""} />
      </label>
      <label>
        Model
        <input type="text" value={gModel} onChange={(e) => setGModel(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn" onClick={saveGemini}>
          Lưu
        </button>
        <button className="btn" onClick={testGemini}>
          Thử
        </button>
        {cfg.hasGeminiKey && (
          <button className="btn" onClick={clearGemini}>
            Xóa key
          </button>
        )}
        <Msg k="g" />
      </div>

      <h2>Đồng bộ Google Sheet</h2>
      <Guide title="Hướng dẫn: kết nối Google Sheet">
        <li>Tạo một Google Sheet mới, hoặc dùng sheet đã có từ tiện ích Copy-Copy Translate.</li>
        <li>Trong sheet, vào Tiện ích mở rộng (Extensions) &gt; Apps Script, dán đoạn script đồng bộ và đặt mã bí mật trong script. Tên menu có thể khác tùy ngôn ngữ giao diện.</li>
        <li>Bấm Triển khai (Deploy) &gt; Tạo bản triển khai mới, chọn loại "Ứng dụng web". Mục "Thực thi với tư cách" chọn Tôi, mục "Ai có quyền truy cập" chọn Bất kỳ ai. Sau đó bấm Triển khai và cấp quyền khi được hỏi.</li>
        <li>Copy URL của ứng dụng web (phải kết thúc bằng /exec) và dán vào ô URL Apps Script.</li>
        <li>Nhập đúng mã bí mật đã đặt trong script vào ô mã bí mật, rồi bấm Lưu.</li>
        <li>Bấm Thử kết nối. Nếu hiện "Kết nối được" là xong. Từ đó mọi từ lưu hoặc xoá sẽ được đồng bộ lên sheet.</li>
        <li>Nếu báo "Sai mã bí mật", kiểm tra lại mã trong script. Nếu báo không trả về JSON, kiểm tra lại quyền truy cập đã chọn Bất kỳ ai và URL có /exec chưa.</li>
      </Guide>
      <label>
        URL Apps Script (kết thúc bằng /exec)
        <input type="text" value={sUrl} onChange={(e) => setSUrl(e.target.value)} />
      </label>
      <label>
        Mã bí mật {cfg.hasSyncSecret ? "(đã có, để trống nếu giữ nguyên)" : ""}
        <input type="password" value={sSecret} onChange={(e) => setSSecret(e.target.value)} autoComplete="off" placeholder={cfg.hasSyncSecret ? "••••••••" : ""} />
      </label>
      <div className="row">
        <button className="btn" onClick={saveSync}>
          Lưu
        </button>
        <button className="btn" onClick={testSync}>
          Thử kết nối
        </button>
        <Msg k="s" />
      </div>
      <span className="syncstate">Key và mã bí mật được lưu trong file translate-config.json trên máy chạy server, không gửi về trình duyệt.</span>
    </div>
  );
};

const TranslateSettings = () => {
  const apiBase = useMemo(apiBaseOf, []);
  useEffect(() => {
    document.title = "Cài đặt dịch";
  }, []);
  return (
    <div className="tw">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="top" style={{ alignItems: "center" }}>
          <a className="btn" href="/translate-words">← Từ đã lưu</a>
          <h1 style={{ fontSize: 18, margin: 0 }}>Cài đặt dịch</h1>
        </div>
        <Settings apiBase={apiBase} />
      </div>
    </div>
  );
};

export default TranslateSettings;
