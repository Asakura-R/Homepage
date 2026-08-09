# 飲み物堂

エッセイ中心の個人サイト。Next.js（App Router）+ microCMS + Vercel。

## はじめかた

```bash
npm install
cp .env.example .env.local   # 中身を埋める
npm run dev
```

`http://localhost:3000` で確認できます。

## 環境変数

`.env.local` を作成します。

```
MICROCMS_SERVICE_DOMAIN=xxxxxxxx
MICROCMS_API_KEY=xxxxxxxxxxxxxxxx
```

Vercel にも同じ2つを登録してください。`NEXT_PUBLIC_` を付けないのが重要です。付けるとAPIキーがブラウザに露出します。

## microCMS のスキーマ

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

## 画像ファイル

`public/` に一式入っています。

| ファイル | 内容 |
|---|---|
| `favicon.svg` | 既定はカクテル。`public/favicons/` の3案から差し替え可 |
| `favicons/favicon-cocktail.svg` | カクテル（16pxで最も判別しやすい） |
| `favicons/favicon-coffee.svg` | コーヒー |
| `favicons/favicon-can.svg` | 空き缶 |
| `apple-touch-icon.png` | 180×180。favicon.svg から生成済み |
| `ogp.png` | 1200×630。SNS共有時の画像 |
| `ogp.svg` | OGPの編集用 |
| `avatar.png` | プロフィール写真の仮画像。差し替えてください |

faviconを差し替えるときは、`public/favicons/` から好きなものを `public/favicon.svg` に上書きコピーし、`apple-touch-icon.png` を作り直してください（[RealFaviconGenerator](https://realfavicongenerator.net/) にSVGを渡せば書き出せます）。

`.ico` は現在含めていません。モダンブラウザは `favicon.svg` を読むので必須ではありませんが、古い環境も拾いたい場合は同じサイトで生成できます。

## 公開前に必ず編集するもの

`lib/site.ts` の次の項目が仮の値です。

- `url` — 公開URL。OGP画像は絶対URLでないとSNSに反映されないので必須
- `formspree` — お問い合わせフォームの送信先
- `sns` — X / Instagram のリンク
- `bio` — サイドバーの一行紹介

`public/avatar.png` も仮画像なので差し替えてください。

## 下書きプレビュー（任意）

microCMS の画面プレビュー設定に次を登録すると、公開前の記事を確認できます。

```
https://サイトURL/miscellany/{CONTENT_ID}?draftKey={DRAFT_KEY}
```

## 設計メモ

**色の役割を分けています。** ティール `#04756B` はリンク・ボタン・導線といった「機能」だけに使い、記事の分類には7色のカテゴリ色を使います。リンクの色が記事ごとに変わらないので、読者が迷いません。

**無限スクロールは2回で止まります。** そのあとは「もっと読む」ボタンに切り替わります。無制限に自動読み込みすると、下部のプロフィールやフッターに永久に到達できなくなるためです。回数は `components/ArticleList.tsx` の `AUTO_LOAD_LIMIT` で変えられます。

**本文の見た目は `.prose` にまとまっています。** microCMS が吐き出す `<h2>` や `<blockquote>` に対してスタイルを当てているので、記事を書くときに装飾を意識する必要はありません。

**表とリンク羅列だけ、CSSでは届かないので加工しています。** `lib/format.ts` の `enhanceBody` が、表を横スクロール用の枠で包み、リンクだけの段落に `link-row` クラスを付けます。

## ディレクトリ

```
app/          ページ。フォルダ構成がそのままURLになる
  api/        無限スクロールの追加読み込み用
components/   使い回す部品
lib/          データ取得・整形・設定値
public/       画像素材
```

## Vercel へのデプロイ

GitHub にプッシュしてVercelでインポートするだけです。環境変数 `MICROCMS_SERVICE_DOMAIN` と `MICROCMS_API_KEY` の登録を忘れずに。`NEXT_PUBLIC_` は付けないでください。付けるとAPIキーがブラウザから読めてしまいます。

microCMSの更新を即座に反映したい場合は、Webhookでデプロイを走らせる設定を追加してください。現状は `revalidate = 60` により、最大60秒で反映されます。
