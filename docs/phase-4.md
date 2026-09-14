# Phase 4 — 品質・公開仕上げ

## 保存と複数タブ

- 同一originの`storage` event（戦術キー更新・削除・clear）を監視。保存直前にも最後に確認した内容と比較。
- 他タブの変更を検出したら自動保存を止め、現在の編集・Undo/Redoを維持。戦術単位ではなく保存一覧全体を競合として扱う。
- 「保存済みを再読込」は破棄確認後に読み直す。「現在の編集を保持」はメモリ内で続行し、自動保存を再開しない。JSON Exportで退避可能。
- 「現在の内容で保存」は確認後に保存一覧全体を置換。他タブ側にも競合を通知する。自動マージは行わない。
- 破損JSON・schemaVersion不一致は既存保存領域を維持。空の作業領域で編集でき、明示的な再試行・上書き確認で復旧。
- quota / storage利用不可のエラーでは編集内容を維持。未保存時のページ離脱はbeforeunloadでも警告するが、モバイルOSによるタブ終了を防ぐ保証はない。

## Accessibility / Mobile

- 標準button、label、select、detailsとfocus-visible。通知にはalert/status。
- Canvasの説明ラベルと代替フォーム：開始・終了座標(%)でヒーロー、直線、矢印、2点のストロークを追加。配置一覧から数値移動、描画一覧から選択・色・線幅変更、削除、Undo/Redo。
- 盤面移動・ズームもボタンで操作可能。Ctrl/⌘ + Z、Shift併用Redo、選択要素のDelete/Backspaceを維持。
- 味方は実線、敵は破線。●/◌と一覧の「味方」「敵」も併記する。
- スマホでは盤面直前のヒーロー・チーム選択と折り返しツールバーを使用。タッチ対象は原則44px以上、入力文字は16px、Canvasはtouch-action:none / overscroll-behavior:contain。
- 375 / 390 / 412pxで横はみ出し、選択・配置を自動確認。スクリーンショットを保存。

## 入力・セキュリティレビュー

- JSONはファイルサイズ5MiBまで、必須キーと未知キー、schemaVersion、既知のmap/hero、座標・数値の有限性、日付、重複ID、色のhex形式、線幅を検証。team/sideの配列による文字列偽装も拒否する。
- 最大10,000要素、1ストローク2,048点。storage読み書きには20Mi文字のパース前・書込前上限も設ける（ブラウザのquotaが先に適用される場合がある）。
- PNG/JPEG/WebPのMIME・10MiB制限と実画像デコード、2,400万画素制限を維持。SVG importは拒否。object URLを使用し読み込み終了後に解放。画像はメモリのみで送信・保存しない。
- ユーザー入力はReactの文字列として表示し、dangerouslySetInnerHTML / innerHTML / eval / HTML文字列実行経路はない。JSONの画像URLを取得する経路もない。HTML風の戦術名は文字列のまま表示するE2Eを追加。
- 同梱SVGは開発者管理の自作模式図。公式アセットは追加していない。

## CI / 公開

`.github/workflows/ci.yml`はPRとmainへのpushでNode 22 / Ubuntuを使用し、npm ci → npm test → npm run lint → npm run build → Chromium/WebKitインストール → Playwright E2Eを実行。test-resultsを7日間artifactとして保存する。GitHub上での実行自体はこのローカル作業では未実施。

Playwrightはdev serverではなくproduction build + vite previewを使い、`/ow2-plant/`配下でJS/CSS/自作背景画像を含む全操作を検証。buildとpreview双方に同じbaseを渡す。

公開手順：

1. リポジトリへ変更をpushし、Qualityを成功させる。
2. GitHub Settings → Pages → SourceをGitHub Actionsに設定する。
3. Actions → Deploy Pages → Run workflowを実行する。
4. 完了後のenvironment URLで表示を確認する。

公開workflowは手動起動のみ。今回は外部公開していない。既定の`base: './'`によりルート・リポジトリサブパスの静的ホストに対応。任意ホストでも`npm run build`の`dist/`を配信できる。明示的なパスなら`npm run build -- --base=/repo-name/`を使い、previewにも同じbaseを指定する。file://直開きは対象外。HTTPSで配信する。

