/* eslint-disable react-hooks/exhaustive-deps */
import React, { useLayoutEffect, useState } from "react";
import "./App.css";
import _ from "lodash";

const Home = () => {
  let hostname = window.location.hostname;
  let rootPath = decodeURIComponent(window.location.pathname);
  const fullPathRoot = _.filter(rootPath.split("/"), (root) => !!root);
  const readURL = `http://${hostname}:8081/`;
  const [file, setFile] = useState([]);

  useLayoutEffect(() => {
    fetch(readURL + fullPathRoot.join("/"))
      .then((response) => response.json())
      .then((data) => setFile(data));
  }, [rootPath]);

  return (
    <header className="flex min-h-screen flex-col items-center justify-center bg-[#282c34] text-[calc(10px_+_2vmin)] text-white max-[800px]:min-h-dvh max-[800px]:justify-start max-[800px]:overflow-x-clip">
      <div id="body" className="w-full">
        {file?.map((f) => (
          <div>
            {f}
            <br />
          </div>
        ))}
      </div>
    </header>
  );
};

export default Home;
