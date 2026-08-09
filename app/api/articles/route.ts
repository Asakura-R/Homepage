import { NextResponse } from "next/server";
import { getArticles } from "@/lib/microcms";

/**
 * 無限スクロールの続きを返す。
 * microCMS の API キーはサーバー側に置いたままにしたいので、
 * ブラウザから直接叩かずここを経由させる。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? 0);
  const category = searchParams.get("category");

  if (!Number.isFinite(offset) || offset < 0) {
    return NextResponse.json({ message: "offset が不正です" }, { status: 400 });
  }

  try {
    const data = await getArticles({
      offset,
      ...(category ? { filters: `category[equals]${category}` } : {}),
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ message: "記事を取得できませんでした" }, { status: 500 });
  }
}
