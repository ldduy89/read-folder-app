/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import fileIcon from "./file.png";
import folderIcon from "./folder.png";
import "./App.css";
import ReactPlayer from "react-player";
import _ from "lodash";
import Duration from "./Duration";
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
  const trasksURL = `http://${hostname}:8081/trasks/`;
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
    playbackRate: 1.0,
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
  const [isMouse, setIsMouse] = useState(false);

  if (!_.isEmpty(textTracks) && !_.isEmpty(subtitles)) {
    const subtitle = subtitles.find((s) => s.default);
    for (const element of textTracks) {
      element.mode = element.language === subtitle?.language ? "showing" : "hidden";
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
    setStateElm({ played: 0, playing: true });
    setBoxTracks(false);
    if (type !== "file") {
      fetch(publicURL + fullPathRoot.join("/"))
        .then((response) => response.json())
        .then((data) => setFolders(data));
    } else {
      getSubtitles();
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
    const subFile = document.getElementById(`sub_${indexSub}`);
    if (subFile) {
      subFile.classList.add("s-active");
    }
  }, [indexSub]);

  const changeSubtitle = (language, noSetSub) => {
    if (textTracks && textTracks.length > 0) {
      for (const element of textTracks) {
        element.mode = element.language === language ? "showing" : "hidden";
      }
    }
    const newSybtitle = _.clone(subtitles);
    newSybtitle.forEach((sub) => {
      sub.default = sub.language === language;
    });
    if (!noSetSub) setSubtitles(newSybtitle);
  };

  const handleActionFile = (fileName, path) => {
    if (fileName) history.replace(`/${[path, fileName].join("/")}?type=file`);
  };

  const sizeBar = {
    "--width-bar": sample_video && sample_video.offsetHeight >= 1080 ? "100px" : "50px",
    "--font-size": sample_video && sample_video.offsetHeight >= 1080 ? "24px" : "12px",
    "--font-size-subtitle": sample_video ? sample_video.offsetHeight / 18 + "px" : "24px"
  };

  useEffect(() => {
    if (sample_video && type === "file") {
      handleFullSreen(true);
    }
  }, [sample_video]);

  const onFullSreenEvent = (e) => {
    if (!document.fullscreenElement) {
      history.replace(`/${backRootPath}`, { folder: _.last(fullPathRoot) });
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
    if (indexFile === 0) {
      currentRef.current = setTimeout((indexFile) => {
        setHide(true);
        setBoxTracks(false);
        if (indexFile !== 0) setIndexFile(0);
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
    if (!boxTracks) {
      let newIndex = action ? 3 : 0;
      if (indexFile === 0 && !action) {
        setHide(true);
        if (indexFile === 3 && action) setIndexFile(0);
      } else {
        setIndexFile(newIndex);
      }
    } else {
      let newIndex = action ? indexSub + 1 : indexSub - 1;
      if (newIndex < 0) newIndex = subtitles.length;
      if (newIndex > subtitles.length) newIndex = 0;
      setIndexSub(newIndex);
    }
  };

  const leftRightVideoHandle = (action) => {
    if (indexFile === 0) {
      handleChangeSeek(action);
    } else {
      let newIndex = action ? indexFile + 1 : indexFile - 1;
      if (newIndex < 1) newIndex = 8;
      if (newIndex > 8) newIndex = 1;
      setIndexFile(newIndex);
    }
  };

  const boxTrackHandle = () => {
    if (!_.isEmpty(subtitles) && !boxTracks) {
      const index = _.findIndex(subtitles, (s) => !!s.default);
      setIndexSub(index + 1);
    }
    !_.isEmpty(subtitles) && setBoxTracks(!boxTracks);
  };

  return (
    <>
      <div style={{ position: "fixed" }} onClick={() => setIsMouse(!isMouse)}>
        <button>{isMouse ? "To Remote" : "To Mouse"}</button>
      </div>
      <div
        className="App"
        onMouseMove={(event) => {
          if (!isMouse) {
            const { movementX, movementY } = event;
            if (!isFullSreen && !movementX && movementY && (movementY > 5 || movementY < -5)) actionInListFileHandle(movementY > 0);
            if (!isFullSreen && movementX && !movementY && (movementX > 5 || movementX < -5)) actionInListFileHandle(movementX > 0);
          }
        }}
        onClick={() => {
          if (!isMouse) {
            document.getElementsByClassName("f-active")[0].getElementsByTagName("a")[0].click();
          }
        }}
      >
        <header className="App-header">
          <div className="App-body" id="body">
            <b>
              {root !== "" ? (
                <Link id={`path_0`} to="/">
                  Home
                </Link>
              ) : (
                "Home"
              )}
            </b>
            {fullPathRoot.map((path, index) => {
              const currentPathArr = _.dropRight(fullPathRoot, fullPathRoot.length - index - 1);
              return (
                <b key={index}>
                  {" / "}
                  {root !== "" && index + 1 !== fullPathRoot.length && (
                    <Link id={`path_${index + 1}`} to={`/${currentPathArr.join("/")}`}>
                      {path}
                    </Link>
                  )}
                  {root !== "" && index + 1 === fullPathRoot.length && path}
                </b>
              );
            })}

            <br />
            <br />
            <b>
              {root !== "" && (
                <Link id={`back_0`} to={`/${backRootPath}`}>
                  {"< Back"}
                </Link>
              )}
            </b>
            <br />
            <br />
            <br />
            {type !== "file" ? (
              folders.map((folder, index) => {
                const fullPath = _.filter([root, pathName, folder.name], (elm) => !!elm).join("/");
                return (
                  <div className={`App-item ${indexFile === index ? "f-active" : ""}`} id={`file_${index}`} key={index}>
                    <img src={folder.type === "file" ? fileIcon : folderIcon} alt="icon" />
                    <Link to={`/${fullPath}${folder.type === "file" ? "?type=file" : ""}`}>{folder.name}</Link>
                  </div>
                );
              })
            ) : (
              <>
                <div className="player-wrapper">
                  <div
                    onMouseMove={(event) => {
                      handleAutoHide();
                      if (!isMouse) {
                        const { movementX, movementY } = event;
                        if (isFullSreen && !movementX && movementY && (movementY > 5 || movementY < -5)) upDownVideoHandle(movementY > 0);
                        if (isFullSreen && movementX && !movementY && (movementX > 5 || movementX < -5)) leftRightVideoHandle(movementX > 0);
                      }
                    }}
                    onClick={() => {
                      handleAutoHide();
                      if (!isMouse) {
                        if (indexFile === 0) {
                          setStateElm({ playing: !state.playing });
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
                        muted={state.muted}
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

                    <div className={`v-topBar ${hide ? "hidden" : ""}`}>
                      <span className="v-topTitle">{fileName}</span>
                    </div>
                    <div
                      className="v-overlayVideo"
                      onClick={() => setStateElm({ playing: !state.playing })}
                      onDoubleClick={() => handleFullSreen(!isFullSreen)}
                    ></div>
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
                        <div className="v-playPauseButton" id="play_2" onClick={() => handleChangeSeek(false, 120)}>
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
                        <div className="v-playPauseButton" id="play_4" onClick={() => handleChangeSeek(true, 120)}>
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
                        <div className="v-time">
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
                            <ul>
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
                          </div>
                        </div>
                        <div className={`v-volume ${state.muted ? "v-muted" : ""}`} id="play_7" onClick={() => setStateElm({ muted: !state.muted })}>
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
                        <div className={`v-fullscreen ${isFullSreen ? "v-exit" : ""}`} id="play_8" onClick={() => handleFullSreen(!isFullSreen)}>
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
              </>
            )}
            <br />
            <br />
            <b>{root !== "" && <Link to={`/${backRootPath}`}>{"< Back"}</Link>}</b>
          </div>
        </header>
      </div>
    </>
  );
};

export default Home;
