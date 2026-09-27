import { useMemo, useState, type Dispatch } from "react";
import { collectionNoTaken, type Action, type State } from "../store";

interface Props {
  state: State;
  dispatch: Dispatch<Action>;
  onCreated: (specimenId: string) => void;
}

type Mode = "existing" | "new";

const emptyNew = { date: "", locality: "", elevation: "", habitat: "", collectors: "" };

export function RegisterForm({ state, dispatch, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>("existing");
  const [eventId, setEventId] = useState<string>(state.events[0]?.id ?? "");
  const [ev, setEv] = useState(emptyNew);
  const [collectionNo, setCollectionNo] = useState("");
  const [species, setSpecies] = useState("");
  const [pressed, setPressed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => state.events.find((e) => e.id === eventId),
    [state.events, eventId]
  );

  function reset() {
    setCollectionNo("");
    setSpecies("");
    setPressed(false);
    setError(null);
  }

  function submit() {
    // 1) 先定采集事件
    let eventData: typeof emptyNew | null = null;
    let targetEventId: string | null = eventId;
    let newEventId: string | null = null;
    if (mode === "new") {
      if (!ev.date || !ev.locality.trim() || !ev.elevation.trim() || !ev.collectors.trim()) {
        setError("请填完新事件的日期、地点、海拔、采集人（生境可留空）。");
        return;
      }
      newEventId = `EV-${String(state.eventSeq + 1).padStart(4, "0")}`;
      eventData = ev;
      targetEventId = newEventId;
    } else if (!selectedEvent) {
      setError("请先选择一个采集事件。");
      return;
    }
    // 2) 再录标本字段
    if (!collectionNo.trim()) {
      setError("请填写采集号。");
      return;
    }
    if (collectionNoTaken(state, collectionNo)) {
      setError(`采集号 ${collectionNo.trim()} 已存在，采集号必须唯一。`);
      return;
    }
    if (!species.trim()) {
      setError("请填写物种名称。");
      return;
    }
    dispatch({
      type: "register",
      event: eventData,
      eventId: targetEventId,
      specimen: {
        eventId: targetEventId ?? "",
        collectionNo: collectionNo.trim(),
        species: species.trim(),
        pressed,
      },
    });
    // 新事件登记后切回“选已有事件”，方便连续登记同场标本
    if (mode === "new" && newEventId) {
      setMode("existing");
      setEv(emptyNew);
      setEventId(newEventId);
    }
    reset();
    onCreated("");
  }

  return (
    <section className="panel register">
      <div className="heading">
        <div>
          <p>第一步 · 选采集事件</p>
          <h2>登记标本</h2>
        </div>
        <div className="seg">
          <button
            type="button"
            className={mode === "existing" ? "seg-on" : ""}
            onClick={() => setMode("existing")}
          >
            选择已有事件
          </button>
          <button
            type="button"
            className={mode === "new" ? "seg-on" : ""}
            onClick={() => setMode("new")}
          >
            新建采集事件
          </button>
        </div>
      </div>

      {mode === "existing" ? (
        <div className="event-pick">
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {state.events.length === 0 && <option value="">（暂无事件，请新建）</option>}
            {state.events
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id} · {e.date} · {e.locality} · {e.elevation}m · {e.collectors}
                </option>
              ))}
          </select>
          {selectedEvent && (
            <div className="event-card-mini">
              <div><span>事件号</span><b>{selectedEvent.id}</b></div>
              <div><span>地点</span><b>{selectedEvent.locality}</b></div>
              <div><span>海拔</span><b>{selectedEvent.elevation} m</b></div>
              <div><span>生境</span><b>{selectedEvent.habitat || "—"}</b></div>
              <div><span>采集人</span><b>{selectedEvent.collectors}</b></div>
              <div>
                <span>同事件标本</span>
                <b>
                  {state.specimens.filter((s) => s.eventId === selectedEvent.id).length} 份
                </b>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="field-grid">
          <label>
            <span>采集日期 *</span>
            <input type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} />
          </label>
          <label>
            <span>海拔（米）*</span>
            <input
              type="number"
              min="0"
              placeholder="如 1420"
              value={ev.elevation}
              onChange={(e) => setEv({ ...ev, elevation: e.target.value })}
            />
          </label>
          <label className="wide">
            <span>采集地点 *</span>
            <input
              placeholder="如 云南省大理市苍山玉带云游路"
              value={ev.locality}
              onChange={(e) => setEv({ ...ev, locality: e.target.value })}
            />
          </label>
          <label className="wide">
            <span>生境描述</span>
            <input
              placeholder="如 常绿阔叶林缘，半阴坡"
              value={ev.habitat}
              onChange={(e) => setEv({ ...ev, habitat: e.target.value })}
            />
          </label>
          <label className="wide">
            <span>采集人 *</span>
            <input
              placeholder="多人用顿号分隔，如 王岚、李其"
              value={ev.collectors}
              onChange={(e) => setEv({ ...ev, collectors: e.target.value })}
            />
          </label>
        </div>
      )}

      <div className="step-divider">
        <p>第二步 · 录标本信息</p>
      </div>
      <div className="field-grid">
        <label>
          <span>采集号 *（唯一）</span>
          <input
            placeholder="如 HX-240615-01"
            value={collectionNo}
            onChange={(e) => setCollectionNo(e.target.value)}
          />
        </label>
        <label>
          <span>物种名称 *</span>
          <input
            placeholder="如 槭属待定 Acer sp."
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={pressed}
            onChange={(e) => setPressed(e.target.checked)}
          />
          <span>已完成压制</span>
        </label>
      </div>

      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="primary" onClick={submit}>
          登记入库
        </button>
      </div>
      <p className="hint">
        地点、海拔、生境、采集人取自采集事件；后续在事件上修改时按规则联动。新登记标本默认“待鉴定、未上柜”。
      </p>
    </section>
  );
}
