import { useMemo, useState } from "react";
import "./styles.css";
import { computeStats, useHerbarium } from "./store";
import { RegisterForm } from "./components/RegisterForm";
import { QueueView } from "./components/QueueView";
import { SpecimenDetail } from "./components/SpecimenDetail";

type View = "queue" | "register";

function App() {
  const { state, dispatch } = useHerbarium();
  const [view, setView] = useState<View>("queue");
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(() => computeStats(state), [state]);

  const counts = useMemo(
    () => ({
      all: state.specimens.length,
      pending: state.specimens.filter((s) => s.idStatus === "pending").length,
      confirmed: state.specimens.filter((s) => s.idStatus === "confirmed").length,
      shelved: state.specimens.filter((s) => s.shelved).length,
      unshelved: state.specimens.filter((s) => !s.shelved).length,
      review: state.specimens.filter((s) => (s.pendingReview?.length ?? 0) > 0).length,
    }),
    [state.specimens]
  );

  function reset() {
    if (window.confirm("确定清空本机数据并恢复示例数据？此操作不可撤销。")) {
      dispatch({ type: "resetAll" });
      setOpenId(null);
      setView("queue");
    }
  }

  const metricCards = [
    { label: "入库队列", value: stats.total },
    { label: "待鉴定", value: stats.pendingId },
    { label: "已上柜", value: stats.shelved },
    { label: "待复核", value: stats.review, alert: stats.review > 0 },
    { label: "采集事件", value: stats.events },
  ];

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <h1>植物标本馆入库</h1>
          <p>以「采集事件」为单位登记同场标本 · 数据保存在本机浏览器</p>
        </div>
        <nav className="tabs">
          <button className={view === "queue" ? "tab-on" : ""} onClick={() => setView("queue")}>
            入库队列
          </button>
          <button
            className={view === "register" ? "tab-on" : ""}
            onClick={() => setView("register")}
          >
            登记标本
          </button>
          <button className="ghost" onClick={reset} title="清空并恢复示例数据">
            重置数据
          </button>
        </nav>
      </header>

      <section className="metrics">
        {metricCards.map((m) => (
          <article key={m.label} className={m.alert ? "metric-alert" : ""}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      {openId ? (
        <SpecimenDetail
          key={openId}
          state={state}
          dispatch={dispatch}
          specimenId={openId}
          onOpenSpecimen={(id) => setOpenId(id)}
          onBack={() => setOpenId(null)}
        />
      ) : view === "queue" ? (
        <QueueView
          specimens={state.specimens}
          events={state.events}
          counts={counts}
          onOpen={(id) => setOpenId(id)}
        />
      ) : (
        <RegisterForm
          state={state}
          dispatch={dispatch}
          onCreated={() => {
            setView("queue");
          }}
        />
      )}

      <footer className="foot">
        所有记录仅保存在本机（localStorage），关闭重开后仍可继续处理。
      </footer>
    </main>
  );
}

export default App;
