import type { ChangeLog, Database, Specimen } from "./types";

const STORAGE_KEY = "herbarium-intake-v1";

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

// ---------- 种子数据：重开也有可演示的事件 / 标本 ----------
function seed(): Database {
  const now = Date.now();
  const day = 86400000;
  const mkLog = (
    refId: string,
    eventId: string,
    message: string,
    at: number,
    scope: ChangeLog["scope"] = "event"
  ): ChangeLog => ({ id: uid("log"), at, scope, refId, eventId, message });

  const events = [
    {
      id: "ev_demo_1",
      code: "EV-240615-01",
      date: "2024-06-15",
      locality: "秦岭北坡·石砭峪沟谷",
      altitude: "1420 m",
      habitat: "阴湿沟谷，针阔混交林缘",
      collectors: "韩雪、周明",
      createdAt: now - 5 * day,
    },
    {
      id: "ev_demo_2",
      code: "EV-240615-02",
      date: "2024-06-15",
      locality: "秦岭北坡·石砭峪山脊",
      altitude: "1860 m",
      habitat: "山脊灌丛，多风",
      collectors: "周明",
      createdAt: now - 5 * day,
    },
    {
      id: "ev_demo_3",
      code: "EV-240616-01",
      date: "2024-06-16",
      locality: "太白山·蒿坪管理站",
      altitude: "1150 m",
      habitat: "路边草坡",
      collectors: "韩雪、李芃",
      createdAt: now - 4 * day,
    },
  ];

  const specimens: Specimen[] = [
    {
      id: "sp_demo_1",
      eventId: "ev_demo_1",
      collectionNo: "HX-240615-01",
      species: "槭属待定",
      idStatus: "unidentified",
      shelfStatus: "unshelved",
      review: "none",
      createdAt: now - 5 * day,
    },
    {
      id: "sp_demo_2",
      eventId: "ev_demo_1",
      collectionNo: "HX-240615-08",
      species: "蕨类（待定）",
      idStatus: "identified",
      idRemark: "荚果蕨属 · 周明 核",
      shelfStatus: "unshelved",
      review: "none",
      createdAt: now - 5 * day,
    },
    {
      id: "sp_demo_3",
      eventId: "ev_demo_1",
      collectionNo: "HX-240615-12",
      species: "葛罗槭",
      idStatus: "identified",
      idRemark: "Acer grosseri · 韩雪 定名",
      shelfStatus: "shelved",
      shelfPosition: "B-12-04",
      shelvedAt: now - 2 * day,
      review: "none",
      localitySnapshot: "秦岭北坡·石砭峪沟谷",
      altitudeSnapshot: "1420 m",
      createdAt: now - 5 * day,
    },
    {
      id: "sp_demo_4",
      eventId: "ev_demo_2",
      collectionNo: "HX-240615-21",
      species: "菊科（待定）",
      idStatus: "unidentified",
      shelfStatus: "shelved",
      shelfPosition: "B-12-05",
      shelvedAt: now - 2 * day,
      review: "none",
      localitySnapshot: "秦岭北坡·石砭峪山脊",
      altitudeSnapshot: "1860 m",
      createdAt: now - 5 * day,
    },
    {
      id: "sp_demo_5",
      eventId: "ev_demo_3",
      collectionNo: "HX-240616-03",
      species: "败酱",
      idStatus: "identified",
      idRemark: "Patrinia scabiosifolia",
      shelfStatus: "shelved",
      shelfPosition: "C-04-11",
      shelvedAt: now - 1 * day,
      review: "none",
      localitySnapshot: "太白山·蒿坪管理站",
      altitudeSnapshot: "1150 m",
      createdAt: now - 4 * day,
    },
  ];

  const logs = [
    mkLog("ev_demo_1", "ev_demo_1", "登记采集事件", now - 5 * day),
    mkLog("sp_demo_1", "ev_demo_1", "登记标本 HX-240615-01", now - 5 * day, "specimen"),
    mkLog("sp_demo_3", "ev_demo_1", "标本 HX-240615-12 上柜至 B-12-04", now - 2 * day, "specimen"),
    mkLog("sp_demo_4", "ev_demo_2", "标本 HX-240615-21 上柜至 B-12-05", now - 2 * day, "specimen"),
    mkLog("sp_demo_5", "ev_demo_3", "标本 HX-240616-03 上柜至 C-04-11", now - 1 * day, "specimen"),
  ];

  return { version: 1, events, specimens, logs };
}

export function loadDB(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed && Array.isArray(parsed.events) && Array.isArray(parsed.specimens)) {
        return { ...parsed, logs: Array.isArray(parsed.logs) ? parsed.logs : [] };
      }
    }
  } catch {
    // 数据损坏时回退到种子库
  }
  const fresh = seed();
  saveDB(fresh);
  return fresh;
}

export function saveDB(db: Database): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // 本地存储不可用时仅影响持久化，不阻断当次操作
  }
}

export function resetDB(): Database {
  const fresh = seed();
  saveDB(fresh);
  return fresh;
}
