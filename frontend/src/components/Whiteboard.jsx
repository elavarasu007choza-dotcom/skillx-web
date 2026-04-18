import * as ExcalidrawLib from "@excalidraw/excalidraw/dist/excalidraw.production.min.js";

const Excalidraw =
	ExcalidrawLib.Excalidraw ||
	ExcalidrawLib.default?.Excalidraw ||
	ExcalidrawLib.default;

export default function Whiteboard() {
return (
<div style={{ height: "100%", background: "#fff" }}>
<Excalidraw />
</div>
);
}