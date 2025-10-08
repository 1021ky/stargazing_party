# Design Document for Stargazing Party

この文書は、Stargazing Partyの設計に関する情報を集約したものです。

## Stargazaing Partyとは

指定された場所で、星を見るための条件が揃っているか確認できる。

* 新月の日、あるいはその前後日
* 天気予報が晴れになっていること

指定された場所の周辺で宿泊できる施設を探せる。

## 使用するAPI

* open-metro in 緯度経度 out 天候情報
* Yahoo!リバースジオコーダAPI in 緯度経度 out 住所
* じゃらんAPI in 住所 out 宿泊施設情報
