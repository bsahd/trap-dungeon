import { h, hydrate } from "preact";
// import "preact/debug"
import { GameMain } from "./io.tsx";

export type Language = "ja" | "en";

globalThis.onload = () => {
  // document.getElementById("root")!.innerHTML = "";
  hydrate(<GameMain debugInterface />, document.getElementById("root")!);
};
