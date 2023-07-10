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
    <header className="App-header">
      <div id="body" style={{ width: "100%" }}>
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
