// browser_main.js
import { game, initializeGame } from "./game.ts";
import { initBrowserGame } from "./browser_io.ts";

window.onload = () => {
  initBrowserGame(game, initializeGame);
};