参照：[Vite静的公開](https://vite.dev/guide/static-deploy)、[Playwrightブラウザ](https://playwright.dev/docs/browsers)。Playwright WebKitはSafari製品そのものではない。

## 最終検証結果（2026-09-14）

macOS arm64 / Node 26.8.2 / Playwright 1.63.0、2 workersで測定。CIはNode 22。

- Unit: **65件成功**（既存61件を維持し4件追加）。
- E2E: **75件成功 / 8件対象外 / 失敗0 / flaky 0**。25シナリオをChromium desktop・Pixel 7・WebKit desktopで実行し、品質8シナリオをWebKit iPhoneでも実行。対象外8件はdesktop 2種類のタッチ専用各4件。
- 合計成功 **140件**。lint、TypeScript、Vite production build、git diff --check成功。
- 375 / 390 / 412pxを4プロジェクトで検証。ChromiumとWebKitの375pxスクリーンショットを目視確認。
- production buildの`/ow2-plant/`配下で背景画像・配置・描画・保存・JSON共有まで検証。既定の相対baseでもbuild成功。

負荷fixtureは`e2e/quality.spec.ts`で生成。hero / line / arrow / stroke各250個、strokeは32点で計1,000要素。テスト実行後に`test-results/quality-mixed-1000-element-fixture-stays-editable-*/mixed-1000.json`と`timings.json`を出力する。単独再現は`npm run test:e2e -- --grep 'mixed 1000' --workers=2`。

| 環境 | JSON importから要素表示確認 | ズーム＋戦術名変更＋保存確認 |
| --- | ---: | ---: |
| Chromium desktop | 699 ms | 361 ms |
| Chromium Pixel 7 | 1271 ms | 640 ms |
| WebKit desktop | 1347 ms | 2771 ms |
| WebKit iPhone | 732 ms | 3729 ms |

測定はPlaywright操作・スクロール・待機も含むend-to-endの壁時計時間。描画FPSや純粋なReact render時間ではなく、環境負荷で変動する。各区間10秒未満を回帰の粗い基準とし、再読込後の1,000要素復元も確認。

Boardをmemo化してコールバックを安定させ、戦術名・保存状態の変更だけではCanvasを再描画しないようにした。非選択アイコンの影も省略。変更前のPixel 7相当のズーム＋名前変更＋保存は5,582ms、最終測定は640ms。変更のないUndo等ではworkspaceの参照を維持し、無駄な保存を避ける。

## 残る制約

- macOS Safari製品・iPhone/Android実機、VoiceOver/TalkBack/NVDAでの実操作は未検証。WebKit iPhoneでは品質テストのみ。2本指ピンチ/キャンセルはChromium CDPで検証し、WebKit desktopのタッチ専用4件は対象外。
- iOSのアドレスバー伸縮、OSのファイル選択/ダウンロード、メモリ圧迫・タブ終了、プライベートモードの永続性は実機確認が必要。WebKitではネイティブselectの描画が意図した44pxの高さを反映しない問題をスクリーンショットで発見し、appearance:noneと独自の矢印表示で修正。375/390/412pxで高さ44px以上を回帰テストに追加した。
- localStorageは原子的なcompare-and-swapを持たないため、完全同時の書込みを分散ロックのように排他する保証はない。通常の他タブ更新検出・未保存編集保持を提供する。
- ローカル背景画像とUndo/Redoは再読込後に復元しない。開いていた戦術の選択も保存せず、再読込後は一覧の先頭を開く。
- 数値UIのフリーハンド追加は2点の線分。任意曲線はCanvas操作を使用。
- 1,000要素の測定は低性能実機や上限10,000要素の保証ではなく、FPS/メモリの精密ベンチマークではない。保存は同期処理で、極端に大きなデータは応答を遅らせる可能性がある。
- 非公式ツール。ログイン・クラウド保存・共同編集・backend・AIは追加していない。
