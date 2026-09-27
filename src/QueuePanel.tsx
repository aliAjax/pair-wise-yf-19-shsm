import { useMemo, useState } from "react";
import type { CollectingEvent, Database, Specimen } from "./types";
import { ID_STATUS_LABEL, SHELF_STATUS_LABEL } from "./types";
import { displayAltitude, displayLocality } from "./ops";

export type IdFilter = "all" | "unidentified" | "identified";
export type ShelfFilter = "all" | "unshelved" | "shelved" | "review";

interface Props {
  db: Database;
  onOpen: (specimenId: string) => void;
}

export default function QueuePanel({ db, onOpen }: Props) {
  const [idFilter, setIdFilter] = useState<IdFilter>("all");
  const [shelfFilter, setShelfFilter] = useState<ShelfFilter>("all");
  const [query, setQuery] = useState("");

  const eventById = useMemo(() => {
    const m = new Map<string, CollectingEvent>();
    db.events.forEach((e) => m.set(e.id, e));
    return m;
  }, [db.events]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.specimens
      .filter((s) => (idFilter === "all" ? true : s.idStatus === idFilter))
      .filter((s) => {
        if (shelfFilter === "all") return true;
        if (shelfFilter === "review") return s.review === "pending";
        return s.shelfStatus === shelfFilter;
      })
      .filter((s) => {
        if (!q) return true;
        const ev = eventById.get(s.eventId);
        return [s.collectionNo, s.species, ev?.code ?? "", ev?.locality ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [db.specimens, eventById, idFilter, shelfFilter, query]);

  const idChips: { key: IdFilter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "unidentified", label: "待鉴定" },
    { key: "identified", label: "已鉴定" },
  ];
  const shelfChips: { key: ShelfFilter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "unshelved", label: "未上柜" },
    { key: "shelved", label: "已上柜" },
    { key: "review", label: "待复核" },
  ];

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>队列</p>
          <h2>入库队列（{rows.length}）</h2>
        </div>
        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索采集号 / 物种 / 事件号 / 地点"
        />
      </div>

      <div className="filter-row">
        <span className="filter-name">鉴定状态</span>
        <div className="chips">
          {idChips.map((c) => (
            <button
              key={c.key}
              className={idFilter === c.key ? "chip active" : "chip"}
              onClick={() => setIdFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-row">
        <span className="filter-name">上柜状态</span>
        <div className="chips">
          {shelfChips.map((c) => (
            <button
              key={c.key}
              className={shelfFilter === c.key ? "chip active" : "chip"}
              onClick={() => setShelfFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="hint">没有符合条件的标本。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>采集号</th>
                <th>物种名称</th>
                <th>采集事件</th>
                <th>地点 / 海拔</th>
                <th>鉴定</th>
                <th>上柜</th>
                <th>柜位</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const ev = eventById.get(s.eventId);
                return (
                  <tr key={s.id} onClick={() => onOpen(s.id)}>
                    <td className="mono">{s.collectionNo}</td>
                    <td>{s.species}</td>
                    <td className="mono">{ev?.code ?? "—"}</td>
                    <td>
                      {displayLocality(s, ev)}
                      <span className="dim"> · {displayAltitude(s, ev)}</span>
                    </td>
                    <td>
                      <span className={`tag id-${s.idStatus}`}>{ID_STATUS_LABEL[s.idStatus]}</span>
                    </td>
                    <td>
                      <span className={`tag shelf-${s.shelfStatus}`}>
                        {SHELF_STATUS_LABEL[s.shelfStatus]}
                      </span>
                      {s.review === "pending" && <span className="tag review">待复核</span>}
                    </td>
                    <td className="mono">{s.shelfPosition ?? "—"}</td>
                    <td>
                      <button
                        className="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(s.id);
                        }}
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
