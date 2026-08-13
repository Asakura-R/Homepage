# 飲み物堂

エッセイ中心の個人サイト。Next.js（App Router）+ microCMS + Vercel。

## はじめかた

```bash
npm install
cp .env.example .env.local   # 中身を埋める
npm run dev
```

## 環境変数

```
MICROCMS_SERVICE_DOMAIN=xxxxxxxx
MICROCMS_API_KEY=xxxxxxxxxxxxxxxx
```

Vercel にも同じ2つを登録します。`NEXT_PUBLIC_` は付けないでください。付けるとAPIキーがブラウザから読めてしまいます。

---

## microCMS 側で必要な作業

既存のスキーマに合わせてありますが、**2点だけ設定が必要**です。

### 1. articles にカテゴリを追加（必須）

現在 `articles` にカテゴリのフィールドがありません。記事ごとに色を出し分ける仕組みがこれに依存しているので、追加してください。

| フィールドID | 種類 | 参照先 |
|---|---|---|
| `category` | コンテンツ参照 | categories |

複数選択はオフ（単一参照）にしてください。

### 2. categories の color に選択肢を登録（必須）

`color`（セレクトフィールド）の選択肢に、次の7つを**この文字列のまま**登録します。日本語や色コードではありません。

```
green
olive
amber
orange
red
magenta
blue
```

実際の色は `lib/format.ts` の `PALETTE` が持っています。

| 値 | 色 | 系統 |
|---|---|---|
| `green` | `#2C6A1E` | 緑 |
| `olive` | `#6E6008` | 黄土 |
| `amber` | `#96650A` | 山吹 |
| `orange` | `#A34A0C` | 橙 |
| `red` | `#A82420` | 赤 |
| `magenta` | `#912A62` | 臙脂 |
| `blue` | `#2A4C96` | 青 |

ティール `#04756B` はリンクやボタンなどの機能色なので、カテゴリには入れていません。

カテゴリが4つなら `green` / `amber` / `red` / `blue` のように離して選ぶと見分けやすくなります。

---

## 使っているフィールド

### articles

| フィールドID | 使い道 |
|---|---|
| `title` | タイトル |
| `content` | 本文。`.prose` のスタイルが当たる |
| `excerpt` | 一覧の抜粋。**空なら本文の冒頭120字を自動で使う**ので、書かなくてよい |
| `publishedAt` | 並び順と日付表示。空なら作成日で代用 |
| `limited` | ONにすると一覧に出ず、検索避けも付く。URLを知っている人だけ読める |
| `category` | ← 要追加 |

### categories

| フィールドID | 使い道 |
|---|---|
| `name` | 表示名 |
| `slug` | URL。`/category/nichijo` のようになる |
| `color` | ← 選択肢の登録が必要 |

### lives（イベント情報）

| フィールドID | 使い道 |
|---|---|
| `title` | タイトル |
| `date` | 並び順と、今後／過去の振り分け |
| `venue` `openTime` `startTime` | 「会場名／開場 19:00　開演 19:30」の形にまとめて表示 |
| `ticketUrl` | 「予約する」リンク。空なら出ない |
| `note` | 備考 |
| `isPublished` | **ONのものだけ表示される。** OFFのままだと出ないので注意 |

### settings

サイト名・紹介・SNS・画像はここから読みます。コードを触らずに変更できます。

| フィールドID | 使い道 |
|---|---|
| `siteName` | ヘッダー、フッター、ページタイトル |
| `siteDescription` | メタdescription、ABOUTページ |
| `artistName` `artistNameEn` | サイドバーとABOUT |
| `artistLabel` | サイドバーの一行紹介 |
| `twitterUrl` `instagramUrl` | SNSリンク。空欄なら表示されない |
| `ogImage` | SNS共有画像。未設定なら `/public/ogp.png` |
| `profileImage` | 宣材写真。未設定なら `/public/avatar.png` |

### profile

ABOUTページの中身です。

| フィールドID | 使い道 |
|---|---|
| `catchphrase` | 名前の横に、ティールの罫を添えて大きめに表示 |
| `introduction` | 自己紹介文。リッチエディタなので見出しや強調もそのまま反映される |
| `biograpy` | 経歴。繰り返しフィールド。年と内容の2列で並ぶ |

`biograpy` の中のカスタムフィールドは、フィールドIDが `year` / `event` のような一般的な名前であれば自動で認識します。認識できない場合は、その項目の文字列を上から順に「年」「内容」として扱います。意図通りに出ないときは `lib/format.ts` の `YEAR_KEYS` と `BODY_KEYS` に実際のフィールドIDを足してください。

---

## コード側で編集する場所

`lib/site.ts` の3つだけです。

- `url` — 公開URL。OGP画像は絶対URLでないとSNSに反映されないので必須
- `formspree` — お問い合わせフォームの送信先
- `nav` — ヘッダーのメニュー

## 画像ファイル

`public/` に一式入っています。

| ファイル | 内容 |
|---|---|
| `favicon.svg` | 既定はカクテル |
| `favicons/favicon-cocktail.svg` | カクテル（16pxで最も判別しやすい） |
| `favicons/favicon-coffee.svg` | コーヒー |
| `favicons/favicon-can.svg` | 空き缶 |
| `apple-touch-icon.png` | 180×180 |
| `ogp.png` | 1200×630。settings に未設定のときの代替 |
| `avatar.png` | 仮画像。settings に宣材写真を入れれば不要 |

faviconを差し替えるときは `public/favicons/` から好きなものを `public/favicon.svg` に上書きし、[RealFaviconGenerator](https://realfavicongenerator.net/) で `apple-touch-icon.png` を作り直してください。

## 下書きプレビュー（任意）

microCMS の画面プレビュー設定に登録すると、公開前の記事を確認できます。

```
https://サイトURL/miscellany/{CONTENT_ID}?draftKey={DRAFT_KEY}
```

---

## 設計メモ

**色は役割で分けています。** ティール `#04756B` はリンク・ボタン・導線といった「機能」だけに使い、記事の分類には7色のカテゴリ色を使います。リンクの色が記事ごとに変わらないので読者が迷いません。

**無限スクロールは2回で止まります。** そのあとは「もっと読む」ボタンに切り替わります。無制限に自動読み込みすると、下部のプロフィールやフッターに永久に到達できなくなるためです。回数は `components/ArticleList.tsx` の `AUTO_LOAD_LIMIT` で変えられます。

**本文の見た目は `.prose` にまとまっています。** microCMS が吐き出す `<h2>` や `<blockquote>` にスタイルを当てているので、記事を書くときに装飾を意識する必要はありません。

**表とリンク羅列だけ、CSSでは届かないので加工しています。** `lib/format.ts` の `enhanceBody` が、表を横スクロール用の枠で包み、リンクだけの段落に `link-row` クラスを付けます。強盗記事の「Amazon Yahooショッピング ヨドバシ」のような並びが対象です。

**取得系はすべて try で囲んであります。** カテゴリやイベントが0件でもビルドは通り、その部分だけ表示されません。失敗時は `console.error` にログが出るので、Vercelのログで原因を追えます。

## ディレクトリ

```
app/          ページ。フォルダ構成がそのままURLになる
  api/        無限スクロールの追加読み込み用
components/   使い回す部品
lib/          データ取得・整形・設定値
public/       画像素材
```

## Vercel の設定

Framework Preset は **Next.js**。以前 Astro だった場合は変更が必要です。Output Directory の Override は外してください（Next.js の出力先は `.next` です）。
