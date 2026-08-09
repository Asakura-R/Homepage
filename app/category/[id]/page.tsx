import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleList } from "@/components/ArticleList";
import { Sidebar } from "@/components/Sidebar";
import { getArticles, getCategories } from "@/lib/microcms";
import { categoryVars } from "@/lib/format";

export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const category = (await getCategories()).find((c) => c.id === id);
  return { title: category ? category.name : "カテゴリ" };
}

export default async function CategoryPage({ params }: Props) {
  const { id } = await params;

  const category = (await getCategories()).find((c) => c.id === id);
  if (!category) notFound();

  const { contents, totalCount } = await getArticles({
    filters: `category[equals]${id}`,
  });

  return (
    <div className="body-grid">
      <Sidebar />
      <main className="main" style={categoryVars(category)}>
        <div className="section-head">
          <h1>{category.name}</h1>
          <span className="section-count">{totalCount}</span>
        </div>

        {totalCount === 0 ? (
          <p className="list-status" style={{ marginTop: 40 }}>
            このカテゴリの記事はまだありません
          </p>
        ) : (
          <ArticleList
            initialArticles={contents}
            totalCount={totalCount}
            categoryId={id}
          />
        )}
      </main>
    </div>
  );
}
