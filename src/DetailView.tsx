import { useMemo, useState } from "react";
import type { Database } from "./types";
import { ID_STATUS_LABEL, SHELF_STATUS_LABEL } from "./types";
import { displayAltitude, displayLocality, findShelfConflict } from "./ops";

interface Props {
  db: Database;
  specimenId: string;
  onBack: () => void;
  onOpen: (specimenId: string) => void;
  onShelve: (specimenId: string, position: string) => string | undefined;
  onUnshelve: (specimenId: string) => void;
  onResolveReview: (specimenId: string, action: "adopt" | "keep") => void;
  onUpdateSpecimen: (
    specimenId: string,
    patch: { species?: string; idStatus?: "unidentified" | "identified"; idRemark?: string }
  ) => void;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function DetailView({
  db,
  specimenId,
  onBack,
  onOpen,
  onShelve,
  onUnshelve,
  onResolveReview,
  onUpdateSpecimen,
}: Props) {
  const sp = db.specimens.find((s) => s.id === specimenId);
  const ev = sp ? db.events.find((e) => e.id === sp.eventId) : undefined;

  const [position, setPosition] = useState("");
  const [shelfError, setShelfError] = useState<string | undefined>();
  const [editingId, setEditingId] = useState(false);
  const [species, setSpecies] = useState(sp?.species ?? "");
  const [idRemark, setIdRemark] = useState(sp?.idRemark ?? "");

  const siblings = useMemo(
    () => (sp ? db.specimens.filter((s) => s.eventId === sp.eventId) : []),
    [db.specimens, sp]
  );

  const timeline = useMemo(() => {
    if (!sp) return [];
    return db.logs
      .filter((l) => l.eventId === sp.eventId)
      .sort((a, b) => b.at - a.at);
  }, [db.logs, sp]);

  if (!sp || !ev) {
    return (
      <section className="panel">
        <p className="hint">标本不存在。</p>
        <button onClick={onBack}>返回队列</button>
      </section>
    );
  }

  const holder = position.trim() ? findShelfConflict(db, position, sp.id) : undefined;

  const doShelve = () => {
    const err = onShelve(sp.id, position);
    setShelfError(err);
    if (!err) setPosition("");
  };

  const saveId = () => {
    onUpdateSpecimen(sp.id, { species, idRemark });
    setEditingId(false);
  };

  return (
    <div className="detail">
      <div className="detail-head">
        <button onClick={onBack}>← 返回队列</button>
        <h2>
          <span className="mono">{sp.collectionNo}</span> · {sp.species}
        </h2>
        <div className="chips">
          <span className={`tag id-${sp.idStatus}`}>{ID_STATUS_LABEL[sp.idStatus]}</span>
          <span className={`tag shelf-${sp.shelfStatus}`}>{SHELF_STATUS_LABEL[sp.shelfStatus]}</span>
          {sp.review === "pending" && <span className="tag review">待复核</span>}
          {sp.review === "synced" && <span className="tag ok">已复核·采用新值</span>}
          {sp.review === "kept" && <span className="tag ok">已复核·保留原值</span>}
        </div>
      </div>

      {sp.review === "pending" && (
        <section className="panel review-banner">
          <h3>事件地点 / 海拔已变更，待复核</h3>
          <div className="review-compare">
            <div>
              <small>上柜时原值</small>
              <p>
                {sp.localitySnapshot || "—"} · {sp.altitudeSnapshot || "—"}
              </p>
            </div>
            <div>
              <small>事件当前值</small>
              <p>
                {ev.locality} · {ev.altitude || "—"}
              </p>
            </div>
          </div>
          <div className="actions">
            <button className="primary" onClick={() => onResolveReview(sp.id, "adopt")}>
              采用事件新值
            </button>
            <button onClick={() => onResolveReview(sp.id, "keep")}>保留上柜时原值</button>
          </div>
        </section>
      )}

      <div className="detail-grid">
        <section className="panel">
          <div className="heading">
            <div>
              <p>标本</p>
              <h3>鉴定信息</h3>
            </div>
            {!editingId && (
              <button
                onClick={() => {
                  setSpecies(sp.species);
                  setIdRemark(sp.idRemark ?? "");
                  setEditingId(true);
                }}
              >
                修改
              </button>
            )}
          </div>
          {editingId ? (
            <div className="field-grid">
              <label>
                <span>物种名称</span>
                <input value={species} onChange={(e) => setSpecies(e.target.value)} />
              </label>
              <label>
                <span>鉴定备注（学名 / 鉴定人）</span>
                <input value={idRemark} onChange={(e) => setIdRemark(e.target.value)} />
              </label>
              <div className="actions span2">
                <button className="primary" onClick={saveId}>
                  保存
                </button>
                <button onClick={() => setEditingId(false)}>取消</button>
              </div>
            </div>
          ) : (
            <dl className="kv">
              <div>
                <dt>物种名称</dt>
                <dd>{sp.species}</dd>
              </div>
              <div>
                <dt>鉴定状态</dt>
                <dd>
                  {ID_STATUS_LABEL[sp.idStatus]}
                  <button
                    className="link"
                    onClick={() =>
                      onUpdateSpecimen(sp.id, {
                        idStatus: sp.idStatus === "identified" ? "unidentified" : "identified",
                      })
                    }
                  >
                    标记为{sp.idStatus === "identified" ? "待鉴定" : "已鉴定"}
                  </button>
                </dd>
              </div>
              <div>
                <dt>鉴定备注</dt>
                <dd>{sp.idRemark || "—"}</dd>
              </div>
              <div>
                <dt>采集地点</dt>
                <dd>{displayLocality(sp, ev)}</dd>
              </div>
              <div>
                <dt>海拔</dt>
                <dd>{displayAltitude(sp, ev)}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p>馆藏</p>
              <h3>柜位</h3>
            </div>
          </div>
          {sp.shelfStatus === "shelved" ? (
            <>
              <p className="shelf-now">
                当前柜位：<b className="mono">{sp.shelfPosition}</b>
                {sp.shelvedAt && <span className="dim">（{fmtTime(sp.shelvedAt)} 上柜）</span>}
              </p>
              <div className="actions">
                <button onClick={() => onUnshelve(sp.id)}>撤下柜位</button>
              </div>
            </>
          ) : (
            <>
              <div className="shelf-form">
                <input
                  value={position}
                  onChange={(e) => {
                    setPosition(e.target.value);
                    setShelfError(undefined);
                  }}
                  placeholder="输入柜位，如 B-12-04"
                />
                <button className="primary" onClick={doShelve}>
                  上柜
                </button>
              </div>
              {holder && (
                <p className="error-text">
                  柜位 {position.trim().toUpperCase()} 已被采集号{" "}
                  <button className="link" onClick={() => onOpen(holder.id)}>
                    {holder.collectionNo}
                  </button>{" "}
                  占用，请更换柜位。
                </p>
              )}
              {!holder && shelfError && <p className="error-text">{shelfError}</p>}
            </>
          )}
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p>事件</p>
              <h3>
                采集事件 <span className="mono">{ev.code}</span>
              </h3>
            </div>
          </div>
          <dl className="kv">
            <div>
              <dt>采集日期</dt>
              <dd>{ev.date}</dd>
            </div>
            <div>
              <dt>采集地点</dt>
              <dd>{ev.locality}</dd>
            </div>
            <div>
              <dt>海拔</dt>
              <dd>{ev.altitude || "—"}</dd>
            </div>
            <div>
              <dt>生境</dt>
              <dd>{ev.habitat || "—"}</dd>
            </div>
            <div>
              <dt>采集人</dt>
              <dd>{ev.collectors || "—"}</dd>
            </div>
          </dl>
          <div className="step-label">同事件标本（{siblings.length}）</div>
          <div className="sibling-list">
            {siblings.map((s) => (
              <button
                key={s.id}
                className={s.id === sp.id ? "sibling current" : "sibling"}
                onClick={() => onOpen(s.id)}
              >
                <span className="mono">{s.collectionNo}</span>
                <span>{s.species}</span>
                <span className={`tag shelf-${s.shelfStatus}`}>{SHELF_STATUS_LABEL[s.shelfStatus]}</span>
                {s.review === "pending" && <span className="tag review">待复核</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p>留痕</p>
              <h3>修改记录</h3>
            </div>
          </div>
          {timeline.length === 0 ? (
            <p className="hint">暂无记录。</p>
          ) : (
            <ul className="timeline">
              {timeline.map((l) => (
                <li key={l.id} className={l.refId === sp.id ? "mine" : ""}>
                  <time>{fmtTime(l.at)}</time>
                  <span>{l.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
