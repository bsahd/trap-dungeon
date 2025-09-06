import { render } from "preact-render-to-string";
import { GameMain } from "./io.tsx";
import { h } from "preact";

const indexHtmlContent = render(
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Trap Dungeon</title>
      <link rel="stylesheet" href="browser/style.css" />
      <link rel="shortcut icon" href="favicon.ico" type="image/xpng" />
      <script type="module" defer src="browser/bundled.js"></script>
    </head>
    <body>
      <div id="root" class="game-wrapper">
        <GameMain debugInterface />
      </div>
    </body>
  </html>,
);

await Deno.create(
  new URL("../index.html", import.meta.url),
);
await Deno.writeTextFile(
  new URL("../index.html", import.meta.url),
  "<!DOCTYPE html>\n" + indexHtmlContent,
);
