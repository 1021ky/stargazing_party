## 概要

光害指標の分類基準を、環境省の「夜空の明るさ（mag/□")」等級分布に近似するように見直す。

## 関連Issue（下書き）

- #20

## 背景

- 現在は3段階（低/中/高）分類で、閾値は `src/lib/server/light_pollution_service.ts` に固定されている。
- 現行分類は環境省の公表している6等級分布と乖離して見える。
- 参照: <https://www.env.go.jp/press/press_02365.html>

## 参照基準（環境省）

- 21以上
- 20以上〜21未満
- 19以上〜20未満
- 18以上〜19未満
- 17以上〜18未満
- 17未満

## 要件

1. Black Marble由来値について、mag/□" 等級との対応付け手法を定義する。
2. 分類レベルを6区分へ拡張する（型定義・表示文言を含む）。
3. GIBSフォールバック値にも整合する代替マッピングを定義する。

## 実装スコープ外

- 地図表示とカード表示の値不一致の不具合修正は別Issueで対応する。

## 技術課題

- NTL proxy値と mag/□" は単位体系が異なるため、直接比較は不可。
- 変換式の調査（文献/API仕様）が必要。
- 変換式が得られない場合、既知地点データとの経験的キャリブレーション戦略が必要。

## 影響範囲

- `src/lib/server/light_pollution_service.ts`（分類ロジック）
- `src/lib/server/black_marble_api_client.ts`（値解釈の根拠整理）
- `src/lib/server/gibs_light_pollution_client.ts`（フォールバック分類調整）
- `src/app/_components/AccommodationCard.tsx`（表示ラベル/説明）
- 関連テスト（unit/integration）

## 受け入れ条件

1. 光害分類が6区分で出力・表示される。
2. 検証データに対する6等級の一致率が 80% 以上である。
3. 既存テストを更新し、分類ロジックの境界値テストが追加される。
