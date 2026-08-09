import { ArticleList } from "@/components/ArticleList";
import { Sidebar } from "@/components/Sidebar";
import { getArticles } from "@/lib/microcms";

export const revalidate = 60;

export default async function HomePage() {
  const { contents, totalCount } = await getArticles();

  return (
    <div className="body-grid">
      <Sidebar />
      <main className="main">
        <div className="section-head">
          <h1>雑　記</h1>
          <span className="section-count">{totalCount}</span>
        </div>
        <ArticleList initialArticles={contents} totalCount={totalCount} />
      </main>
    </div>
  );
}
