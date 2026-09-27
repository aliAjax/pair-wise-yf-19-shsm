import { useMemo, useState } from "react";
import type { CollectingEvent, Database } from "./types";
import type { EventPatch } from "./ops";

interface Props {
  db: Database;
  onUpdateEvent: (eventId: string, patch: EventPatch) => void;
  onOpenSpecimen: (specimenId: string) => void;
}

export default function EventsPanel({ db, onUpdateEvent, onOpenSpecimen }: Props) {
  const [editing, setEditing] = useState<CollectingEvent | null>(null);
  const [patch, setPatch] = useState<EventPatch>({ locality: "", altitude: "", habitat: "", collectors: "" });

  const countByEvent = useMemo(() => {
    const m = new Map<string, { total: number; pending: number }>();
    for (const s of db.specimens) {
      const cur = m.get(s.eventId) ?? { total: 0, pending: 0 };
      cur.total += 1;
      if (s.review === "pending") cur.pending += 1;
      m.set(s.eventId, cur);
    }
    return m;
  }, [db.specimens]);

  const openEdit = (ev: CollectingEvent) => {
    setEditing(ev);
    setPatch({
      locality: ev.locality,
      altitude: ev.altitude,
      habitat: ev.habitat,
      collectors: ev.collectors,
    });
  };

  const save = () => {
    if (!editing) return;
    if (!patch.locality.trim()) return;
    onUpdateEvent(editing.id, patch);
    setEditing(null);
  };

  const geoWillChange =
    editing &&
    (patch.locality.trim() !== editing.locality || patch.altitude.trim() !== editing.altitude);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>事件</p>
          <h2>采集事件（{db.events.length}）</h2>
        </div>
      </div>

      <div className="event-list">
        {db.events.map((ev) => {
          const stat = countByEvent.get(ev.id) ?? { total: 0, pending: 0 };
          return (
            <article key={ev.id} className="event-item">
              <div className="event-item-head">
                <b className="mono">{ev.code}</b>
                <span className="dim">{ev.date}</span>
                {stat.pending > 0 && <span className="tag review">{stat.pending} 份待复核</span>}
              </div>
              <p className="event-loc">
                {ev.locality}
                <span className="dim"> · {ev.altitude || "海拔未录"}</span>
              </p>
              <p className="dim">
                {ev.habitat || "生境未录"} · 采集人：{ev.collectors || "—"} · {stat.total} 份标本
              </p>
              <div className="actions">
                <button onClick={() => openEdit(ev)}>修改事件信息</button>
                {db.specimens
                  .filter((s) => s.eventId === ev.id)
                  .slice(0, 4)
                  .map((s) => (
                    <button key={s.id} className="link" onClick={() => onOpenSpecimen(s.id)}>
                      {s.collectionNo}
                    </button>
                  ))}
              </div>
            </article>
          );
        })}
      </div>

      {editing && (
        <div className="modal-mask" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>修改采集事件 {editing.code}</h3>
            <div className="field-grid">
              <label className="span2">
                <span>采集地点</span>
                <input
                  value={patch.locality}
                  onChange={(e) => setPatch({ ...patch, locality: e.target.value })}
                />
              </label>
              <label>
                <span>海拔</span>
                <input
                  value={patch.altitude}
                  onChange={(e) => setPatch({ ...patch, altitude: e.target.value })}
                />
              </label>
              <label>
                <span>采集人</span>
                <input
                  value={patch.collectors}
                  onChange={(e) => setPatch({ ...patch, collectors: e.target.value })}
                />
              </label>
              <label className="span2">
                <span>生境描述</span>
                <input
                  value={patch.habitat}
                  onChange={(e) => setPatch({ ...patch, habitat: e.target.value })}
                />
              </label>
            </div>
            {geoWillChange && (
              <p className="warn-text">
                地点或海拔已改动：保存后本事件下未上柜标本将同步更新，已上柜标本标记为待复核。
              </p>
            )}
            <div className="actions">
              <button className="primary" onClick={save} disabled={!patch.locality.trim()}>
                保存修改
              </button>
              <button onClick={() => setEditing(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
