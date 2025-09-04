# bsahd/trap-dungeon

inajobさんの[Trap Dungeon](https://github.com/inajob/trap-dungeon)を、TypeScript+Deno+Preact構成に置き換えるプロジェクトです。

This project replaces inajob's
[Trap Dungeon](https://github.com/inajob/trap-dungeon) with a TypeScript +
Deno + Preact configuration.

## Play Requirements

- Browser supports ES Modules
  - For more information on supported browsers, see
    [JavaScript modules via script tag](https://caniuse.com/es6-module).

## Development Requirements

- Deno 2.4 or later

## How to play

### Online

- Open [play page](https://bsahd.github.io/trap-dungeon/).
- Script is automatic bundled by GitHub Actions.

### Local

1. Clone this repo.
2. Change current directory to repo root.
3. Bundle script for browser:
   `deno bundle browser/main.tsx -o browser/bundled.js --minify --sourcemap=linked`
   `deno bundle browser_classic/main.ts -o browser_classic/bundled.js --minify --sourcemap=linked`
4. Start local server(static http server) and open local server's address.
