# OW2 Plant

Overwatch 2向けの非公式戦術ボード。Phase 0–1のポートフォリオ用プロトタイプです。

## 起動

Node.js 22.12以上（`.nvmrc`は22）とnpmが必要です。

```sh
nvm use
npm ci
npm run dev
```

この作業環境の標準Nodeは20.17だったため、検証には既存の`/opt/homebrew/opt/node/bin/node`（26.8.2）を使いました。標準Node 20.17では起動せず、上記の対応バージョンへ切り替えてください。

## 操作

- ヒーローと味方／敵を選び、盤面をクリック・タップして配置。
- 配置後は自動的に選択・移動ツールに切り替わります。アイコンをドラッグして移動。
- ホイール・倍率ボタンでズーム、パンツールで盤面移動。スマホでは2本指でピンチとパン。
- 配置一覧から座標を数値で変更可能。
- 背景画像の設定から、利用権限のあるPNG/JPEG/WebPを端末内で読み込み可能。

**同梱の自作模式図はKing’s Rowの実地形ではありません。** 初期対象はKing’s Row / 第1拠点ですが、公式マップ画像やヒーロー肖像は配布しません。ヒーローは9種の文字バッジです。
画像は送信・保存しません。戦術保存もまだなく、リロードすると配置は消えます。

## 検証

```sh
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

単体テストは座標変換、配置・移動Reducer、画像ファイル検証を対象とします。PlaywrightはChromiumのPCとPixel 7エミュレーションで操作を確認します。スマホ実機確認とは区別してください。

## 構成

- React + TypeScript + Vite + react-konva / Konva
- `src/domain/`：型、座標、戦術更新、画像読み込み、単体テスト
- `src/data/catalog.ts`：対象マップとヒーロー定義
- `src/components/Board.tsx`：Canvas表示、配置・ドラッグ・視点操作
- `src/App.tsx`：エディター画面と一時状態
- `public/maps/`：自作デモ素材
- `e2e/`：ブラウザテスト

[素材調査・利用方針](docs/asset-policy.md) / [Phase 0–1設計・次Phaseの課題](docs/phase-0-1.md)

描画、Undo/Redo、保存、JSON共有は後続Phaseです。公式との提携・承認はありません。
