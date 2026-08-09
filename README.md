# 飲み物堂 — セットアップ

Next.js（App Router）+ microCMS + Vercel を前提にしています。

## 1. 依存パッケージ

```bash
npm install microcms-js-sdk
```

## 2. 環境変数

`.env.local` を作成します。

```
MICROCMS_SERVICE_DOMAIN=xxxxxxxx
MICROCMS_API_KEY=xxxxxxxxxxxxxxxx
```

Vercel にも同じ2つを登録してください。`NEXT_PUBLIC_` を付けないのが重要です。付けるとAPIキーがブラウザに露出します。

## 3. microCMS のスキーマ

### categories（リスト形式）

| フィールドID | 種類 | 備考 |
|---|---|---|
| `name` | テキスト | 表示名（日常・映画 など） |
| `color` | セレクト | 下記7つを選択肢に登録。複数選択はオフ |

セレクトの選択肢は、この文字列をそのまま入れてください。

```
green
olive
amber
orange
red
magenta
blue
```

色そのものは `lib/format.ts` の `PALETTE` が持っています。カテゴリを増やすときは管理画面で名前と色を選ぶだけで、コードの修正は不要です。

### miscellany（リスト形式）

| フィールドID | 種類 |
|---|---|
| `title` | テキスト |
| `body` | リッチエディタ |
| `category` | コンテンツ参照（categories） |

エンドポイントIDを `miscellany` にしておくと、記事URLが `/miscellany/{id}` になり既存URLと変わりません。

### events（リスト形式）

| フィールドID | 種類 | 備考 |
|---|---|---|
| `title` | テキスト | |
| `date` | 日時 | 並び替えと過去/未来の判定に使う |
| `venue` | テキスト | 任意 |
| `detail` | テキスト | 開場時間・料金など。任意 |
| `reserveUrl` | テキスト | 予約先。任意 |

## 4. 画像ファイル

`public/` に置きます。

- `favicon.svg`
- `apple-touch-icon.png`（180×180）
- `ogp.png`（1200×630）
- `avatar.jpg`（プロフィール写真）

## 5. `lib/site.ts` を編集

`url` を実際の公開URLに、`formspree` を自分のエンドポイントに差し替えてください。OGP画像は絶対URLでないとSNSに反映されないので、`url` の設定は必須です。

## 6. 下書きプレビュー（任意）

microCMS の画面プレビュー設定に次を登録すると、公開前の記事を確認できます。

```
https://サイトURL/miscellany/{CONTENT_ID}?draftKey={DRAFT_KEY}
```

## 設計メモ

**色の役割を分けています。** ティール `#04756B` はリンク・ボタン・導線といった「機能」だけに使い、記事の分類には7色のカテゴリ色を使います。リンクの色が記事ごとに変わらないので、読者が迷いません。

**無限スクロールは2回で止まります。** そのあとは「もっと読む」ボタンに切り替わります。無制限に自動読み込みすると、下部のプロフィールやフッターに永久に到達できなくなるためです。回数は `components/ArticleList.tsx` の `AUTO_LOAD_LIMIT` で変えられます。

**本文の見た目は `.prose` にまとまっています。** microCMS が吐き出す `<h2>` や `<blockquote>` に対してスタイルを当てているので、記事を書くときに装飾を意識する必要はありません。

**表とリンク羅列だけ、CSSでは届かないので加工しています。** `lib/format.ts` の `enhanceBody` が、表を横スクロール用の枠で包み、リンクだけの段落に `link-row` クラスを付けます。
