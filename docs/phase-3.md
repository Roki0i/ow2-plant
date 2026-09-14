# Phase 3: 保存・JSON共有

## アーキテクチャ

- `domain/workspace.ts`: 戦術ごとの既存Historyをメモリで管理。追加・切替・削除と編集アクションのルーティングを担当。
- `domain/history.ts` / `strategy.ts` / `components/Board.tsx`: Phase 2から変更なし。保存はUndo/Redoをリセットしない。戦術切替時にも各戦術の履歴をメモリで維持する。
- `domain/persistence.ts`: 実行時の厳密な検証、決定的なJSON化、ID衝突回避、Storageアクセス。
- `App.tsx`: 自動保存の結果表示、一覧操作、ダウンロード・Import、画像キャッシュと未設定表示。

## 保存方式

localStorageキー `ow2-plant.strategies.v1` にStrategy配列を保存する。変更確定後のReact effectで同期的に一覧全体を1回のsetItemで書き込む。描画中のドラフトは保存しない。

保存対象は各History.presentのみ。zoom / pan / selection / tool / Undo・Redo履歴 / activeId / 画像本体は保存しない。再読込は一覧の先頭を開き、履歴とビューポートを初期化する。最後の戦術を削除すると空の戦術を1件作成する。

書込成功後のみ「保存済み」と表示。書込失敗時はメモリ内容と履歴を保持し、エラー・再試行・JSON Exportを提供する。ロード時にStorageへのアクセスまたは検証に失敗した場合は自動上書きを停止する。再試行による上書きは確認ダイアログ付き。

## JSON schema v1

Exportはラッパーなしの単一Strategyオブジェクト。Storageはその配列。全階層で未知のプロパティを拒否するため、EditorStateの混入も拒否する。

| 項目 | 制約 |
| --- | --- |
| schemaVersion | 必須、数値1のみ |
| id | 1〜200文字、保存一覧内で一意 |
| name | 0〜80文字 |
| mapId / areaId | kings-row / point-a |
| mapRevision | abstract-demo-v1 または local-に英数字・ハイフンが続く参照 |
| side | attack / defense / common |
| createdAt / updatedAt | toISOString()と一致するUTC日時文字列 |
| elements | 最大10,000要素、要素IDは戦術内で一意 |

heroはid/type/heroId/team/position、line・arrowはid/type/start/end/color/width、strokeはid/type/points/color/widthを持つ。heroIdは既存9ヒーロー、teamはally/enemy。座標はx/yとも有限な数値の0〜1。線色は#と6桁16進数、線幅は有限な1〜12。strokeは2〜2048点。NaN、Infinity、JSON数値のオーバーフロー、不正日時、未知のバージョンや描画種別、重複IDを拒否する。

キーを全階層で辞書順に並べ、2スペース字下げ・末尾改行でExport。配列順序は描画の重なり順として維持。時刻やIDをExport時に変更しないため、同一データから同一バイト列になる。

Importは5MiBまで。検証を完了してから追加し、既存戦術を更新しない。ID衝突時は新しいUUIDを割り当てる。要素IDは戦術スコープなので維持。複製は常に新しい戦術IDと独立したデータを生成する。

## ローカル画像

local-*のmapRevisionのみ保存・Exportし、ファイル名や画像本体を含めない。ロード済みHTMLImageElementとファイル名はメモリキャッシュに保持。同じセッション内の切替・複製では再利用できる。

JSON Export/Importと盤面の通知で、画像が共有されないことを明示。再読込で画像が消えても要素データを保持し、未設定表示にする。同じ画像を再選択すれば配置を消さず復帰できる。画像がある状態での背景変更は、従来どおり確認後に配置と履歴をクリアする。

## 検証

Node 26.8.2でbuild / lint成功。Unit: 61成功（既存28＋追加33）。E2E: 34件中30成功、4スキップ（既存のPCでのタッチ専用テスト）。追加5シナリオをdesktop / Pixel 7エミュレーションで実施。

既存の描画3種、ドラッグ、スタイル変更、削除、Undo/Redo、パン・ズーム、2本指操作、リサイズ、背景変更を維持。追加テストで保存・再読込・名前変更・新規・複製・削除、JSONダウンロードとImport、衝突・不正データ、ローカル画像の再設定、quota失敗・再試行、破損Storage保護を確認。

## 制約

- ブラウザ・オリジン単位。ブラウザデータ削除で保存内容は消える。保存失敗中にタブを閉じると未保存内容は失われるため、表示されたエラーに従い再試行またはExportする。
- 複数タブの競合調停は未実装。複数タブで編集した場合は最後の保存が優先される。
- ローカル画像は再選択が必要。同じ画像かどうかの内容照合は行わない。
- 同期localStorageのため大量の戦術・描画では容量と書込時間の制限がある。5MiBを超えるExportの再Importは非対応。
- v1のみ対応。将来のschema migration、他マップ、URL共有、クラウド、ログイン、共同編集は未実装。
- mobile確認はChromiumのPixel 7エミュレーション。実機・Safariは未検証。
