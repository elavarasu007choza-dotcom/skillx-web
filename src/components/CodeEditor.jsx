import React from "react";

const CodeEditor = () => {
  return (
    <iframe
      src="https://stackblitz.com/edit/react?embed=1&hideNavigation=1"
      style={{
        width: "100%",
        height: "100vh",
        border: "none"
      }}
      title="Code Editor"
    />
  );
};

export default CodeEditor;
