import { useMemo, useState } from "react";
import type { CollectEvent, Specimen } from "../types";
import { specimenBadges } from "./Badge";

interface Filters {
  idStatus: "all" | "pending" | "confirmed";
  shelf: "all" | "unshelved" | "shelved" | "review";
  eventId: "all" | string;
  keyword: string;
}

interface Props {
  specimens: Specimen[];
  events: CollectEvent[];
  counts: {
    all: number;
    pending: number;
    confirmed: number;
    shelved: number;
    unshelved: number;
    review: number;
  };
  onOpen: (id: string) => void;
}

export function QueueView({ specimens, events, counts, onOpen }: Props) {
  const [filters, setFilters] = useState<Filters>({
    idStatus: "all",
    shelf: "all",
    eventId: "all",
    keyword: "",
  });

  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const rows = useMemo(() => {
    const kw = filters.keyword.trim().toUpperCase();
    return specimens
      .filter((s) => {
        if (filters.idStatus !== "all" && s.idStatus !== filters.idStatus) return false;
        if (filters.shelf === "shelved" && !s.shelved) return false;
        if (filters.shelf === "unshelved" && s.shelved) return false;
        if (filters.shelf === "review" && (!s.pendingReview || s.pendingReview.length === 0))
          return false;
        if (filters.eventId !== "all" && s.eventId !== filters.eventId) return false;
        if (kw) {
          const hay = [
            s.collectionNo,
            s.species,
            s.locality,
            s.cabinet ?? "",
            s.eventId,
          ]
            .join(" ")
            .toUpperCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [specimens, filters]);

  const idBtn = (key: Filters["idStatus"], label: string, n: number) => (
    <button
      key={key}
      className={filters.idStatus === key ? "fbtn fbtn-on" : "fbtn"}
      onClick={() => setFilters((f) => ({ ...f, idStatus: key }))}
    >
      {label} <em>{n}</em>
    </button>
  );
  const shelfBtn = (key: Filters["shelf"], label: string, n: number) => (
    <button
      key={key}
      className={filters.shelf === key ? "fbtn fbtn-on" : "fbtn"}
      onClick={() => setFilters((f) => ({ ...f, shelf: key }))}
    >
      {label} <em>{n}</em>
    </button>
  );

  return (
    <section className="panel queue">
      <div className="heading">
        <div>
          <p>入库队列</p>
          <h2>标本队列 <small>（{rows.length} / {specimens.length}）</small></h2>
        </div>
      </div>

      <div className="filter-block">
        <span className="filter-label">鉴定状态</span>
        <div className="chips">
          {idBtn("all", "全部", counts.all)}
          {idBtn("pending", "待鉴定", counts.pending)}
          {idBtn("confirmed", "已鉴定", counts.confirmed)}
        </div>
      </div>
      <div className="filter-block">
        <span className="filter-label">上柜状态</span>
        <div className="chips">
          {shelfBtn("all", "全部", counts.all)}
          {shelfBtn("unshelved", "未上柜", counts.unshelved)}
          {shelfBtn("shelved", "已上柜", counts.shelved)}
          {shelfBtn("review", "待复核", counts.review)}
        </div>
      </div>
      <div className="filter-block filter-row">
        <label className="event-select">
          <span>采集事件</span>
          <select
            value={filters.eventId}
            onChange={(e) => setFilters((f) => ({ ...f, eventId: e.target.value }))}
          >
            <option value="all">全部事件</option>
            {events
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id} · {e.locality}
                </option>
              ))}
          </select>
        </label>
        <label className="kw">
          <span>关键词</span>
          <input
            placeholder="搜索采集号 / 物种 / 地点 / 柜位"
            value={filters.keyword}
            onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
          />
        </label>
      </div>

      <div className="table-wrap">
        <table className="queue-table">
          <thead>
            <tr>
              <th>采集号</th>
              <th>物种</th>
              <th>采集事件</th>
              <th>地点 / 海拔</th>
              <th>状态</th>
              <th>柜位</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const ev = eventMap.get(s.eventId);
              const drift = ev && (ev.locality !== s.locality || ev.elevation !== s.elevation);
              return (
                <tr
                  key={s.id}
                  onClick={() => onOpen(s.id)}
                  className={s.pendingReview?.length ? "row-review" : ""}
                >
                  <td className="mono">
                    <b>{s.collectionNo}</b>
                    {drift && !s.pendingReview && (
                      <span className="drift" title="地点/海拔与事件现值不一致">地点已异</span>
                    )}
                  </td>
                  <td>{s.species}</td>
                  <td className="mono">
                    {s.eventId}
                    {ev && <small>{ev.date}</small>}
                  </td>
                  <td>
                    {s.locality}
                    <small>{s.elevation} m</small>
                  </td>
                  <td>
                    <div className="badge-stack">{specimenBadges(s)}</div>
                  </td>
                  <td className="mono">{s.cabinet ?? "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  没有符合当前筛选的标本。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
