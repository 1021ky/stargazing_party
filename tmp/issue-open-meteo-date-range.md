## 概要
本番環境で都道府県選択時、晴れ予報取得が失敗し 400 になる。

表示エラー:
晴れ予報の取得に失敗しました: date range must be within 2025-07-10 and 2025-10-26

## 再現手順
1. https://stargazing-party.vercel.app/ を開く
2. 都道府県で兵庫県（※他県でも可）を選択
3. 晴れ予報取得時にエラー表示を確認

## 期待結果
晴れ予報が取得され、選択可能日が表示される。

## 実結果
400 応答になり、晴れ予報取得に失敗する。

## 影響範囲
兵庫県固有ではなく、clear-days API 経路を通る全都道府県に影響。

## 根本原因
Open-Meteo の許容日付レンジが固定値（2025-07-10〜2025-10-26）のままで、現在日付が上限を超過しているため。

- 固定値定義: src/lib/server/open_metro_api_client.ts:15, src/lib/server/open_metro_api_client.ts:16
- 例外発生: src/lib/server/open_metro_api_client.ts:91
- 期間算出: src/app/api/prefecture/clear-days/route.ts:24
- UI表示: src/app/_components/SearchForm.tsx:159

## 恒久対応（このIssueのスコープ）
1. clear-days の期間計算を UTC 基準で統一する。
2. today > maxAllowed の場合、外部 API 呼び出し前に提供期間外として処理する。
3. 提供期間外レスポンスを 200 + days: [] に統一する。
4. UI で内部例外文字列を露出せず、ユーザー向け文言に正規化する。
5. 日付境界（min/max/out-of-range）と today > maxAllowed のテストを追加する。

## 受け入れ条件
1. /api/prefecture/clear-days?prefecture=兵庫県 が 400 を返さない。
2. 提供期間外では 200 + days: [] を返す。
3. 画面に technical error 文言（date range must be within...）が出ない。
4. 追加テストが CI で通過する。
