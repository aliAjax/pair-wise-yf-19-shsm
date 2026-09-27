import { useMemo, useState, type Dispatch } from "react";
import type { CollectEvent, LogEntry, Specimen } from "../types";
import {
  cabinetOccupant,
  collectionNoTaken,
  previewEventUpdate,
  type Action,
  type EventPatch,
  type State,
} from "../store";
import { Badge, fmtTime, specimenBadges } from "./Badge";

interface Props {
  state: State;
  dispatch: Dispatch<Action>;
  specimenId: string;
  onOpenSpecimen: (id: string) => void;
  onBack: () => void;
}

const eventFields: { key: keyof EventPatch; label: string; type?: string; wide?: boolean }[] = [
  { key: "date", label: "采集日期", type: "date" },
  { key: "elevation", label: "海拔（米）", type: "number" },
  { key: "locality", label: "采集地点", wide: true },
  { key: "habitat", label: "生境描述", wide: true },
  { key: "collectors", label: "采集人", wide: true },
];

export function SpecimenDetail({ state, dispatch, specimenId, onOpenSpecimen, onBack }: Props) {
  const s = state.specimens.find((x) => x.id === specimenId);
  const event = state.events.find((e) => e.id === s?.eventId);

  const siblings = useMemo(
    () => state.specimens.filter((x) => event && x.eventId === event.id && x.id !== s?.id),
    [state.specimens, event, s?.id]
  );
  const logs: LogEntry[] = useMemo(() => {
    if (!event) return [];
    return state.logs
      .filter((l) => l.specimenId === s!.id || (!l.specimenId && l.eventId === event.id))
      .sort((a, b) => b.at - a.at);
  }, [state.logs, event, s?.id]);

  // 标本自身字段编辑
  const [no, setNo] = useState(s?.collectionNo ?? "");
  const [species, setSpecies] = useState(s?.species ?? "");
  const [specErr, setSpecErr] = useState<string | null>(null);
  const [specOk, setSpecOk] = useState(false);

  // 柜位
  const [cabinet, setCabinet] = useState("");
  const [cabErr, setCabErr] = useState<string | null>(null);
  const occupant: Specimen | undefined = cabinet.trim()
    ? cabinetOccupant(state, cabinet, s?.id)
    : undefined;

  // 事件编辑
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EventPatch>({});
  const [evErr, setEvErr] = useState<string | null>(null);

  if (!s || !event) {
    return (
      <section className="panel">
        <button className="link-btn" onClick={onBack}>← 返回队列</button>
        <p className="empty">未找到该标本。</p>
      </section>
    );
  }

  const preview = editing ? previewEventUpdate(state, event.id, draft) : null;
  const hasDraftChange = preview ? preview.changed.length > 0 : false;

  function saveSpecimen() {
    setSpecOk(false);
    if (!no.trim()) {
      setSpecErr("采集号不能为空。");
      return;
    }
    if (collectionNoTaken(state, no, s!.id)) {
      setSpecErr(`采集号 ${no.trim()} 已被其他标本占用。`);
      return;
    }
    if (!species.trim()) {
      setSpecErr("物种名称不能为空。");
      return;
    }
    dispatch({
      type: "updateSpecimen",
      id: s!.id,
      patch: { collectionNo: no.trim(), species: species.trim() },
    });
    setSpecErr(null);
    setSpecOk(true);
  }

  function togglePressed() {
    setSpecOk(false);
    dispatch({ type: "updateSpecimen", id: s!.id, patch: { pressed: !s!.pressed } });
  }

  function toggleId() {
    setSpecOk(false);
    dispatch({
      type: "updateSpecimen",
      id: s!.id,
      patch: { idStatus: s!.idStatus === "confirmed" ? "pending" : "confirmed" },
    });
  }

  function tryShelve() {
    setCabErr(null);
    if (!cabinet.trim()) {
      setCabErr("请填写柜位，如 B-12-04。");
      return;
    }
    const occ = cabinetOccupant(state, cabinet, s!.id);
    if (occ) {
      // 柜位冲突：指出原先占用的采集号
      setCabErr(`柜位 ${cabinet.trim().toUpperCase()} 已被采集号 ${occ.collectionNo} 占用`);
      return;
    }
    dispatch({ type: "shelve", id: s!.id, cabinet });
    setCabinet("");
  }

  function startEditEvent() {
    setDraft({
      date: event!.date,
      locality: event!.locality,
      elevation: event!.elevation,
      habitat: event!.habitat,
      collectors: event!.collectors,
    });
    setEditing(true);
    setEvErr(null);
  }

  function applyEvent() {
    if (!hasDraftChange) {
      setEvErr("没有检测到改动。");
      return;
    }
    dispatch({ type: "updateEvent", eventId: event!.id, patch: draft });
    setEditing(false);
    setDraft({});
    setEvErr(null);
  }

  const drift = event.locality !== s.locality || event.elevation !== s.elevation;

  return (
    <div className="detail">
      <button className="link-btn" onClick={onBack}>← 返回队列</button>

      <section className="panel">
        <div className="detail-head">
          <div>
            <p className="mono">{s.collectionNo}</p>
            <h2>{s.species}</h2>
            <div className="badge-stack">{specimenBadges(s)}</div>
          </div>
          <div className="head-event">
            <span>所属采集事件</span>
            <b className="mono">{event.id}</b>
            <small>{event.date}</small>
          </div>
        </div>
      </section>

      {/* 待复核 */}
      {s.pendingReview && s.pendingReview.length > 0 && (
        <section className="panel review-box">
          <h3>⚠ 待复核：事件地点/海拔已改动（标本当时已上柜）</h3>
          {s.pendingReview.map((r) => (
            <div key={r.field} className="review-row">
              <div>
                <span>{r.label}</span>
                <p>
                  <del>{r.oldValue}</del>
                  <i>→</i>
                  <b>{r.newValue}</b>
                </p>
              </div>
            </div>
          ))}
          <div className="review-actions">
            <button
              className="primary"
              onClick={() => dispatch({ type: "resolveReview", id: s.id, adopt: true })}
            >
              采用新值
            </button>
            <button
              onClick={() => dispatch({ type: "resolveReview", id: s.id, adopt: false })}
            >
              保留原值（仅本份）
            </button>
          </div>
        </section>
      )}

      <div className="detail-grid">
        {/* 标本信息 */}
        <section className="panel">
          <h3>标本信息</h3>
          <div className="field-grid">
            <label>
              <span>采集号</span>
              <input value={no} onChange={(e) => { setNo(e.target.value); setSpecOk(false); }} />
            </label>
            <label>
              <span>物种名称</span>
              <input value={species} onChange={(e) => { setSpecies(e.target.value); setSpecOk(false); }} />
            </label>
          </div>
          <div className="toggle-row">
            <button className={s.pressed ? "" : "soft-on"} onClick={togglePressed}>
              {s.pressed ? "✓ 已压制（退回待压制）" : "标记为已压制"}
            </button>
            <button className={s.idStatus === "confirmed" ? "" : "soft-on"} onClick={toggleId}>
              {s.idStatus === "confirmed" ? "✓ 已鉴定（退回待鉴定）" : "标记鉴定完成"}
            </button>
          </div>
          {specErr && <div className="form-error">{specErr}</div>}
          {specOk && <div className="form-ok">已保存。</div>}
          <button className="primary save-btn" onClick={saveSpecimen}>保存标本信息</button>
        </section>

        {/* 柜位 */}
        <section className="panel">
          <h3>馆藏柜位</h3>
          {s.shelved ? (
            <div className="cab-current">
              <Badge variant="blue">{s.cabinet}</Badge>
              <button className="danger-ghost" onClick={() => dispatch({ type: "unshelve", id: s.id })}>
                下柜（释放柜位）
              </button>
            </div>
          ) : (
            <>
              <label className="cab-input">
                <span>分配柜位</span>
                <input
                  placeholder="如 B-12-04"
                  value={cabinet}
                  onChange={(e) => { setCabinet(e.target.value); setCabErr(null); }}
                />
              </label>
              {occupant && (
                <div className="conflict-hint">
                  柜位 <b>{cabinet.trim().toUpperCase()}</b> 原先由采集号
                  <b> {occupant.collectionNo} </b>（{occupant.species}）占用
                  <button className="link-btn" onClick={() => onOpenSpecimen(occupant.id)}>
                    查看该标本 →
                  </button>
                </div>
              )}
              {cabErr && <div className="form-error">{cabErr}</div>}
              <button className="primary save-btn" onClick={tryShelve}>确认上柜</button>
            </>
          )}
          <p className="hint">同一柜位只允许一份在架标本；冲突时需先下柜原标本。</p>
        </section>
      </div>

      {/* 采集事件 */}
      <section className="panel event-panel">
        <div className="heading">
          <div>
            <p>采集事件 {event.id}</p>
            <h3>事件信息（同场标本共用）</h3>
          </div>
          {!editing && (
            <button className="primary" onClick={startEditEvent}>修改事件</button>
          )}
        </div>

        {!editing ? (
          <EventReadView event={event} specimen={s} drift={drift} />
        ) : (
          <div>
            <div className="field-grid">
              {eventFields.map((f) => (
                <label key={f.key} className={f.wide ? "wide" : ""}>
                  <span>{f.label}</span>
                  <input
                    type={f.type ?? "text"}
                    value={String(draft[f.key] ?? "")}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>

            {/* 联动影响预览 */}
            {hasDraftChange && preview && (
              <div className="impact">
                <p>本次改动：{preview.changed.map((k) => eventFieldLabel(k)).join("、")}</p>
                {preview.changed.some((k) => k === "locality" || k === "elevation") ? (
                  <>
                    <p className="impact-cascade">
                      未上柜标本 {preview.cascade.length} 份将一起联动更新：
                      <b> {preview.cascade.map((x) => x.collectionNo).join("、") || "—"}</b>
                    </p>
                    <p className="impact-review">
                      已上柜标本 {preview.review.length} 份将标记待复核（保留原值，待逐份确认）：
                      <b> {preview.review.map((x) => x.collectionNo).join("、") || "—"}</b>
                    </p>
                  </>
                ) : (
                  <p className="impact-cascade">
                    生境 / 采集人改动将同步到同事件全部标本；采集日期仅记录在事件上。
                  </p>
                )}
              </div>
            )}
            {evErr && <div className="form-error">{evErr}</div>}
            <div className="form-actions">
              <button className="primary" onClick={applyEvent} disabled={!hasDraftChange}>
                确认应用
              </button>
              <button onClick={() => setEditing(false)}>取消</button>
            </div>
          </div>
        )}
      </section>

      {/* 同事件标本 */}
      <section className="panel">
        <h3>同事件标本（{event.id}，共 {siblings.length + 1} 份）</h3>
        <div className="sibling-list">
          <div className="sibling current">
            <b className="mono">{s.collectionNo}</b>
            <span>{s.species}</span>
            <div className="badge-stack">{specimenBadges(s)}</div>
            <em>本份</em>
          </div>
          {siblings.map((x) => (
            <button key={x.id} className="sibling" onClick={() => onOpenSpecimen(x.id)}>
              <b className="mono">{x.collectionNo}</b>
              <span>{x.species}</span>
              <div className="badge-stack">{specimenBadges(x)}</div>
              <em>查看 →</em>
            </button>
          ))}
          {siblings.length === 0 && <p className="hint">该事件目前只有本份标本。</p>}
        </div>
      </section>

      {/* 修改记录 */}
      <section className="panel">
        <h3>修改记录</h3>
        <p className="hint">包含本份标本的操作，以及采集事件 {event.id} 的事件级改动。</p>
        <ul className="log-list">
          {logs.map((l) => (
            <li key={l.id} className={`log log-${l.kind}`}>
              <time>{fmtTime(l.at)}</time>
              <span className="log-tag">{logKindLabel(l.kind)}</span>
              {l.specimenId && l.specimenId !== s.id && (
                <span className="mono log-other">（{l.collectionNo}）</span>
              )}
              <p>{l.detail}</p>
            </li>
          ))}
          {logs.length === 0 && <li className="empty">暂无记录。</li>}
        </ul>
      </section>
    </div>
  );
}

function EventReadView({
  event,
  specimen,
  drift,
}: {
  event: CollectEvent;
  specimen: Specimen;
  drift: boolean;
}) {
  const rows: { label: string; ev: string; mine: string }[] = [
    { label: "采集日期", ev: event.date, mine: "—（仅事件）" },
    { label: "采集地点", ev: event.locality, mine: specimen.locality },
    { label: "海拔", ev: `${event.elevation} m`, mine: `${specimen.elevation} m` },
    { label: "生境", ev: event.habitat || "—", mine: specimen.habitat || "—" },
    { label: "采集人", ev: event.collectors, mine: specimen.collectors },
  ];
  return (
    <>
      <table className="event-table">
        <thead>
          <tr>
            <th>字段</th>
            <th>事件现值</th>
            <th>本份登记值</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const diff = (r.label === "采集地点" || r.label === "海拔") && r.ev !== r.mine;
            return (
              <tr key={r.label} className={diff ? "cell-drift" : ""}>
                <td>{r.label}</td>
                <td>{r.ev}</td>
                <td>
                  {r.mine}
                  {diff && <span className="drift">不一致</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {drift && !specimen.pendingReview?.length && (
        <p className="hint">
          本份地点/海拔与事件现值不一致（可能为复核时选择了“保留原值”）。可在上方事件修改中再做调整。
        </p>
      )}
    </>
  );
}

function eventFieldLabel(k: string): string {
  return (
    { date: "采集日期", locality: "采集地点", elevation: "海拔", habitat: "生境", collectors: "采集人" } as Record<string, string>
  )[k] ?? k;
}

function logKindLabel(kind: string): string {
  return (
    {
      "event-create": "新建事件",
      "event-update": "事件修改",
      register: "登记",
      "specimen-update": "编辑",
      shelve: "上柜",
      unshelve: "下柜",
      cascade: "联动更新",
      "review-flag": "标记复核",
      "review-resolve": "复核处理",
    } as Record<string, string>
  )[kind] ?? kind;
}
