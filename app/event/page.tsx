import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { getEvents } from "@/lib/microcms";
import { eventDetailLine, formatEventDate } from "@/lib/format";

export const revalidate = 60;
export const metadata: Metadata = { title: "イベント情報" };

export default async function EventPage() {
  const { upcoming, past } = await getEvents();

  return (
    <div className="body-grid">
      <Sidebar />

      <main className="main">
        <div className="section-head">
          <h1>イベント情報</h1>
        </div>

        <div className="page-body">
          <h2>今後の予定</h2>

          {upcoming.length === 0 ? (
            <p style={{ margin: "0 0 34px", fontSize: 15, color: "var(--sub)" }}>
              現在お知らせできる予定はありません。決まり次第こちらに掲載します。
            </p>
          ) : (
            <div style={{ marginBottom: 34 }}>
              {upcoming.map((e) => {
                const d = formatEventDate(e.date);
                const detail = eventDetailLine(e);
                return (
                  <div className="event-row" key={e.id}>
                    <div>
                      <p className="day">{d.day}</p>
                      <p className="year">{d.year}</p>
                    </div>
                    <div>
                      <h3>{e.title}</h3>
                      {detail && <p className="detail">{detail}</p>}
                      {e.note && <p className="detail">{e.note}</p>}
                      {e.ticketUrl && (
                        <a
                          href={e.ticketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-link"
                          style={{ fontSize: 13 }}
                        >
                          予約する
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {past.length > 0 && (
            <>
              <h2>これまでのイベント</h2>
              <div>
                {past.map((e) => (
                  <div className="event-past" key={e.id}>
                    <span className="date">{formatEventDate(e.date).full}</span>
                    <span className="name">{e.title}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
