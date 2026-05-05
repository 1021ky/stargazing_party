## 概要

ホテルカードを選択したとき、地図上の対応マーカーを拡大・強調表示し、位置を視覚的に特定しやすくする。

## 関連Issue（下書き）

- #17

## 背景

- カード一覧と地図マーカーの対応が分かりづらく、選択したホテルの位置が即座に判断できない。

## 要件

1. `selectedHotelId: string | null` を親（`src/app/page.tsx`）で管理する。
2. `AccommodationCard` クリック時に `selectedHotelId` を更新する。
3. `selectedHotelId` と一致するマーカーを、通常サイズの1.5倍で描画する。
4. 別ホテルを選ぶと前の強調は解除される。

## 実装スコープ

- カード選択とマーカー強調の連携。
- 地図自動パン/ズームは本Issueの必須要件には含めない（必要なら別Issue）。

## 依存関係

- 先行: #17

## 影響範囲

- `src/app/page.tsx`（選択状態管理とprops配線）
- `src/app/_components/SearchResults.tsx`（選択イベントハンドリング）
- `src/app/_components/AccommodationCard.tsx`（選択可能UI化）
- `src/app/_components/PrefectureMapCanvas.tsx`（選択中マーカーの描画変更）

## 受け入れ条件

1. カードクリックで対応マーカーが強調表示される。
2. 別カード選択で強調対象が切り替わる。
3. 選択解除（未選択状態）で全マーカーが通常表示に戻る。
