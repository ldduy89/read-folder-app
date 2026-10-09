/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import fileIcon from "./file.png";
import folderIcon from "./folder.png";
import "./App.css";
import ReactPlayer from "react-player";
import _ from "lodash";
import Duration from "./Duration";
import { plainCueText } from "./assText";
import { buildAssLayer } from "./assLayer";
import { isTV, isTouch } from "./device";
import { Link, useHistory } from "react-router-dom";

const Home = (props) => {
  const playerRef = useRef(null);
  const currentRef = useRef(null);
  let history = useHistory();
  let hostname = window.location.hostname;
  let rootPath = decodeURIComponent(window.location.pathname);
  const fullPathRoot = _.filter(rootPath.split("/"), (root) => !!root);
  let root = _.first(fullPathRoot) || "";
  let fileNameUrl = _.last(fullPathRoot) || "";
  let pathName = _.drop(_.clone(fullPathRoot)).join("/");
  let backRootPath = _.dropRight(_.clone(fullPathRoot)).join("/");
  let pathViewFile = fullPathRoot.join("/");
  const fName = props?.location?.state?.folder;

  const queryParams = new URLSearchParams(window.location.search);
  const type = queryParams.get("type");
  const publicURL = `http://${hostname}:8081/public/`;
  const subtitlesURL = `http://${hostname}:8081/subtitles/`;
  const subtitlesStyleURL = `http://${hostname}:8081/subtitles-style/`;
  const trasksURL = `http://${hostname}:8081/trasks/`;
  const pickURL = `http://${hostname}:8081/pick/`;
  const audiosURL = `http://${hostname}:8081/audios/`;
  const audioPrepareURL = `http://${hostname}:8081/audio-prepare/`;
  const audioFileURL = `http://${hostname}:8081/audio-file/`;
  const sample_video = document.getElementById("sample_video");
  const video = document.getElementsByTagName("video")[0];
  const textTracks = _.get(video, "textTracks", null);
  const stateInit = {
    pip: false,
    playing: true,
    controls: false,
    light: false,
    volume: 1,
    muted: false,
    played: 0,
    loaded: 0,
    duration: 0,
    playbackRate: (() => {
      try {
        const r = parseFloat(localStorage.getItem("playbackRate"));
        return r >= 0.25 && r <= 3 ? r : 1.0;
      } catch (e) {
        return 1.0;
      }
    })(),
    loop: false
  };

  const [folders, setFolders] = useState([]);
  const [filesOfParent, setFilesOfParent] = useState([]);
  const [subtitles, setSubtitles] = useState(null);
  const [fileName, setFileName] = useState("");
  const [nextFile, setNextFile] = useState("");
  const [previousFile, setPreviousFile] = useState("");
  const [hide, setHide] = useState(false);
  const [boxTracks, setBoxTracks] = useState(false);
  const [state, setState] = useState(stateInit);
  const [isFullSreen, setIsFullSreen] = useState(false);
  const [indexFile, setIndexFile] = useState(null);
  const [indexSub, setIndexSub] = useState(0);
  const [subDelay, setSubDelay] = useState(0); // độ trễ phụ đề (giây). Dương = phụ đề hiện trễ hơn
  // TV: điều khiển kiểu remote (di chuyển chuột để chọn). PC/khác: dùng chuột bình thường.
  const isMouse = !isTV();
  const touch = isMouse && isTouch(); // điện thoại / máy tính bảng: nút to hơn, chạm hai bên video để tua
  // Kích thước cửa sổ: màn hình dọc hoặc hẹp thì xếp video ở trên, khung phụ đề ở dưới
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  const stacked = isMouse && (view.h > view.w || view.w < 640);
  // Độ rộng thật của khung chứa video + phụ đề (đo lại khi xoay màn hình / đổi kích thước)
  const stackRef = useRef(null);
  const [stackW, setStackW] = useState(0);
  useEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w && w !== stackW) setStackW(w);
  }, [view.w, view.h, stacked, type, pathViewFile]);
  const bodyW = stackW || Math.min(view.w * 0.96, 1800);
  const [audioList, setAudioList] = useState([]);
  const [boxAudio, setBoxAudio] = useState(false);
  const [boxSpeed, setBoxSpeed] = useState(false); // menu tốc độ phát
  const [boxDelay, setBoxDelay] = useState(false); // menu chỉnh độ trễ phụ đề
  const [indexDelay, setIndexDelay] = useState(0);
  const [indexAudio, setIndexAudio] = useState(0);
  const [toast, setToast] = useState("");
  const toastRef = useRef(null);
  const [extAudio, setExtAudio] = useState(false); // đang phát audio ngoài (đã tách) đồng bộ với video
  const audioRef = useRef(null); // thẻ <audio> phát audio được chọn
  const audioTokenRef = useRef(0); // huỷ polling cũ khi chọn audio khác / đổi file
  const audioTargetRef = useRef(null); // audio đang được chọn (kể cả khi đang tách)

  if (!_.isEmpty(textTracks) && !_.isEmpty(subtitles)) {
    const subtitle = subtitles.find((s) => s.default);
    for (const element of textTracks) {
      element.mode = "hidden"; // phụ đề tự vẽ bằng overlay (nền đen đặc)
    }
  }

  const onBackButtonEvent = (e) => {
    window.history.pushState(null, null, window.location.pathname);
    history.replace(`/${backRootPath}`, { folder: _.last(fullPathRoot) });
  };

  useEffect(() => {
    if (type === "file") onFullSreenEvent();
  }, []);

  useLayoutEffect(() => {
    setSubtitles(null);
    setSubDelay(0);
    setStateElm({ played: 0, playing: true });
    setBoxTracks(false);
    setBoxAudio(false);
    setBoxDelay(false);
    setBoxSpeed(false);
    stopExternalAudio();
    setAudioList([]);
    if (type !== "file") {
      fetch(publicURL + fullPathRoot.join("/"))
        .then((response) => response.json())
        .then((data) => setFolders(data));
    } else {
      getSubtitles();
      getAudioList();
      fetch(publicURL + backRootPath)
        .then((response) => response.json())
        .then((data) => setFilesOfParent(data.filter((d) => d.type === "file")));
    }
    window.addEventListener("fullscreenchange", onFullSreenEvent);
    if (type !== "file") {
      window.history.pushState(null, null, window.location.pathname);
      window.addEventListener("popstate", onBackButtonEvent);
    }
    return () => {
      window.removeEventListener("popstate", onBackButtonEvent);
      window.removeEventListener("fullscreenchange", onFullSreenEvent);
    };
  }, [rootPath]);

  useEffect(() => {
    const index = _.findIndex(filesOfParent, (f) => f.name === fileNameUrl);
    setFileName((filesOfParent[index] || {}).name);
    setNextFile((filesOfParent[index + 1] || {}).name);
    setPreviousFile((filesOfParent[index - 1] || {}).name);
  }, [filesOfParent]);

  useEffect(() => {
    if (!_.isEmpty(folders)) {
      setIndexFile(fName ? _.findIndex(folders, (f) => f.name === fName) : 0);
    }
  }, [folders]);

  useEffect(() => {
    const files = document.getElementsByClassName("f-active");
    if (files && !_.isEmpty(files)) {
      for (const element of files) {
        element.classList.remove("f-active");
      }
    }
    const nextFile = document.getElementById(`file_${indexFile}`);
    if (nextFile) {
      nextFile.classList.add("f-active");
      nextFile.scrollIntoView();
    }
    const playFile = document.getElementById(`play_${indexFile}`);
    if (playFile) {
      playFile.classList.add("f-active");
    }
  }, [indexFile, state]);

  useEffect(() => {
    const files = document.getElementsByClassName("s-active");
    if (files && !_.isEmpty(files)) {
      for (const element of files) {
        element.classList.remove("s-active");
      }
    }
    // indexSub: 0..n = cột Sub 1 (Off + n sub), từ n+1 trở đi = cột Sub 2 (Off + các sub còn lại)
    const subCount = subtitles ? subtitles.length : 0;
    const subFile = document.getElementById(indexSub <= subCount ? `sub_${indexSub}` : `sub2_${indexSub - subCount - 1}`);
    if (subFile) {
      subFile.classList.add("s-active");
    }
  }, [indexSub, subtitles]);

  useEffect(() => {
    const items = document.getElementsByClassName("a-active");
    if (items && !_.isEmpty(items)) {
      for (const element of Array.from(items)) {
        element.classList.remove("a-active");
      }
    }
    const audioItem = document.getElementById(`aud_${indexAudio}`);
    if (audioItem) {
      audioItem.classList.add("a-active");
    }
  }, [indexAudio, boxAudio, audioList]);

  // ---------- Chọn audio (server tách audio track -> phát bằng <audio> đồng bộ với video) ----------
  const encodedPathViewFile = () => pathViewFile.split("/").map(encodeURIComponent).join("/");

  const showToast = (text, ms = 2000) => {
    setToast(text);
    clearTimeout(toastRef.current);
    if (ms > 0) toastRef.current = setTimeout(() => setToast(""), ms);
  };

  const getAudioList = () => {
    audioTargetRef.current = null;
    fetch(audiosURL + encodedPathViewFile())
      .then((response) => response.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const defaultIndex = Math.max(_.findIndex(data, (a) => a.default), 0);
        setAudioList(data.map((a, i) => ({ label: a.label, isDefault: i === defaultIndex, enabled: i === defaultIndex })));
      })
      .catch(() => setAudioList([]));
  };

  const markAudioEnabled = (index) => {
    setAudioList((list) => list.map((a, i) => ({ ...a, enabled: i === index })));
    setIndexAudio(index);
  };

  const stopExternalAudio = () => {
    audioTokenRef.current = 0;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setExtAudio(false);
  };

  const startExternalAudio = (index) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.src = audioFileURL + encodedPathViewFile() + `?track=${index}`;
    audio.preload = "auto";
    audio.currentTime = playerRef.current ? playerRef.current.getCurrentTime() || 0 : 0;
    setExtAudio(true);
  };

  const changeAudio = (index) => {
    const item = audioList[index];
    if (!item) return;
    audioTargetRef.current = index;
    const token = Date.now();
    audioTokenRef.current = token;

    if (item.isDefault) {
      // Audio gốc: trình duyệt tự phát cùng video
      stopExternalAudio();
      audioTargetRef.current = index;
      markAudioEnabled(index);
      showToast(`Audio: ${item.label}`);
      return;
    }

    showToast(`Đang chuẩn bị audio: ${item.label}...`, 0);
    const poll = () => {
      fetch(audioPrepareURL + encodedPathViewFile() + `?track=${index}`)
        .then((response) => response.json())
        .then((data) => {
          if (audioTokenRef.current !== token) return; // đã chọn audio khác
          if (data.ready) {
            startExternalAudio(index);
            markAudioEnabled(index);
            showToast(`Audio: ${item.label}`);
          } else if (data.waiting) {
            setTimeout(poll, 1500);
          } else {
            audioTargetRef.current = null;
            showToast("Không tách được audio này", 3000);
          }
        })
        .catch(() => {
          if (audioTokenRef.current !== token) return;
          audioTargetRef.current = null;
          showToast("Không kết nối được server audio", 3000);
        });
    };
    poll();
  };

  const cycleAudio = () => {
    if (audioList.length < 2) {
      showToast("File này chỉ có 1 audio");
      return;
    }
    let current = audioTargetRef.current;
    if (current === null || current === undefined) current = Math.max(_.findIndex(audioList, (a) => a.enabled), 0);
    changeAudio((current + 1) % audioList.length);
  };

  const boxAudioHandle = () => {
    if (_.isEmpty(audioList)) return;
    if (!boxAudio) {
      setIndexAudio(Math.max(_.findIndex(audioList, (a) => a.enabled), 0));
      setBoxTracks(false);
      setBoxDelay(false);
      setBoxSpeed(false);
    }
    setBoxAudio(!boxAudio);
  };

  // Đồng bộ <audio> với trạng thái của video
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !extAudio) return;
    audio.volume = state.volume;
    audio.muted = state.muted;
    audio.playbackRate = state.playbackRate;
    if (state.playing) audio.play().catch(() => {});
    else audio.pause();
  }, [extAudio, state.playing, state.volume, state.muted, state.playbackRate]);

  // Sửa lệch giữa audio và video (> 0.3s)
  useEffect(() => {
    if (!extAudio) return;
    const id = setInterval(() => {
      const audio = audioRef.current;
      const player = playerRef.current;
      if (!audio || !player) return;
      const t = player.getCurrentTime() || 0;
      if (Math.abs(audio.currentTime - t) > 0.3) audio.currentTime = t;
    }, 500);
    return () => clearInterval(id);
  }, [extAudio]);

  // Rời trang: dừng audio
  useEffect(() => {
    return () => {
      audioTokenRef.current = 0;
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const changeSubtitle = (language, noSetSub) => {
    if (textTracks && textTracks.length > 0) {
      for (const element of textTracks) {
        element.mode = "hidden";
      }
    }
    const newSybtitle = _.clone(subtitles);
    newSybtitle.forEach((sub) => {
      sub.default = sub.language === language;
    });
    if (!noSetSub) setSubtitles(newSybtitle);
  };

  useEffect(() => {
    const items = document.getElementsByClassName("d-active");
    if (items && !_.isEmpty(items)) {
      for (const element of Array.from(items)) {
        element.classList.remove("d-active");
      }
    }
    const delayItem = document.getElementById(`del_${indexDelay}`);
    if (delayItem) {
      delayItem.classList.add("d-active");
    }
  }, [indexDelay, boxDelay]);

  // ---------- Chỉnh độ trễ phụ đề ----------
  const SUB_DELAY_STEP = 0.1; // giây
  const SUB_DELAY_STEP_LONG = 1; // giây, giữ Shift

  const formatDelay = (d) => `${d > 0 ? "+" : ""}${d.toFixed(1)}s`;

  // Dịch thời gian của tất cả cue (tính từ thời điểm gốc nên không bị cộng dồn sai số)
  const applySubDelay = (delay) => {
    const videoEl = document.getElementsByTagName("video")[0];
    if (!videoEl || !videoEl.textTracks) return;
    for (const track of Array.from(videoEl.textTracks)) {
      if (!track.cues) continue;
      for (const cue of Array.from(track.cues)) {
        const applied = cue._subDelay || 0;
        if (applied === delay) continue;
        if (cue._origStart === undefined) {
          cue._origStart = cue.startTime;
          cue._origEnd = cue.endTime;
        }
        cue.startTime = cue._origStart + delay;
        cue.endTime = cue._origEnd + delay;
        cue._subDelay = delay;
      }
    }
  };

  // ---------- Danh sách phụ đề bên cạnh video (PC) ----------
  const [cueList, setCueList] = useState([]); // [{ start, end, text }]
  const [cueIndex, setCueIndex] = useState(-1); // cue đang được phát (-1: không có)
  const [loopIndex, setLoopIndex] = useState(-1); // cue đang bật lặp lại (-1: tắt)
  const loopWaitRef = useRef(false); // khoá ngắn sau mỗi lần tua lặp
  const loopTimerRef = useRef(null);
  const loopSinceRef = useRef(0);
  const setStateElmRef = useRef(null);
  const lastCueRef = useRef(-2);
  const userScrollRef = useRef(0);
  const activeSubLang = _.get(_.find(subtitles || [], (sub) => sub.default), "language", null);

  const cleanCueText = (text) => plainCueText(text);

  // ---------- Phụ đề tự vẽ theo thiết lập trong sub (ASS: vị trí, cỡ chữ, màu...), nền đen đặc ----------
  const [liveCues, setLiveCues] = useState([]); // cue đang hiển thị: [{ key, id, text }]
  const [assMeta, setAssMeta] = useState(null); // { playResX, playResY, styles } của sub đang chọn
  useEffect(() => {
    setAssMeta(null);
    if (type !== "file" || !activeSubLang || !pathViewFile) return;
    let cancelled = false;
    fetch(subtitlesStyleURL + pathViewFile + `?language=${activeSubLang}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setAssMeta(d || {}))
      .catch(() => !cancelled && setAssMeta({}));
    return () => {
      cancelled = true;
    };
  }, [activeSubLang, pathViewFile]);

  useEffect(() => {
    setLiveCues([]);
    if (type !== "file" || !activeSubLang) return;
    let timer;
    let tries = 0;
    let track = null;
    const onCueChange = () => {
      const cues = track && track.activeCues ? Array.from(track.activeCues) : [];
      const next = cues.map((c) => ({ key: `${c.startTime}-${c.endTime}`, id: c.id, text: c.text || "" }));
      setLiveCues((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    const attach = () => {
      const videoEl = document.getElementsByTagName("video")[0];
      track = videoEl && videoEl.textTracks ? Array.from(videoEl.textTracks).find((t) => t.language === activeSubLang) : null;
      if (track) {
        track.mode = "hidden";
        track.addEventListener("cuechange", onCueChange);
        onCueChange();
      } else if (tries++ < 120) {
        timer = setTimeout(attach, 500);
      }
    };
    attach();
    return () => {
      clearTimeout(timer);
      if (track) track.removeEventListener("cuechange", onCueChange);
    };
  }, [activeSubLang, pathViewFile]);

  // ---------- Sub 2 (hiện nhỏ, không đậm, nằm dưới sub 1) ----------
  const [secondLang, setSecondLang] = useState(() => {
    try {
      return localStorage.getItem("secondSubLang") || null;
    } catch (e) {
      return null;
    }
  });
  const chooseSecondSub = (language) => {
    setSecondLang(language);
    try {
      if (language) localStorage.setItem("secondSubLang", language);
      else localStorage.removeItem("secondSubLang");
    } catch (e) {}
  };
  const secLang =
    secondLang && secondLang !== activeSubLang && (subtitles || []).some((sub) => sub.language === secondLang) ? secondLang : null;
  const [liveCues2, setLiveCues2] = useState([]);
  useEffect(() => {
    setLiveCues2([]);
    if (type !== "file" || !secLang) return;
    let timer;
    let tries = 0;
    let track = null;
    const onCueChange = () => {
      const cues = track && track.activeCues ? Array.from(track.activeCues) : [];
      const next = cues.map((c) => ({ key: `${c.startTime}-${c.endTime}`, text: c.text || "" }));
      setLiveCues2((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    const attach = () => {
      const videoEl = document.getElementsByTagName("video")[0];
      track = videoEl && videoEl.textTracks ? Array.from(videoEl.textTracks).find((t) => t.language === secLang) : null;
      if (track) {
        track.mode = "hidden"; // hidden vẫn tải cue, chỉ không để trình duyệt tự vẽ
        track.addEventListener("cuechange", onCueChange);
        onCueChange();
      } else if (tries++ < 120) {
        timer = setTimeout(attach, 500);
      }
    };
    attach();
    return () => {
      clearTimeout(timer);
      if (track) track.removeEventListener("cuechange", onCueChange);
    };
  }, [secLang, activeSubLang, pathViewFile]);

  const formatClock = (sec) => {
    const total = Math.max(Math.floor(sec), 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const ss = String(total % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  };

  // Đổi ngôn ngữ phụ đề / đổi file -> xoá danh sách cũ
  useEffect(() => {
    setCueList([]);
    setCueIndex(-1);
    lastCueRef.current = -2;
    setLoopIndex(-1);
  }, [activeSubLang, pathViewFile]);

  // Đọc cue từ track phụ đề đang chọn (đọc lại khi đổi độ trễ vì thời gian cue đã bị dịch)
  useEffect(() => {
    if (!isMouse || type !== "file" || !activeSubLang) return;
    let timer;
    let tries = 0;
    const load = () => {
      const videoEl = document.getElementsByTagName("video")[0];
      const track = videoEl && videoEl.textTracks ? Array.from(videoEl.textTracks).find((t) => t.language === activeSubLang) : null;
      if (track && track.cues && track.cues.length) {
        setCueList(
          Array.from(track.cues)
            .map((c) => ({ start: c.startTime, end: c.endTime, text: cleanCueText(c.text) }))
            .filter((c) => c.text)
        );
        lastCueRef.current = -2;
      } else if (tries++ < 120) {
        timer = setTimeout(load, 500); // phụ đề tải bất đồng bộ, thử lại tối đa ~60s
      }
    };
    load();
    return () => clearTimeout(timer);
  }, [activeSubLang, subDelay, pathViewFile]);

  // Theo dõi thời gian video -> highlight cue hiện tại và cuộn tới nó
  useEffect(() => {
    if (!isMouse || _.isEmpty(cueList)) return;
    const id = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const t = player.getCurrentTime() || 0;
      let lo = 0;
      let hi = cueList.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (cueList[mid].start <= t) {
          found = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      const live = found >= 0 && t < cueList[found].end ? found : -1;
      setCueIndex((prev) => (prev === live ? prev : live));
      if (found !== lastCueRef.current) {
        lastCueRef.current = found;
        const panel = document.getElementById("cue_panel");
        const item = document.getElementById(`cue_${found}`);
        // Người dùng vừa tự cuộn thì không giành quyền cuộn trong 3 giây
        if (panel && item && Date.now() - userScrollRef.current > 3000) {
          panel.scrollTo({ top: item.offsetTop - panel.clientHeight / 2 + item.offsetHeight / 2, behavior: "smooth" });
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [cueList]);

  const seekToCue = (cue) => {
    const player = playerRef.current;
    if (!player) return;
    const target = Math.max(cue.start, 0) + 0.01;
    player.seekTo(target, "seconds");
    if (state.duration > 0) setStateElm({ played: target / state.duration });
  };

  // Lặp lại một phụ đề: hết cue thì tua ngay về đầu cue và phát tiếp
  useEffect(() => {
    if (loopIndex < 0) return;
    const id = setInterval(() => {
      if (loopWaitRef.current) return;
      const cue = cueList[loopIndex];
      const player = playerRef.current;
      if (!cue || !player) return;
      if (Date.now() - loopSinceRef.current < 800) return; // chờ lệnh tua ban đầu có hiệu lực
      const t = player.getCurrentTime() || 0;
      if (t < cue.start - 0.5 || t > cue.end + 0.5) {
        setLoopIndex(-1); // người dùng tua ra ngoài câu -> tắt lặp
        return;
      }
      if (t >= cue.end - 0.05) {
        // Hết câu -> tua ngay về đầu câu, không dừng; khoá ngắn để không tua lặp nhiều lần
        loopWaitRef.current = true;
        player.seekTo(cue.start + 0.01, "seconds");
        loopTimerRef.current = setTimeout(() => {
          loopWaitRef.current = false;
        }, 300);
      }
    }, 50);
    return () => {
      clearInterval(id);
      clearTimeout(loopTimerRef.current);
      loopWaitRef.current = false;
    };
  }, [loopIndex, cueList]);

  const toggleLoop = (i) => {
    if (loopIndex === i) {
      setLoopIndex(-1);
      return;
    }
    const cue = cueList[i];
    const player = playerRef.current;
    if (!cue || !player) return;
    const target = Math.max(cue.start, 0) + 0.01;
    loopSinceRef.current = Date.now();
    player.seekTo(target, "seconds");
    setLoopIndex(i);
    setStateElm({ playing: true, ...(state.duration > 0 ? { played: target / state.duration } : {}) });
  };

  const boxDelayHandle = () => {
    if (_.isEmpty(subtitles)) return;
    if (!boxDelay) {
      setIndexDelay(0);
      setBoxTracks(false);
      setBoxAudio(false);
      setBoxSpeed(false);
    }
    setBoxDelay(!boxDelay);
  };

  const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const SPEED_STEP = 0.25;
  const formatSpeed = (r) => `${_.round(r, 2)}x`;
  const boxSpeedHandle = () => {
    if (!boxSpeed) {
      setBoxTracks(false);
      setBoxAudio(false);
      setBoxDelay(false);
    }
    setBoxSpeed(!boxSpeed);
  };
  // delta === null: về 1x; còn lại: tăng/giảm tương đối. Cũng nhận { set: x } để chọn thẳng một mức
  const changeSpeed = (delta) => {
    const next =
      delta === null ? 1 : delta && delta.set ? delta.set : _.clamp(_.round(state.playbackRate + delta, 2), 0.25, 3);
    setStateElm({ playbackRate: next });
    try {
      localStorage.setItem("playbackRate", String(next));
    } catch (e) {}
    showToast(`Tốc độ: ${formatSpeed(next)}`);
    handleAutoHide();
  };

  const changeSubDelay = (delta) => {
    const next = delta === null ? 0 : _.clamp(_.round(subDelay + delta, 1), -60, 60);
    setSubDelay(next);
    applySubDelay(next);
    showToast(`Độ trễ phụ đề: ${formatDelay(next)}`);
    handleAutoHide();
  };

  // Phụ đề tải bất đồng bộ / bị nạp lại -> áp lại độ trễ định kỳ khi đang có chỉnh
  useEffect(() => {
    applySubDelay(subDelay);
    if (subDelay === 0) return;
    const id = setInterval(() => applySubDelay(subDelay), 1000);
    return () => clearInterval(id);
  }, [subDelay]);

  // ---------- Pick thư mục để hiện ở trang Home ----------
  // Pick: POST /pick/<đường dẫn thư mục>. Bỏ pick: DELETE /pick/<tên trên Home>.
  // Cập nhật danh sách tại chỗ (không tải lại) để vị trí đang chọn không bị nhảy về đầu.
  const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

  const togglePick = (folder) => {
    const isRootList = root === "";
    const folderPath = _.filter([root, pathName, folder.name], (elm) => !!elm).join("/");
    const request = folder.picked
      ? fetch(pickURL + encodeURIComponent(folder.pickedName || folder.name), { method: "DELETE" })
      : fetch(pickURL + encodePath(folderPath), { method: "POST" });
    request
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data && data.error);
        if (folder.picked) {
          // Bỏ pick: ở Home thì thư mục biến mất khỏi danh sách
          setFolders((list) =>
            isRootList
              ? list.filter((f) => f.name !== folder.name)
              : list.map((f) => (f.name === folder.name ? { ...f, picked: false, pickedName: undefined } : f))
          );
          showToast(`Đã bỏ pick: ${folder.name}`);
        } else {
          setFolders((list) => list.map((f) => (f.name === folder.name ? { ...f, picked: true, pickedName: data.name } : f)));
          showToast(`Đã pick: ${folder.name} (hiện ở trang Home)`);
        }
      })
      .catch(() => showToast("Không pick được thư mục này", 3000));
  };

  const handleActionFile = (fileName, path) => {
    if (fileName) history.replace(`/${[path, fileName].join("/")}?type=file`);
  };

  // Theo dõi kích thước khung video (đổi cỡ cửa sổ, vào/ra toàn màn hình) để chữ phụ đề co giãn theo
  const [frameH, setFrameH] = useState(0);
  const [frameW, setFrameW] = useState(0);
  useEffect(() => {
    let ro;
    let timer;
    let tries = 0;
    const measure = (el) => {
      setFrameH(Math.round(el.offsetHeight));
      setFrameW(Math.round(el.offsetWidth));
    };
    const attach = () => {
      const el = document.getElementById("sample_video");
      if (el) {
        measure(el);
        if (typeof ResizeObserver !== "undefined") {
          ro = new ResizeObserver(() => measure(el));
          ro.observe(el);
        }
      } else if (tries++ < 20) {
        timer = setTimeout(attach, 300);
      }
    };
    const onWinResize = () => {
      const el = document.getElementById("sample_video");
      if (el) measure(el);
    };
    attach();
    window.addEventListener("resize", onWinResize);
    document.addEventListener("fullscreenchange", onWinResize);
    return () => {
      clearTimeout(timer);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", onWinResize);
      document.removeEventListener("fullscreenchange", onWinResize);
    };
  }, [type, pathViewFile]);

  // Vùng hình video thật sự hiển thị (trừ viền đen khi khác tỉ lệ khung) — toạ độ ASS tính theo vùng này
  const [picRect, setPicRect] = useState(null);
  useEffect(() => {
    const calc = () => {
      const frame = document.getElementById("sample_video");
      const videoEl = document.getElementsByTagName("video")[0];
      if (!frame) return;
      const fw = frame.offsetWidth;
      const fh = frame.offsetHeight;
      if (!fw || !fh) return;
      const vw = videoEl ? videoEl.videoWidth : 0;
      const vh = videoEl ? videoEl.videoHeight : 0;
      let r = { left: 0, top: 0, width: fw, height: fh, vw, vh };
      if (vw && vh) {
        const k = Math.min(fw / vw, fh / vh);
        const w = vw * k;
        const h = vh * k;
        r = { left: (fw - w) / 2, top: (fh - h) / 2, width: w, height: h, vw, vh };
      }
      setPicRect((prev) =>
        prev && Math.abs(prev.left - r.left) < 0.5 && Math.abs(prev.top - r.top) < 0.5 && Math.abs(prev.width - r.width) < 0.5 && Math.abs(prev.height - r.height) < 0.5 && prev.vw === r.vw && prev.vh === r.vh
          ? prev
          : r
      );
    };
    calc();
    const id = setInterval(calc, 500); // video có thể được tạo sau, hoặc đổi độ phân giải giữa chừng
    window.addEventListener("resize", calc);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", calc);
    };
  }, [frameW, frameH, pathViewFile]);

  const videoH = frameH || (sample_video ? sample_video.offsetHeight : 0);
  const videoW = frameW || (sample_video ? sample_video.offsetWidth : 0);
  // Cảm ứng + khung hẹp: ẩn nút tua 2 phút (đã có chạm hai bên video) và nút âm lượng (điện thoại có phím cứng),
  // chuyển chữ thời gian lên thanh tiêu đề để 8 nút còn lại to và dễ bấm
  const containerW = sample_video ? sample_video.offsetWidth : videoW;
  const compactTouch = touch && containerW > 0 && containerW < 700;
  const touchButtons = compactTouch ? 8 : 11; // số nút trên thanh điều khiển
  const touchTimeW = compactTouch ? 0 : 110; // chỗ chừa cho chữ thời gian trên thanh điều khiển
  const barPx = touch && containerW
    ? Math.round(Math.min(Math.max((containerW - 24 - touchTimeW) / (touchButtons + 0.2), 34), 56))
    : videoW
    ? Math.round(Math.min(Math.max(videoW / 28, 32), 110))
    : 50;
  const sizeBar = {
    // Nút điều khiển và chữ thời gian co giãn liên tục theo độ rộng khung video
    "--width-bar": barPx + "px",
    "--font-size": videoW ? Math.round(Math.min(Math.max(videoW / 90, touch ? 13 : 11), 26)) + "px" : "12px",
    // Chiều cao tối đa của popup chọn (sub / tốc độ / audio): không cao quá khung video
    "--menu-max-h": videoH ? Math.max(videoH - barPx - 16, 80) + "px" : "70vh",
    "--font-size-subtitle": videoH ? Math.max(videoH / 18, 14) + "px" : "24px",
    // Tiêu đề video co giãn theo độ rộng khung video
    "--font-size-title": Math.round(Math.min(Math.max((containerW || videoW || 600) / 40, 14), 40)) + "px"
  };

  useEffect(() => {
    // Chỉ tự full screen trên TV. PC: người dùng tự bật bằng phím F / nút / double click.
    if (sample_video && type === "file" && !isMouse) {
      handleFullSreen(true);
    }
  }, [sample_video]);

  const onFullSreenEvent = (e) => {
    if (!document.fullscreenElement) {
      // TV: thoát full screen = quay về danh sách. PC: ở lại trang xem video.
      if (!isMouse) history.replace(`/${backRootPath}`, { folder: _.last(fullPathRoot) });
      setIsFullSreen(false);
    } else {
      setIsFullSreen(true);
    }
  };

  const setStateElm = (value) => {
    const newStage = _.cloneDeep(state);
    _.assign(newStage, value);
    setState(newStage);
  };

  setStateElmRef.current = setStateElm;

  const handleFullSreen = (isFullSreen) => {
    if (isFullSreen) {
      sample_video.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleSeekMouseDown = () => {
    setStateElm({ seeking: true, seekingLine: state.played });
  };

  const handleSeekChange = (e) => {
    setStateElm({ seekingLine: parseFloat(e.target.value) });
  };

  const handleSeekMouseUp = (e) => {
    setStateElm({ seeking: false, played: state.seekingLine });
    playerRef.current?.seekTo(parseFloat(state.seekingLine * state.duration), "seconds");
  };

  const handleChangeSeek = (isNext, seconds) => {
    let newSeconds = parseFloat(state.played * state.duration) + (isNext ? seconds || 15 : -(seconds || 15));
    newSeconds = newSeconds > 0 ? newSeconds : 0;
    setStateElm({ played: newSeconds / state.duration });
    playerRef.current?.seekTo(newSeconds, "seconds");
  };

  const handleAutoHide = (event) => {
    setHide(false);
    clearTimeout(currentRef.current);
    // Chế độ chuột: luôn tự ẩn sau 3s, không phụ thuộc indexFile (indexFile chỉ dùng cho chế độ remote)
    // Chế độ remote: chỉ tự ẩn khi đang ở thanh điều khiển chính (indexFile === 0)
    if (isMouse || indexFile === 0) {
      currentRef.current = setTimeout(() => {
        setHide(true);
        setBoxTracks(false);
        setBoxAudio(false);
        setBoxDelay(false);
        setBoxSpeed(false);
        if (!isMouse) setIndexFile(0);
      }, 3000);
    }
  };

  const getSubtitles = () => {
    fetch(trasksURL + pathViewFile)
      .then((response) => response.json())
      .then((data) => {
        if (_.isArray(data)) {
          setSubtitles(data);
        } else {
          setTimeout(() => {
            getSubtitles();
          }, 3000);
        }
      });
  };

  const actionInListFileHandle = (action) => {
    let newIndex = action ? indexFile + 1 : indexFile - 1;
    if (newIndex < 0) newIndex = folders.length - 1;
    if (newIndex >= folders.length) newIndex = 0;
    setIndexFile(newIndex);
  };

  const upDownVideoHandle = (action) => {
    if (boxDelay) {
      let newIndex = action ? indexDelay + 1 : indexDelay - 1;
      if (newIndex < 0) newIndex = 2;
      if (newIndex > 2) newIndex = 0;
      setIndexDelay(newIndex);
      return;
    }
    if (boxAudio) {
      let newIndex = action ? indexAudio + 1 : indexAudio - 1;
      if (newIndex < 0) newIndex = audioList.length - 1;
      if (newIndex >= audioList.length) newIndex = 0;
      setIndexAudio(newIndex);
      return;
    }
    if (!boxTracks) {
      let newIndex = action ? 3 : 0;
      if (indexFile === 0 && !action) {
        setHide(true);
        if (indexFile === 3 && action) setIndexFile(0);
      } else {
        setIndexFile(newIndex);
      }
    } else {
      // Danh sách điều hướng: Sub 1 (Off + n sub) rồi tới Sub 2 (Off + các sub khác Sub 1), khi có từ 2 sub trở lên
      const subCount = subtitles.length;
      const sub2Count = subCount > 1 ? subtitles.filter((sub) => sub.language !== activeSubLang).length + 1 : 0;
      const maxIndex = subCount + sub2Count;
      let newIndex = action ? indexSub + 1 : indexSub - 1;
      if (newIndex < 0) newIndex = maxIndex;
      if (newIndex > maxIndex) newIndex = 0;
      setIndexSub(newIndex);
    }
  };

  const leftRightVideoHandle = (action) => {
    if (indexFile === 0) {
      handleChangeSeek(action);
    } else {
      let newIndex = action ? indexFile + 1 : indexFile - 1;
      if (newIndex < 1) newIndex = 10;
      if (newIndex > 10) newIndex = 1;
      setIndexFile(newIndex);
    }
  };

  const boxTrackHandle = () => {
    if (!_.isEmpty(subtitles) && !boxTracks) {
      const index = _.findIndex(subtitles, (s) => !!s.default);
      setIndexSub(index + 1);
    }
    if (!_.isEmpty(subtitles)) {
      setBoxAudio(false);
      setBoxDelay(false);
      setBoxSpeed(false);
      setBoxTracks(!boxTracks);
    }
  };

  // ---------- Điều khiển bằng bàn phím ----------
  const SEEK_STEP = 10; // giây, phím ← →
  const SEEK_STEP_LONG = 60; // giây, Shift + ← →

  const seekBy = (delta) => {
    const player = playerRef.current;
    if (!player) return;
    const current = player.getCurrentTime() || 0;
    const max = state.duration > 0 ? Math.max(state.duration - 1, 0) : Infinity;
    const target = Math.min(Math.max(current + delta, 0), max);
    player.seekTo(target, "seconds");
    if (state.duration > 0) setStateElm({ played: target / state.duration });
    handleAutoHide();
  };

  const togglePlay = () => {
    setStateElm({ playing: !state.playing });
    handleAutoHide();
  };

  const changeVolume = (delta) => {
    const volume = Math.min(Math.max(_.round(state.volume + delta, 2), 0), 1);
    setStateElm({ volume, muted: false });
    handleAutoHide();
  };

  // Gắn lại listener sau mỗi lần render để handler luôn thấy state mới nhất
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target && e.target.tagName;
      if (tag === "TEXTAREA" || (tag === "INPUT" && e.target.type !== "range")) return;

      // Tránh việc phím Space/Enter vừa chạy shortcut vừa "bấm" nút đang được focus
      const active = document.activeElement;
      if (active && (active.tagName === "BUTTON" || (active.tagName === "INPUT" && active.type === "range"))) {
        active.blur();
      }

      if (type === "file") {
        switch (e.key) {
          case " ":
          case "Spacebar":
          case "Enter":
          case "k":
          case "K":
          case "MediaPlayPause":
            e.preventDefault();
            if (!e.repeat) togglePlay();
            break;
          case "MediaPlay":
            e.preventDefault();
            setStateElm({ playing: true });
            break;
          case "MediaPause":
            e.preventDefault();
            setStateElm({ playing: false });
            break;
          case "ArrowRight":
            e.preventDefault();
            seekBy(e.shiftKey ? SEEK_STEP_LONG : SEEK_STEP);
            break;
          case "ArrowLeft":
            e.preventDefault();
            seekBy(-(e.shiftKey ? SEEK_STEP_LONG : SEEK_STEP));
            break;
          case "l":
          case "L":
          case "MediaFastForward":
            e.preventDefault();
            seekBy(SEEK_STEP_LONG / 6);
            break;
          case "j":
          case "J":
          case "MediaRewind":
            e.preventDefault();
            seekBy(-SEEK_STEP_LONG / 6);
            break;
          case "ArrowUp":
            e.preventDefault();
            changeVolume(0.1);
            break;
          case "ArrowDown":
            e.preventDefault();
            changeVolume(-0.1);
            break;
          case "m":
          case "M":
            e.preventDefault();
            setStateElm({ muted: !state.muted });
            break;
          case "a":
          case "A":
            e.preventDefault();
            if (!e.repeat) cycleAudio();
            break;
          case "]":
          case ">":
            e.preventDefault();
            changeSpeed(SPEED_STEP);
            break;
          case "[":
          case "<":
            e.preventDefault();
            changeSpeed(-SPEED_STEP);
            break;
          case "\\":
            e.preventDefault();
            changeSpeed(null);
            break;
          case "h":
          case "H":
            e.preventDefault();
            changeSubDelay(e.shiftKey ? SUB_DELAY_STEP_LONG : SUB_DELAY_STEP);
            break;
          case "g":
          case "G":
            e.preventDefault();
            changeSubDelay(-(e.shiftKey ? SUB_DELAY_STEP_LONG : SUB_DELAY_STEP));
            break;
          case "n":
          case "N":
          case "PageDown":
          case "MediaTrackNext":
            e.preventDefault();
            handleActionFile(nextFile, backRootPath);
            break;
          case "p":
          case "P":
          case "PageUp":
          case "MediaTrackPrevious":
            e.preventDefault();
            handleActionFile(previousFile, backRootPath);
            break;
          case "f":
          case "F":
            e.preventDefault();
            handleFullSreen(!isFullSreen);
            break;
          case "Escape":
          case "Backspace":
            // Đang full screen thì Esc do trình duyệt xử lý (thoát full screen); lần sau mới quay về danh sách
            if (!document.fullscreenElement) {
              e.preventDefault();
              history.replace(`/${backRootPath}`, { folder: _.last(fullPathRoot) });
            }
            break;
          default:
            break;
        }
      } else {
        // Màn hình danh sách thư mục / file
        switch (e.key) {
          case "ArrowUp":
          case "ArrowLeft":
            e.preventDefault();
            if (!_.isEmpty(folders)) actionInListFileHandle(false);
            break;
          case "ArrowDown":
          case "ArrowRight":
            e.preventDefault();
            if (!_.isEmpty(folders)) actionInListFileHandle(true);
            break;
          case "Enter": {
            e.preventDefault();
            const link = document.getElementsByClassName("f-active")[0]?.getElementsByTagName("a")[0];
            if (link) link.click();
            break;
          }
          case "Backspace":
            if (root !== "") {
              e.preventDefault();
              history.replace(`/${backRootPath}`, { folder: _.last(fullPathRoot) });
            }
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // ---------- Chạm hai bên video để tua (màn hình cảm ứng) ----------
  const TAP_ZONE = 0.28; // mỗi bên chiếm 28% bề ngang video
  const TAP_SEEK = 10; // giây mỗi lần chạm
  const [tapHint, setTapHint] = useState(null); // { side, total }
  const tapAccumRef = useRef({ side: "", total: 0, time: 0 });
  const tapHintTimerRef = useRef(null);

  const tapZoneOf = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (rect.width || 1);
    return x < TAP_ZONE ? "left" : x > 1 - TAP_ZONE ? "right" : "center";
  };

  const handleOverlayTap = (e) => {
    if (touch) {
      const zone = tapZoneOf(e);
      if (zone !== "center") {
        const now = Date.now();
        const acc = tapAccumRef.current;
        // chạm liên tiếp cùng một bên thì cộng dồn số giây hiển thị
        const total = acc.side === zone && now - acc.time < 900 ? acc.total + TAP_SEEK : TAP_SEEK;
        tapAccumRef.current = { side: zone, total, time: now };
        seekBy(zone === "left" ? -TAP_SEEK : TAP_SEEK);
        setTapHint({ side: zone, total });
        clearTimeout(tapHintTimerRef.current);
        tapHintTimerRef.current = setTimeout(() => setTapHint(null), 800);
        return;
      }
    }
    setStateElm({ playing: !state.playing });
  };

  const handleOverlayDoubleClick = (e) => {
    // Chạm 2 lần ở hai bên = tua 2 lần, không bật/tắt full screen
    if (touch && tapZoneOf(e) !== "center") return;
    handleFullSreen(!isFullSreen);
  };

  // ---------- Remote kiểu con trỏ: đọc hướng di chuyển + lọc "nảy ngược" ----------
  // Khi con trỏ chạm mép màn hình, một số TV đẩy con trỏ ngược lại ngay sau khi nhận nút (vd bấm trái -> sang trái 1 nấc
  // rồi tự sang phải). Bỏ qua sự kiện ngược chiều trên cùng trục nếu nó xảy ra ngay sau một thao tác.
  const REMOTE_MIN_MOVE = 5; // px, nhỏ hơn thì coi là nhiễu
  const REMOTE_BOUNCE_MS = 250; // cửa sổ thời gian để coi sự kiện ngược chiều là "nảy lại"
  const lastRemoteMoveRef = useRef({ axis: "", dir: 0, time: 0 });

  const readRemoteMove = (event) => {
    const { movementX, movementY } = event;
    let axis = "";
    let value = 0;
    if (!movementX && movementY && Math.abs(movementY) > REMOTE_MIN_MOVE) {
      axis = "y";
      value = movementY;
    } else if (movementX && !movementY && Math.abs(movementX) > REMOTE_MIN_MOVE) {
      axis = "x";
      value = movementX;
    } else {
      return null;
    }
    const dir = value > 0 ? 1 : -1;
    const now = Date.now();
    const last = lastRemoteMoveRef.current;
    if (last.axis === axis && last.dir === -dir && now - last.time < REMOTE_BOUNCE_MS) {
      lastRemoteMoveRef.current = { ...last, time: now }; // gia hạn: chuỗi nảy nhiều nhịp vẫn bị bỏ qua
      return null;
    }
    lastRemoteMoveRef.current = { axis, dir, time: now };
    return { axis, forward: dir > 0 };
  };

  return (
    <>
      <div
        className="App"
        onMouseMove={(event) => {
          if (!isMouse && !isFullSreen) {
            const move = readRemoteMove(event);
            if (move) actionInListFileHandle(move.forward);
          }
        }}
        onClick={() => {
          if (!isMouse) {
            document.getElementsByClassName("f-active")[0].getElementsByTagName("a")[0].click();
          }
        }}
      >
        <header className="App-header">
          <div className="App-body" id="body" style={isMouse && type === "file" ? { width: "96vw", maxWidth: "1800px", height: "auto", overflow: "visible" } : undefined}>
            {/* Hàng đầu trang: nút quay lại (icon) + đường dẫn mục. Trang xem file không hiện tên file. */}
            <div className="App-pathbar">
              {root !== "" && (
                <Link id={`back_0`} className="App-back" to={`/${backRootPath}`} title="Quay lại" aria-label="Quay lại">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 12H5" />
                    <path d="M11 6l-6 6 6 6" />
                  </svg>
                </Link>
              )}
              <div className="App-path">
                <b>
                  {root !== "" ? (
                    <Link id={`path_0`} to="/">
                      Home
                    </Link>
                  ) : (
                    "Home"
                  )}
                </b>
                {(type === "file" ? _.dropRight(fullPathRoot) : fullPathRoot).map((path, index, crumbs) => {
                  const currentPathArr = _.dropRight(fullPathRoot, fullPathRoot.length - index - 1);
                  const isCurrent = type !== "file" && index + 1 === crumbs.length; // thư mục đang mở: chỉ hiện chữ
                  return (
                    <b key={index}>
                      {" / "}
                      {root !== "" && !isCurrent && (
                        <Link id={`path_${index + 1}`} to={`/${currentPathArr.join("/")}`}>
                          {path}
                        </Link>
                      )}
                      {root !== "" && isCurrent && path}
                    </b>
                  );
                })}
              </div>
            </div>
            {type !== "file" ? (
              folders.map((folder, index) => {
                const fullPath = _.filter([root, pathName, folder.name], (elm) => !!elm).join("/");
                return (
                  <div className={`App-item ${indexFile === index ? "f-active" : ""}`} id={`file_${index}`} key={index}>
                    <img src={folder.type === "file" ? fileIcon : folderIcon} alt="icon" />
                    <Link to={`/${fullPath}${folder.type === "file" ? "?type=file" : ""}`}>{folder.name}</Link>
                    {/* Home: ổ đĩa không có nút, thư mục đã pick có nút "Bỏ pick". Trong thư mục: thư mục con có nút Pick. TV (remote) không hiện nút. */}
                    {isMouse && folder.type === "folder" && (root !== "" || folder.picked) && (
                      <button
                        type="button"
                        className={`App-pick ${folder.picked ? "picked" : ""}`}
                        title={folder.picked ? "Bỏ pick (xoá khỏi trang Home)" : "Pick để hiện ở trang Home"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          togglePick(folder);
                        }}
                      >
                        {folder.picked ? (root === "" ? "Bỏ pick" : "Đã pick ✓") : "Pick"}
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div
                ref={stackRef}
                style={
                  isMouse
                    ? stacked
                      ? { display: "flex", flexDirection: "column", gap: "12px", width: "100%" }
                      : { display: "flex", gap: "12px", alignItems: "flex-start" }
                    : undefined
                }
              >
                <div
                  className="player-wrapper"
                  style={
                    isMouse
                      ? stacked
                        ? { width: "100%", height: Math.round((bodyW * 9) / 16) + "px" } // video 16:9 chiếm hết bề ngang
                        : { height: "80vh", flex: 1, minWidth: 0 }
                      : undefined
                  }
                >
                  <div
                    onMouseMove={(event) => {
                      handleAutoHide();
                      if (!isMouse && isFullSreen) {
                        const move = readRemoteMove(event);
                        if (move) {
                          if (move.axis === "y") upDownVideoHandle(move.forward);
                          else leftRightVideoHandle(move.forward);
                        }
                      }
                    }}
                    onClick={() => {
                      handleAutoHide();
                      if (!isMouse) {
                        if (indexFile === 0) {
                          setStateElm({ playing: !state.playing });
                        } else if (boxDelay) {
                          document.getElementsByClassName("d-active")[0]?.click();
                          setIndexFile(0);
                        } else if (boxAudio) {
                          document.getElementsByClassName("a-active")[0]?.click();
                          setIndexFile(0);
                        } else if (boxTracks) {
                          document.getElementsByClassName("s-active")[0].click();
                          setIndexFile(0);
                        } else {
                          document.getElementsByClassName("f-active")[0].click();
                        }
                      }
                    }}
                    id="sample_video"
                    className={`v-vlite ${state.playing ? "v-playing" : "v-paused"} ${hide ? "nocursor" : ""}`}
                    style={sizeBar}
                  >
                    {!isMouse && <div className="mang"></div>}
                    {!!subtitles && (
                      <ReactPlayer
                        ref={playerRef}
                        className="react-player vlite-js"
                        // style={{ "--shadow": borderText(5, "#000") }}
                        controls={state.controls}
                        url={publicURL + pathViewFile}
                        pip={state.pip}
                        playing={state.playing}
                        light={state.light}
                        loop={state.loop}
                        playbackRate={state.playbackRate}
                        volume={state.volume}
                        muted={state.muted || extAudio}
                        onSeek={(seconds) => {
                          if (extAudio && audioRef.current) audioRef.current.currentTime = seconds;
                        }}
                        onBuffer={() => extAudio && audioRef.current && audioRef.current.pause()}
                        onBufferEnd={() => extAudio && state.playing && audioRef.current && audioRef.current.play().catch(() => {})}
                        onDuration={(duration) => setStateElm({ duration: duration })}
                        onEnded={() => handleActionFile(nextFile, backRootPath)}
                        onProgress={(stage) => setStateElm({ played: stage.played })}
                        config={{
                          attributes: {
                            crossOrigin: "anonymous"
                          },
                          file: {
                            tracks: subtitles.map((sub, index) => ({
                              kind: "subtitles",
                              src: subtitlesURL + pathViewFile + `?language=${sub.language}`,
                              srcLang: sub.language,
                              default: true,
                              className: 'subtitle-track'
                            }))
                          }
                        }}
                      />
                    )}

                    {buildAssLayer(liveCues, assMeta, picRect, { secondary: secLang ? liveCues2 : [], controlsHidden: hide && state.playing, onGrab: () => state.playing && setStateElm({ playing: false }) })}

                    {!!toast && (
                      <div
                        style={{
                          position: "absolute",
                          top: "8%",
                          right: "4%",
                          zIndex: 20,
                          padding: "8px 16px",
                          borderRadius: 6,
                          background: "rgba(0,0,0,0.75)",
                          color: "#fff",
                          fontSize: "var(--font-size)",
                          pointerEvents: "none"
                        }}
                      >
                        {toast}
                      </div>
                    )}
                    <div className={`v-topBar ${hide ? "hidden" : ""}`}>
                      <span className="v-topTitle">{fileName}</span>
                      {compactTouch && (
                        <span className="v-topTime">
                          <Duration seconds={state.duration * (state.seeking ? state.seekingLine : state.played)}></Duration>
                          &nbsp;/&nbsp;
                          <Duration seconds={state.duration}></Duration>
                        </span>
                      )}
                    </div>
                    <div
                      className="v-overlayVideo"
                      onClick={handleOverlayTap}
                      onDoubleClick={handleOverlayDoubleClick}
                    ></div>
                    {touch && tapHint && (
                      <div
                        style={{
                          position: "absolute",
                          top: "45%",
                          [tapHint.side === "left" ? "left" : "right"]: "10%",
                          transform: "translateY(-50%)",
                          zIndex: 20,
                          padding: "0.5em 1em",
                          borderRadius: "999px",
                          background: "rgba(0,0,0,0.65)",
                          color: "#fff",
                          fontSize: "calc(var(--font-size) * 1.6)",
                          whiteSpace: "nowrap",
                          pointerEvents: "none"
                        }}
                      >
                        {tapHint.side === "left" ? `« ${tapHint.total} giây` : `${tapHint.total} giây »`}
                      </div>
                    )}
                    <button className="v-bigPlay v-controlButton" aria-label="Play" onClick={() => setStateElm({ playing: !state.playing })}>
                      <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0ZM7.5 12.67V7.33c0-.79.88-1.27 1.54-.84l4.15 2.67a1 1 0 0 1 0 1.68l-4.15 2.67c-.66.43-1.54-.05-1.54-.84Z"></path>
                      </svg>
                    </button>
                    <div className={`v-controlBar ${hide ? "hidden" : ""}`}>
                      <div className="v-progressBar" id="play_0">
                        <div className="v-progressSeek" style={{ width: `${(state.seeking ? state.seekingLine : state.played) * 100}%` }}></div>
                        <input
                          onMouseDown={handleSeekMouseDown}
                          onChange={handleSeekChange}
                          onMouseUp={handleSeekMouseUp}
                          onPointerDown={() => handleSeekMouseDown()}
                          onPointerUp={(event) => handleSeekMouseUp(event)}
                          type="range"
                          className="v-progressInput"
                          min={0}
                          max={0.999999}
                          step="any"
                          value="0"
                          orient="horizontal"
                        />
                      </div>
                      <div className="v-controlBarContent">
                        <div className="v-playPauseButton" id="play_1" onClick={() => handleActionFile(previousFile, backRootPath)}>
                          <span className="v-previousIcon v-iconNext">
                            <svg version="1.1" viewBox="0 0 36 36">
                              <path className="ytp-svg-fill" d="m 12,12 h 2 v 12 h -2 z m 3.5,6 8.5,6 V 12 z" id="ytp-id-10"></path>
                            </svg>
                          </span>
                        </div>
                        <div className="v-playPauseButton" id="play_2" style={compactTouch ? { display: "none" } : undefined} onClick={() => handleChangeSeek(false, 120)}>
                          <span className="v-nextIcon v-iconNext">
                            <svg version="1.1" viewBox="0 0 36 36">
                              <path d="M18.293 11.562v5.852l5.852-5.852v12.875l-5.852-5.852v5.852l-6.438-6.438z"></path>
                            </svg>
                          </span>
                        </div>
                        <div className="v-playPauseButton" id="play_3" onClick={() => setStateElm({ playing: !state.playing })}>
                          <span className="v-playerIcon v-iconPlay">
                            <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
                              <path className="ytp-svg-fill" d="M 12,26 18.5,22 18.5,14 12,10 z M 18.5,22 25,18 25,18 18.5,14 z"></path>
                            </svg>
                          </span>

                          <span className="v-playerIcon v-iconPause">
                            <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
                              <path className="ytp-svg-fill" d="M 12,26 16,26 16,10 12,10 z M 21,26 25,26 25,10 21,10 z"></path>
                            </svg>
                          </span>
                        </div>
                        <div className="v-playPauseButton" id="play_4" style={compactTouch ? { display: "none" } : undefined} onClick={() => handleChangeSeek(true, 120)}>
                          <span className="v-nextIcon v-iconNext">
                            <svg version="1.1" viewBox="0 0 36 36">
                              <path d="M17.707 11.562v5.852l-5.852-5.852v12.875l5.852-5.852v5.852l6.438-6.438z"></path>
                            </svg>
                          </span>
                        </div>
                        <div className="v-playPauseButton" id="play_5" onClick={() => handleActionFile(nextFile, backRootPath)}>
                          <span className="v-nextIcon v-iconNext">
                            <svg version="1.1" viewBox="0 0 36 36">
                              <path className="ytp-svg-fill" d="M 12,24 20.5,18 12,12 V 24 z M 22,12 v 12 h 2 V 12 h -2 z" id="ytp-id-12"></path>
                            </svg>
                          </span>
                        </div>
                        <div className="v-time" style={compactTouch ? { display: "none" } : undefined}>
                          <span className="v-currentTime">
                            <Duration seconds={state.duration * (state.seeking ? state.seekingLine : state.played)}></Duration>
                          </span>
                          &nbsp;/&nbsp;
                          <span className="v-duration">
                            <Duration seconds={state.duration}></Duration>
                          </span>
                        </div>
                        <div className={`v-subtitle`} id="play_6" onClick={() => boxTrackHandle()}>
                          <span className="v-subIcon">
                            <svg
                              className="ytp-subtitles-button-icon"
                              height="100%"
                              version="1.1"
                              viewBox="0 0 36 36"
                              width="100%"
                              fill-opacity={`${_.isEmpty(subtitles) ? "0.3" : "1"}`}
                            >
                              <path
                                d="M11,11 C9.9,11 9,11.9 9,13 L9,23 C9,24.1 9.9,25 11,25 L25,25 C26.1,25 27,24.1 27,23 L27,13 C27,11.9 26.1,11 25,11 L11,11 Z M11,17 L14,17 L14,19 L11,19 L11,17 L11,17 Z M20,23 L11,23 L11,21 L20,21 L20,23 L20,23 Z M25,23 L22,23 L22,21 L25,21 L25,23 L25,23 Z M25,19 L16,19 L16,17 L25,17 L25,19 L25,19 Z"
                                fill="#fff"
                                id="ytp-id-16"
                              ></path>
                            </svg>
                          </span>
                          <div className={`v-subtitlesList ${boxTracks ? "v-active" : ""}`}>
                            <div style={{ display: "flex", alignItems: "flex-start" }}>
                            <ul>
                              <li style={{ padding: "0.6em 1em 0.2em 2.2em", color: "#777", fontSize: "0.8em", pointerEvents: "none", whiteSpace: "nowrap" }}>Sub 1</li>
                              <li id={`sub_0`} onClick={() => changeSubtitle(null)}>
                                <button
                                  className={`v-trackButton ${!subtitles || !subtitles.find((s) => !!s.default) ? "v-active" : ""}`}
                                  data-language="off"
                                >
                                  <svg viewBox="0 0 18 14" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5.6 10.6 1.4 6.4 0 7.8l5.6 5.6 12-12L16.2 0z"></path>
                                  </svg>
                                  Off
                                </button>
                              </li>
                              {subtitles &&
                                subtitles.map((sub, index) => {
                                  return (
                                    <li id={`sub_${index + 1}`} onClick={() => changeSubtitle(sub.language)} key={index}>
                                      <button className={`v-trackButton ${sub.default ? "v-active" : ""}`} data-language="off">
                                        <svg viewBox="0 0 18 14" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M5.6 10.6 1.4 6.4 0 7.8l5.6 5.6 12-12L16.2 0z"></path>
                                        </svg>
                                        {sub.lable}
                                      </button>
                                    </li>
                                  );
                                })}
                            </ul>
                            {subtitles && subtitles.length > 1 && (
                              <ul style={{ borderLeft: "1px solid #ddd" }}>
                                <li style={{ padding: "0.6em 1em 0.2em 2.2em", color: "#777", fontSize: "0.8em", pointerEvents: "none", whiteSpace: "nowrap" }}>
                                  Sub 2
                                </li>
                                <li id="sub2_0" onClick={() => chooseSecondSub(null)}>
                                  <button className={`v-trackButton ${!secLang ? "v-active" : ""}`} data-language="off">
                                    <svg viewBox="0 0 18 14" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M5.6 10.6 1.4 6.4 0 7.8l5.6 5.6 12-12L16.2 0z"></path>
                                    </svg>
                                    Off
                                  </button>
                                </li>
                                {subtitles
                                  .filter((sub) => sub.language !== activeSubLang)
                                  .map((sub, index) => (
                                    <li id={`sub2_${index + 1}`} onClick={() => chooseSecondSub(sub.language)} key={`s2_${index}`}>
                                      <button className={`v-trackButton ${secLang === sub.language ? "v-active" : ""}`} data-language="off">
                                        <svg viewBox="0 0 18 14" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M5.6 10.6 1.4 6.4 0 7.8l5.6 5.6 12-12L16.2 0z"></path>
                                        </svg>
                                        {sub.lable}
                                      </button>
                                    </li>
                                  ))}
                              </ul>
                            )}
                            </div>
                          </div>
                        </div>
                        <div className={`v-subtitle`} id="play_speed" onClick={() => boxSpeedHandle()}>
                          <span className="v-subIcon">
                            <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
                              <text
                                x="18"
                                y="23"
                                textAnchor="middle"
                                fill="#fff"
                                fontWeight="700"
                                fontSize={formatSpeed(state.playbackRate).length <= 2 ? 16 : formatSpeed(state.playbackRate).length <= 4 ? 13 : 11}
                                fontFamily="inherit"
                              >
                                {formatSpeed(state.playbackRate)}
                              </text>
                            </svg>
                          </span>
                          <div className={`v-subtitlesList ${boxSpeed ? "v-active" : ""}`}>
                            <ul>
                              {SPEED_OPTIONS.map((r) => (
                                <li
                                  key={`speed_${r}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    changeSpeed({ set: r });
                                  }}
                                >
                                  <button className={`v-trackButton ${state.playbackRate === r ? "v-active" : ""}`}>
                                    <svg viewBox="0 0 18 14" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M5.6 10.6 1.4 6.4 0 7.8l5.6 5.6 12-12L16.2 0z"></path>
                                    </svg>
                                    {r === 1 ? "Bình thường (1x)" : formatSpeed(r)}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className={`v-subtitle`} id="play_7" onClick={() => boxDelayHandle()}>
                          <span className="v-subIcon">
                            <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%" fill-opacity={`${_.isEmpty(subtitles) ? "0.3" : "1"}`}>
                              <path
                                d="M18 9a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm-1 3v5.4l4.2 2.5 1-1.6-3.2-1.9V14z"
                                fill="#fff"
                              ></path>
                            </svg>
                          </span>
                          <div className={`v-subtitlesList ${boxDelay ? "v-active" : ""}`}>
                            <ul>
                              <li
                                id="del_0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  changeSubDelay(SUB_DELAY_STEP);
                                }}
                              >
                                <button className="v-trackButton">Trễ hơn (+0.1s)</button>
                              </li>
                              <li
                                id="del_1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  changeSubDelay(-SUB_DELAY_STEP);
                                }}
                              >
                                <button className="v-trackButton">Sớm hơn (-0.1s)</button>
                              </li>
                              <li
                                id="del_2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  changeSubDelay(null);
                                }}
                              >
                                <button className="v-trackButton">Đặt lại độ trễ ({formatDelay(subDelay)})</button>
                              </li>
                            </ul>
                          </div>
                        </div>
                        <div className={`v-subtitle`} id="play_8" onClick={() => boxAudioHandle()}>
                          <span className="v-subIcon">
                            <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%" fill-opacity={`${_.size(audioList) > 1 ? "1" : "0.3"}`}>
                              <path
                                d="M18,8 C12.5,8 8,12.5 8,18 L8,24 C8,25.1 8.9,26 10,26 L12,26 L12,19 L10,19 C10,14.6 13.6,11 18,11 C22.4,11 26,14.6 26,19 L24,19 L24,26 L26,26 C27.1,26 28,25.1 28,24 L28,18 C28,12.5 23.5,8 18,8 Z"
                                fill="#fff"
                              ></path>
                            </svg>
                          </span>
                          <div className={`v-subtitlesList ${boxAudio ? "v-active" : ""}`}>
                            <ul>
                              {audioList.map((audio, index) => (
                                <li id={`aud_${index}`} onClick={() => changeAudio(index)} key={index}>
                                  <button className={`v-trackButton ${audio.enabled ? "v-active" : ""}`}>
                                    <svg viewBox="0 0 18 14" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M5.6 10.6 1.4 6.4 0 7.8l5.6 5.6 12-12L16.2 0z"></path>
                                    </svg>
                                    {audio.label}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className={`v-volume ${state.muted ? "v-muted" : ""}`} id="play_9" style={compactTouch ? { display: "none" } : undefined} onClick={() => setStateElm({ muted: !state.muted })}>
                          <span className="v-playerIcon v-iconVolumeHigh">
                            <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
                              <path
                                className="ytp-svg-fill ytp-svg-volume-animation-speaker"
                                clip-path="url(#ytp-svg-volume-animation-mask)"
                                d="M8,21 L12,21 L17,26 L17,10 L12,15 L8,15 L8,21 Z M19,14 L19,22 C20.48,21.32 21.5,19.77 21.5,18 C21.5,16.26 20.48,14.74 19,14 ZM19,11.29 C21.89,12.15 24,14.83 24,18 C24,21.17 21.89,23.85 19,24.71 L19,26.77 C23.01,25.86 26,22.28 26,18 C26,13.72 23.01,10.14 19,9.23 L19,11.29 Z"
                                fill="#fff"
                              ></path>
                            </svg>
                          </span>
                          <span className="v-playerIcon v-iconVolumeMute">
                            <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
                              <path
                                className="ytp-svg-fill"
                                d="m 21.48,17.98 c 0,-1.77 -1.02,-3.29 -2.5,-4.03 v 2.21 l 2.45,2.45 c .03,-0.2 .05,-0.41 .05,-0.63 z m 2.5,0 c 0,.94 -0.2,1.82 -0.54,2.64 l 1.51,1.51 c .66,-1.24 1.03,-2.65 1.03,-4.15 0,-4.28 -2.99,-7.86 -7,-8.76 v 2.05 c 2.89,.86 5,3.54 5,6.71 z M 9.25,8.98 l -1.27,1.26 4.72,4.73 H 7.98 v 6 H 11.98 l 5,5 v -6.73 l 4.25,4.25 c -0.67,.52 -1.42,.93 -2.25,1.18 v 2.06 c 1.38,-0.31 2.63,-0.95 3.69,-1.81 l 2.04,2.05 1.27,-1.27 -9,-9 -7.72,-7.72 z m 7.72,.99 -2.09,2.08 2.09,2.09 V 9.98 z"
                                id="ytp-id-229"
                              ></path>
                            </svg>
                          </span>
                        </div>
                        <div className={`v-fullscreen ${isFullSreen ? "v-exit" : ""}`} id="play_10" onClick={() => handleFullSreen(!isFullSreen)}>
                          <span className="v-playerIcon v-iconFullscreen">
                            <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
                              <g className="ytp-fullscreen-button-corner-0">
                                <path className="ytp-svg-fill" d="m 10,16 2,0 0,-4 4,0 0,-2 L 10,10 l 0,6 0,0 z" id="ytp-id-207"></path>
                              </g>
                              <g className="ytp-fullscreen-button-corner-1">
                                <path className="ytp-svg-fill" d="m 20,10 0,2 4,0 0,4 2,0 L 26,10 l -6,0 0,0 z" id="ytp-id-208"></path>
                              </g>
                              <g className="ytp-fullscreen-button-corner-2">
                                <path className="ytp-svg-fill" d="m 24,24 -4,0 0,2 L 26,26 l 0,-6 -2,0 0,4 0,0 z" id="ytp-id-209"></path>
                              </g>
                              <g className="ytp-fullscreen-button-corner-3">
                                <path className="ytp-svg-fill" d="M 12,20 10,20 10,26 l 6,0 0,-2 -4,0 0,-4 0,0 z" id="ytp-id-210"></path>
                              </g>
                            </svg>
                          </span>
                          <span className="v-playerIcon v-iconShrink">
                            <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
                              <g className="ytp-fullscreen-button-corner-2">
                                <path className="ytp-svg-fill" d="m 14,14 -4,0 0,2 6,0 0,-6 -2,0 0,4 0,0 z" id="ytp-id-245"></path>
                              </g>
                              <g className="ytp-fullscreen-button-corner-3">
                                <path className="ytp-svg-fill" d="m 22,14 0,-4 -2,0 0,6 6,0 0,-2 -4,0 0,0 z" id="ytp-id-246"></path>
                              </g>
                              <g className="ytp-fullscreen-button-corner-0">
                                <path className="ytp-svg-fill" d="m 20,26 2,0 0,-4 4,0 0,-2 -6,0 0,6 0,0 z" id="ytp-id-247"></path>
                              </g>
                              <g className="ytp-fullscreen-button-corner-1">
                                <path className="ytp-svg-fill" d="m 10,22 4,0 0,4 2,0 0,-6 -6,0 0,2 0,0 z" id="ytp-id-248"></path>
                              </g>
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {isMouse && !_.isEmpty(subtitles) && (
                  <div
                    id="cue_panel"
                    onWheel={() => (userScrollRef.current = Date.now())}
                    onMouseDown={() => (userScrollRef.current = Date.now())}
                    onTouchStart={() => (userScrollRef.current = Date.now())}
                    style={{
                      width: stacked ? "100%" : "min(360px, 40vw)",
                      flexShrink: 0,
                      height: stacked ? "50vh" : "80vh",
                      overflowY: "auto",
                      position: "relative",
                      background: "#141414",
                      color: "#ddd",
                      textAlign: "left",
                      cursor: "default",
                      fontSize: "15px",
                      lineHeight: 1.4,
                      borderRadius: "6px"
                    }}
                  >
                    {!activeSubLang ? (
                      <div style={{ padding: "16px", color: "#888" }}>Phụ đề đang tắt. Bật phụ đề ở nút CC để xem danh sách.</div>
                    ) : _.isEmpty(cueList) ? (
                      <div style={{ padding: "16px", color: "#888" }}>Đang tải phụ đề...</div>
                    ) : (
                      cueList.map((cue, i) => (
                        <div
                          id={`cue_${i}`}
                          key={i}
                          onClick={() => seekToCue(cue)}
                          style={{
                            padding: "6px 10px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "8px",
                            borderLeft: `3px solid ${i === cueIndex ? "#ffd700" : "transparent"}`,
                            background: i === cueIndex ? "#2c2c2c" : "transparent",
                            color: i === cueIndex ? "#fff" : "#aaa"
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <span style={{ color: "#777", fontSize: "12px", marginRight: "8px" }}>{formatClock(cue.start)}</span>
                            {cue.text}
                          </div>
                          <button
                            type="button"
                            title="Lặp lại câu này"
                            aria-pressed={i === loopIndex}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLoop(i);
                            }}
                            style={{
                              flexShrink: 0,
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              border: "1px solid " + (i === loopIndex ? "#ffd700" : "#444"),
                              background: i === loopIndex ? "#ffd700" : "transparent",
                              color: i === loopIndex ? "#000" : "#888",
                              fontSize: "14px",
                              lineHeight: "26px",
                              padding: 0,
                              cursor: "pointer"
                            }}
                          >
                            ⟲
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
      </div>
    </>
  );
};

export default Home;
