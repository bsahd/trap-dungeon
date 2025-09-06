[English](README.en.md)

# bsahd/trap-dungeon

inajobさんの[Trap Dungeon](https://github.com/inajob/trap-dungeon)をベースにモダンなTypeScript+Deno+Preact構成で開発するプロジェクトです。

## 動作要件

- ES モジュールに対応したブラウザ
  - 対応ブラウザの詳細については、
    [一覧](https://caniuse.com/es6-module)を確認してください。

## 開発要件

- Deno 2.4 または それ以降

## 遊び方

### オンライン

- [ゲームページ](https://bsahd.github.io/trap-dungeon/)をブラウザで開いてください。
- スクリプトはGitHub Actionsにより自動でバンドルされます。

### ローカル(開発要件のツールが必要です)

1. このリポジトリをクローンしてください。
2. リポジトリのルートに`cd`してください。
3. `deno task build`
4. ローカルサーバー (静的 HTTP サーバー) を起動し、ローカルサーバーのアドレスをブラウザで開きます。