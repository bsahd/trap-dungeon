import { h, render } from "preact";
import { GameMain } from "./io.tsx";

window.onload = () => {
  document.getElementById("root")!.innerHTML = "";
  render(<GameMain />, document.getElementById("root")!);
};
