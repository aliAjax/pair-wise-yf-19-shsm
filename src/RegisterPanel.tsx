import { useMemo, useState } from "react";
import type { CollectingEvent } from "./types";
import { nextEventCode } from "./ops";

interface Props {
  events: CollectingEvent[];
  onSubmit: (
    eventId: string | null,
    newEvent: {
      date: string;
      locality: string;
      altitude: string;
      habitat: string;
      collectors: string;
    } | null,
    input: { collectionNo: string; species: string }
  ) => string | undefined; // 返回错误信息，undefined 表示成功
}

function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function RegisterPanel({ events, onSubmit }: Props) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [eventId, setEventId] = useState<string>(events[0]?.id ?? "");
  const [date, setDate] = useState(today());
  const [locality, setLocality] = useState("");
  const [altitude, setAltitude] = useState("");
  const [habitat, setHabitat] = useState("");
  const [collectors, setCollectors] = useState("");
  const [collectionNo, setCollectionNo] = useState("");
  const [species, setSpecies] = useState("");
  const [error, setError] = useState<string | undefined>();

  const selected = events.find((e) => e.id === eventId);
  const previewCode = useMemo(
    () => nextEventCode({ version: 1, events, specimens: [], logs: [] }, date),
    [events, date]
  );

  const submit = () => {
    const err = onSubmit(
      mode === "existing" ? eventId || null : null,
      mode === "new" ? { date, locality, altitude, habitat, collectors } : null,
      { collectionNo, species }
    );
    setError(err);
    if (!err) {
      setCollectionNo("");
      setSpecies("");
      if (mode === "new") {
        setLocality("");
        setAltitude("");
        setHabitat("");
        setCollectors("");
      }
    }
  };

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>登记</p>
          <h2>新增标本</h2>
        </div>
      </div>

      <div className="step-label">第 1 步 · 选择采集事件</div>
      <div className="mode-switch">
        <button
          className={mode === "existing" ? "chip active" : "chip"}
          onClick={() => setMode("existing")}
        >
          选择已有事件
        </button>
        <button
          className={mode === "new" ? "chip active" : "chip"}
          onClick={() => setMode("new")}
        >
          新建采集事件
        </button>
      </div>

      {mode === "existing" ? (
        <>
          {events.length === 0 ? (
            <p className="hint">暂无采集事件，请切换到「新建采集事件」。</p>
          ) : (
            <>
              <label>
                <span>采集事件</span>
                <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.code} · {e.date} · {e.locality}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <div className="event-card">
                  <b>{selected.code}</b>
                  <dl>
                    <div>
                      <dt>采集地点</dt>
                      <dd>{selected.locality}</dd>
                    </div>
                    <div>
                      <dt>海拔</dt>
                      <dd>{selected.altitude || "—"}</dd>
                    </div>
                    <div>
                      <dt>生境</dt>
                      <dd>{selected.habitat || "—"}</dd>
                    </div>
                    <div>
                      <dt>采集人</dt>
                      <dd>{selected.collectors || "—"}</dd>
                    </div>
                  </dl>
                  <p className="hint">标本将继承该事件的地点 / 海拔 / 生境 / 采集人，无需逐份填写。</p>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="field-grid">
          <label>
            <span>采集日期</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span>事件号（自动生成）</span>
            <input value={previewCode} disabled />
          </label>
          <label className="span2">
            <span>采集地点 *</span>
            <input
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              placeholder="如：秦岭北坡·石砭峪沟谷"
            />
          </label>
          <label>
            <span>海拔</span>
            <input value={altitude} onChange={(e) => setAltitude(e.target.value)} placeholder="如：1420 m" />
          </label>
          <label>
            <span>采集人</span>
            <input value={collectors} onChange={(e) => setCollectors(e.target.value)} placeholder="多人用顿号分隔" />
          </label>
          <label className="span2">
            <span>生境描述</span>
            <input value={habitat} onChange={(e) => setHabitat(e.target.value)} placeholder="如：阴湿沟谷，针阔混交林缘" />
          </label>
        </div>
      )}

      <div className="step-label">第 2 步 · 录入标本</div>
      <div className="field-grid">
        <label>
          <span>采集号 *</span>
          <input
            value={collectionNo}
            onChange={(e) => setCollectionNo(e.target.value)}
            placeholder="如：HX-240615-01"
          />
        </label>
        <label>
          <span>物种名称 *</span>
          <input
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            placeholder="如：槭属待定"
          />
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}
      <div className="actions">
        <button className="primary" onClick={submit}>
          登记入库
        </button>
      </div>
    </section>
  );
}
