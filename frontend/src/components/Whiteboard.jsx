import { Excalidraw } from "@excalidraw/excalidraw";

export default function Whiteboard() {
  return (
    <div style={{ height: "100%", background: "#fff" }}>
        <h1 style={{color : "black"}}>WHITEBOARD OPENED </h1>
      <Excalidraw />
    </div>
  );
}