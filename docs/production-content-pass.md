# Production Content Pass

## ロスター（2026-09-15確認）

[公式ヒーロー一覧](https://overwatch.blizzard.com/en-us/Heroes/)に掲載された53名を対象とする。Tank 15 / Damage 24 / Support 14。
新規発表だけで一覧に未掲載のヒーローは含めない。

追加ロールの確認資料：
- [Season 1の5名](https://overwatch.blizzard.com/en-us/news/24246206/)
- [Sierra：Damage](https://overwatch.blizzard.com/en-gb/heroes/sierra/)
- [Shion：Damage](https://overwatch.blizzard.com/en-gb/heroes/shion/)
- [2026年8月パッチノート：D.MonはTank](https://overwatch.blizzard.com/en-us/news/patch-notes/live/2026/8/)

`src/data/heroes.ts`へid / name / role / shortLabelを集約。追加時は公式一覧と個別ロールを確認し、この確認日とロスター件数テストを更新する。既存IDは保存データの識別子なので変更しない。
検索は英語名・ID・イニシャルに対応し、大小文字・アクセント・空白・句読点を吸収する。

## UIと素材

Phase表示、デモ用という注意書き、デモ画像に戻すボタン名、フッターのポートフォリオ表現を整理。
実際のKing’s Row地形ではないという注意書きは維持。
PCは検索とロールフィルター、最大460pxのスクロール一覧。モバイルは盤面直上の検索・ロール別セレクト・味方／敵セレクトと、下部の最大320pxのカード一覧。
カードは標準buttonのEnter / Space操作、focus-visible、aria-label、aria-pressed、ロールの見出しとaria-descriptionに対応。
公式画像・アートの取得、同梱、外部画像リクエストの追加はない。文字とイニシャルによる表示を継続。

## JSON・保存互換性

schemaVersion=1、localStorageキー、旧9ヒーローID、模式図revisionを維持。shortLabelは表示用定義だけの変更で、保存データには含まれない。
未知のHero IDは従来どおり戦術全体を拒否する。要素の黙示的削除や別ヒーローへの置換はしない。Import時は該当IDと対応版で開く案内を表示し、編集内容と保存領域を保持する。
保存領域の読み込み失敗時も自動保存を停止する既存の保護を維持する。未知IDを含むJSON原本は対応版で開くまで保持する。

## 検証

単体127件：全53ヒーローの配置・JSON Export/Import・保存復元、ID重複、ロールenum、検索・ロールフィルターに加えて既存の座標・描画・履歴・保存境界テスト。
E2Eでは既存のドラッグ・タッチ・保存・共有検証に、検索・ロールフィルター・キーボード選択・新ヒーローの削除/Undo/Redo/復元・未知ID拒否を追加。

## 制約

同梱背景は実地形ではない。ヒーロー名検索は英語表記で、日本語別名検索は未対応。
ロスター更新は手動。ブラウザエミュレーションでの検証であり実機確認ではない。
ローカル背景画像の永続保存やJSON同梱、クラウド同期は対象外。

## 最終実行結果

- `npm test`: 127 passed
- `npm run lint`: 成功
- `npm run build`: 成功
- `npm run test:e2e`: 83 passed / 8 skipped（PCでのタッチ専用ケース）。合計218ケース、210成功、8対象外。
- production buildをGitHub Pagesと同じ `/ow2-plant/` サブパスで検証。Chromium PC / Pixel 7、WebKit PC / iPhone 13（品質・ヒーローテスト）。
- 上記はローカル検証結果。公開時は同じコミットのQuality成功を確認してからDeploy Pagesを実行する。リモート実行結果はGitHub Actionsの履歴を参照。

変更ファイル：`src/data/heroes.ts`、`src/data/heroes.test.ts`、`src/data/catalog.ts`、`src/domain/types.ts`、`src/domain/persistence.ts`、`src/App.tsx`、`src/components/Board.tsx`、`src/styles.css`、`index.html`、`e2e/board.spec.ts`、`e2e/heroes.spec.ts`、`playwright.config.ts`、`README.md`、本書。
