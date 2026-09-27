import { useCallback, useEffect, useState } from "react";
import type { Database } from "./types";
import { loadDB, resetDB, saveDB } from "./store";
import * as ops from "./ops";
import RegisterPanel from "./RegisterPanel";
import QueuePanel from "./QueuePanel";
import EventsPanel from "./EventsPanel";
import DetailView from "./DetailView";
import "./styles.css";

type View = { name: "home" } | { name: "detail"; specimenId: string };

export default function App() {
  const [db, setDb] = useState<Database>(loadDB);
  const [view, setView] = useState<View>({ name: "home" });
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  // 每次变更即写入本机存储，重开页面可继续处理
  useEffect(() => {
    saveDB(db);
  }, [db]);

  const notify = useCallback((messages: string[]) => {
    const items = messages.map((text) => ({ id: Date.now() + Math.random(), text }));
    setToasts((prev) => [...prev, ...items]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => !items.some((i) => i.id === t.id)));
    }, 4200);
  }, []);

  const apply = useCallback(
    (result: ops.OpResult): string | undefined => {
      if (result.error) return result.error;
      setDb(result.db);
      notify(result.messages);
      return undefined;
    },
    [notify]
  );

  const openDetail = (specimenId: string) => {
    setView({ name: "detail", specimenId });
    window.scrollTo({ top: 0 });
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `herbarium-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    if (window.confirm("确定清空本机数据并恢复演示数据吗？")) {
      setDb(resetDB());
      setView({ name: "home" });
      notify(["已重置为演示数据"]);
    }
  };

  const metrics = {
    queue: db.specimens.length,
    unidentified: db.specimens.filter((s) => s.idStatus === "unidentified").length,
    shelved: db.specimens.filter((s) => s.shelfStatus === "shelved").length,
    review: db.specimens.filter((s) => s.review === "pending").length,
    events: db.events.length,
  };

  return (
    <main className="app">
      <header className="hero">
        <p>植物标本馆 · 压制标本入库</p>
        <h1>采集事件驱动的标本入库台</h1>
        <span>
          同场采集归为一个采集事件：登记标本时先选事件，再录采集号与物种；事件地点或海拔更正后，
          未上柜标本自动同步，已上柜标本标记待复核，无需逐份返工。
        </span>
        <div className="hero-actions">
          <button onClick={exportJSON}>导出备份（JSON）</button>
          <button onClick={reset}>重置演示数据</button>
        </div>
      </header>

      <section className="metrics">
        <article>
          <small>入库队列</small>
          <strong>{metrics.queue}</strong>
        </article>
        <article>
          <small>待鉴定</small>
          <strong>{metrics.unidentified}</strong>
        </article>
        <article>
          <small>已上柜</small>
          <strong>{metrics.shelved}</strong>
        </article>
        <article>
          <small>待复核</small>
          <strong className={metrics.review > 0 ? "warn" : ""}>{metrics.review}</strong>
        </article>
        <article>
          <small>采集事件</small>
          <strong>{metrics.events}</strong>
        </article>
      </section>

      {view.name === "detail" ? (
        <DetailView
          db={db}
          specimenId={view.specimenId}
          onBack={() => setView({ name: "home" })}
          onOpen={openDetail}
          onShelve={(id, pos) => apply(ops.shelveSpecimen(db, id, pos))}
          onUnshelve={(id) => apply(ops.unshelveSpecimen(db, id))}
          onResolveReview={(id, action) => apply(ops.resolveReview(db, id, action))}
          onUpdateSpecimen={(id, patch) => apply(ops.updateSpecimen(db, id, patch))}
        />
      ) : (
        <>
          <div className="workspace">
            <RegisterPanel
              events={db.events}
              onSubmit={(eventId, newEvent, input) => {
                const result = ops.registerSpecimen(db, eventId, newEvent, input);
                const err = apply(result);
                if (!err && result.specimenId) openDetail(result.specimenId);
                return err;
              }}
            />
            <EventsPanel
              db={db}
              onUpdateEvent={(id, patch) => apply(ops.updateEvent(db, id, patch))}
              onOpenSpecimen={openDetail}
            />
          </div>
          <QueuePanel db={db} onOpen={openDetail} />
        </>
      )}

      <footer className="footer">
        数据保存在本机浏览器（localStorage），关闭或重开页面后可继续处理；更换设备前请先导出备份。
      </footer>

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}
