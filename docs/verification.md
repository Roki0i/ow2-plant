# Phase 0–1 検証結果

実施日：2026-09-14

## 結果

| コマンド | 結果 |
| --- | --- |
| `npm test` | 3ファイル・15テスト成功 |
| `npm run lint` | 成功、警告・エラー0 |
| `npm run build` | TypeScriptチェックとVite本番ビルド成功、ビルド警告0 |
| `npm run test:e2e` | 7成功、1スキップ（PCプロジェクトでは2本指ピンチを対象外） |
| `git diff --check` | 成功 |

検証環境：macOS、Node.js 26.8.2（既存Homebrew版）、React 19.3.0、Vite 7.3.6、Konva 10.5.0、react-konva 19.2.7、Playwright 1.63.0、Chromium。
依存バージョンは`package-lock.json`に固定。標準PATHのNode.js 20.17.0は本構成の対象外。

依存取得とローカルサーバー・Chromiumの起動はサンドボックス内でDNS/EPERMになったため、承認されたサンドボックス外の実行で検証した。

## 確認範囲

- 画像の縦横比維持、余白の配置拒否、ズーム・パンを含む座標往復、端へのクランプ。
- 配置・移動の不変更新、重複IDや不正座標の拒否、背景変更での配置クリア。
- 画像種別・容量制限。
- PCとPixel 7エミュレーションで、Canvas描画、クリック／タップ配置、マウス／タッチドラッグ、ズーム、リサイズ後の座標保持と再描画、横方向のはみ出しなし。
- 2本指ピンチで表示倍率が変わり、不要なヒーローが配置されない。
- 不正形式と破損画像のエラー表示、既存配置の保持。
- 正常なローカル画像の読み込み、変更確認のキャンセル、確定時の配置リセット、読み込み後の再配置、アップロード用POSTリクエストなし。
- ブラウザの未処理エラーなし（主要操作テスト）。リサイズ後のPC・モバイル画面キャプチャを目視確認。

## 変更ファイル

| 領域 | ファイル |
| --- | --- |
| 基盤 | `.gitignore`, `.nvmrc`, `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts` |
| 画面 | `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/components/Board.tsx` |
| 型とドメイン処理 | `src/domain/types.ts`, `src/domain/coordinates.ts`, `src/domain/strategy.ts`, `src/domain/image.ts` |
| カタログ・自作素材 | `src/data/catalog.ts`, `public/maps/tactical-demo.svg` |
| テスト | `src/domain/coordinates.test.ts`, `src/domain/strategy.test.ts`, `src/domain/image.test.ts`, `e2e/board.spec.ts` |
| 文書 | `README.md`, `docs/asset-policy.md`, `docs/phase-0-1.md`, `docs/verification.md` |

## 未検証・制約

- 同梱画像は自作の抽象図。King’s Rowの実地形表示・地形精度・高低差は未達。詳細は[素材方針](asset-policy.md)。
- ヒーローは9種の文字バッジ。全ヒーロー・公式肖像は未対応。
- モバイルはChromiumエミュレーションであり、iOS Safari・Android実機は未検証。
- 本番build自体は成功。操作E2EはVite開発サーバーに対して実施し、公開先へのデプロイは行っていない。
- 依存取得時にESLint 9のサポート終了通知があった。現構成のlintは成功しているが、後続のツール更新でESLint 10系への移行を検討する。
- Phase 2の描画・Undo/Redo、Phase 3の保存・共有は未実装。
