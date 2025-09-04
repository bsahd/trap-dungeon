import { h, render } from "preact";
import { GameMain } from "./io.tsx";

export type Language = "ja" | "en";

globalThis.onload = () => {
  document.getElementById("root")!.innerHTML = "";
  render(<GameMain debugInterface />, document.getElementById("root")!);
};
