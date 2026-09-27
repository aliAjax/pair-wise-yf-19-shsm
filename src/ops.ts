import type {
  ChangeLog,
  CollectingEvent,
  Database,
  IdStatus,
  Specimen,
} from "./types";
import { uid } from "./store";

export interface OpResult {
  db: Database;
  messages: string[]; // 操作摘要，用于提示条
  error?: string;
  specimenId?: string;
}

function log(
  db: Database,
  scope: ChangeLog["scope"],
  refId: string,
  eventId: string,
  message: string
): ChangeLog[] {
  return [
    ...db.logs,
    { id: uid("log"), at: Date.now(), scope, refId, eventId, message },
  ];
}

// 自动生成采集事件号：EV-YYMMDD-序号
export function nextEventCode(db: Database, date: string): string {
  const ymd = date.replace(/-/g, "").slice(2);
  const prefix = `EV-${ymd}-`;
  const seq =
    db.events.filter((e) => e.code.startsWith(prefix)).length + 1;
  return `${prefix}${String(seq).padStart(2, "0")}`;
}

export interface NewEventInput {
  date: string;
  locality: string;
  altitude: string;
  habitat: string;
  collectors: string;
}

export interface NewSpecimenInput {
  collectionNo: string;
  species: string;
}

// 登记标本：先选定（或新建）事件，再录采集号与物种
export function registerSpecimen(
  db: Database,
  eventId: string | null,
  newEvent: NewEventInput | null,
  input: NewSpecimenInput
): OpResult {
  const collectionNo = input.collectionNo.trim();
  const species = input.species.trim();
  if (!collectionNo) return { db, messages: [], error: "请填写采集号" };
  if (!species) return { db, messages: [], error: "请填写物种名称" };
  if (db.specimens.some((s) => s.collectionNo === collectionNo)) {
    return { db, messages: [], error: `采集号 ${collectionNo} 已存在，不能重复登记` };
  }

  let events = db.events;
  let logs = db.logs;
  let evId = eventId;
  const messages: string[] = [];

  if (!evId) {
    if (!newEvent) return { db, messages: [], error: "请先选择采集事件" };
    if (!newEvent.locality.trim()) {
      return { db, messages: [], error: "新事件需要填写采集地点" };
    }
    const ev: CollectingEvent = {
      id: uid("ev"),
      code: nextEventCode(db, newEvent.date),
      date: newEvent.date,
      locality: newEvent.locality.trim(),
      altitude: newEvent.altitude.trim(),
      habitat: newEvent.habitat.trim(),
      collectors: newEvent.collectors.trim(),
      createdAt: Date.now(),
    };
    events = [...events, ev];
    logs = log({ ...db, events, logs }, "event", ev.id, ev.id, `登记采集事件 ${ev.code}`);
    evId = ev.id;
    messages.push(`已创建采集事件 ${ev.code}`);
  }

  const sp: Specimen = {
    id: uid("sp"),
    eventId: evId,
    collectionNo,
    species,
    idStatus: "unidentified",
    shelfStatus: "unshelved",
    review: "none",
    createdAt: Date.now(),
  };
  logs = log({ ...db, events, logs }, "specimen", sp.id, evId, `登记标本 ${collectionNo}`);
  messages.push(`标本 ${collectionNo} 已加入入库队列`);

  return {
    db: { ...db, events, specimens: [...db.specimens, sp], logs },
    messages,
    specimenId: sp.id,
  };
}

export interface EventPatch {
  locality: string;
  altitude: string;
  habitat: string;
  collectors: string;
}

// 修改事件：地点 / 海拔变化时，未上柜标本随事件更新；已上柜的标记待复核
export function updateEvent(db: Database, eventId: string, patch: EventPatch): OpResult {
  const ev = db.events.find((e) => e.id === eventId);
  if (!ev) return { db, messages: [], error: "事件不存在" };

  const next: CollectingEvent = {
    ...ev,
    locality: patch.locality.trim(),
    altitude: patch.altitude.trim(),
    habitat: patch.habitat.trim(),
    collectors: patch.collectors.trim(),
  };

  const diffs: string[] = [];
  if (next.locality !== ev.locality) diffs.push(`地点 ${ev.locality} → ${next.locality}`);
  if (next.altitude !== ev.altitude) diffs.push(`海拔 ${ev.altitude} → ${next.altitude}`);
  if (next.habitat !== ev.habitat) diffs.push(`生境已更新`);
  if (next.collectors !== ev.collectors) diffs.push(`采集人 ${ev.collectors} → ${next.collectors}`);
  if (diffs.length === 0) return { db, messages: ["事件信息无变化"] };

  const geoChanged = next.locality !== ev.locality || next.altitude !== ev.altitude;
  let specimens = db.specimens;
  let logs = log(db, "event", ev.id, ev.id, `修改事件 ${ev.code}：${diffs.join("；")}`);
  const messages = [`事件 ${ev.code} 已更新（${diffs.join("；")}）`];

  if (geoChanged) {
    const members = specimens.filter((s) => s.eventId === eventId);
    const shelved = members.filter((s) => s.shelfStatus === "shelved");
    const unshelvedCount = members.length - shelved.length;

    // 未上柜标本直接跟随事件展示，无需逐份改动，只留一条事件级记录
    if (unshelvedCount > 0) {
      logs = log(
        { ...db, logs },
        "event",
        ev.id,
        ev.id,
        `${unshelvedCount} 份未上柜标本已随事件更新地点 / 海拔`
      );
      messages.push(`${unshelvedCount} 份未上柜标本已同步更新`);
    }

    // 已上柜标本保留上柜快照，标记待复核
    if (shelved.length > 0) {
      specimens = specimens.map((s) =>
        s.eventId === eventId && s.shelfStatus === "shelved"
          ? { ...s, review: "pending" as const }
          : s
      );
      for (const s of shelved) {
        logs = log(
          { ...db, logs },
          "specimen",
          s.id,
          eventId,
          `事件地点 / 海拔变更，标本 ${s.collectionNo} 已上柜，标记待复核`
        );
      }
      messages.push(`${shelved.length} 份已上柜标本已标记待复核`);
    }
  }

  return {
    db: {
      ...db,
      events: db.events.map((e) => (e.id === eventId ? next : e)),
      specimens,
      logs,
    },
    messages,
  };
}

// 上柜：柜位在已上柜标本中唯一，冲突时指出原占用的采集号
export function shelveSpecimen(
  db: Database,
  specimenId: string,
  position: string
): OpResult {
  const sp = db.specimens.find((s) => s.id === specimenId);
  if (!sp) return { db, messages: [], error: "标本不存在" };
  const pos = position.trim().toUpperCase();
  if (!pos) return { db, messages: [], error: "请填写柜位" };

  const holder = db.specimens.find(
    (s) => s.id !== specimenId && s.shelfStatus === "shelved" && s.shelfPosition === pos
  );
  if (holder) {
    return {
      db,
      messages: [],
      error: `柜位 ${pos} 已被采集号 ${holder.collectionNo} 占用`,
    };
  }

  const ev = db.events.find((e) => e.id === sp.eventId);
  const updated: Specimen = {
    ...sp,
    shelfStatus: "shelved",
    shelfPosition: pos,
    shelvedAt: Date.now(),
    // 上柜时留存地点 / 海拔快照，此后事件改动不影响已上柜标本的展示值
    localitySnapshot: ev?.locality ?? "",
    altitudeSnapshot: ev?.altitude ?? "",
  };
  const logs = log(
    db,
    "specimen",
    sp.id,
    sp.eventId,
    `标本 ${sp.collectionNo} 上柜至 ${pos}`
  );
  return {
    db: {
      ...db,
      specimens: db.specimens.map((s) => (s.id === specimenId ? updated : s)),
      logs,
    },
    messages: [`标本 ${sp.collectionNo} 已上柜至 ${pos}`],
  };
}

export function unshelveSpecimen(db: Database, specimenId: string): OpResult {
  const sp = db.specimens.find((s) => s.id === specimenId);
  if (!sp) return { db, messages: [], error: "标本不存在" };
  const updated: Specimen = {
    ...sp,
    shelfStatus: "unshelved",
    shelfPosition: undefined,
    shelvedAt: undefined,
    review: "none",
    localitySnapshot: undefined,
    altitudeSnapshot: undefined,
  };
  const logs = log(
    db,
    "specimen",
    sp.id,
    sp.eventId,
    `标本 ${sp.collectionNo} 撤下柜位（${sp.shelfPosition ?? "无柜位"}），改回未上柜`
  );
  return {
    db: {
      ...db,
      specimens: db.specimens.map((s) => (s.id === specimenId ? updated : s)),
      logs,
    },
    messages: [`标本 ${sp.collectionNo} 已撤下柜位`],
  };
}

// 复核：adopt 采用事件新值；keep 保留上柜时原值
export function resolveReview(
  db: Database,
  specimenId: string,
  action: "adopt" | "keep"
): OpResult {
  const sp = db.specimens.find((s) => s.id === specimenId);
  if (!sp) return { db, messages: [], error: "标本不存在" };
  const ev = db.events.find((e) => e.id === sp.eventId);
  if (!ev) return { db, messages: [], error: "关联事件不存在" };

  const updated: Specimen =
    action === "adopt"
      ? {
          ...sp,
          review: "synced",
          localitySnapshot: ev.locality,
          altitudeSnapshot: ev.altitude,
        }
      : { ...sp, review: "kept" };

  const message =
    action === "adopt"
      ? `复核通过：标本 ${sp.collectionNo} 采用事件新值（${ev.locality} / ${ev.altitude}）`
      : `复核通过：标本 ${sp.collectionNo} 保留上柜时原值（${sp.localitySnapshot ?? ""} / ${sp.altitudeSnapshot ?? ""}）`;

  const logs = log(db, "specimen", sp.id, sp.eventId, message);
  return {
    db: {
      ...db,
      specimens: db.specimens.map((s) => (s.id === specimenId ? updated : s)),
      logs,
    },
    messages: [message],
  };
}

export function updateSpecimen(
  db: Database,
  specimenId: string,
  patch: { species?: string; idStatus?: IdStatus; idRemark?: string }
): OpResult {
  const sp = db.specimens.find((s) => s.id === specimenId);
  if (!sp) return { db, messages: [], error: "标本不存在" };

  const diffs: string[] = [];
  const next = { ...sp };
  if (patch.species !== undefined && patch.species.trim() && patch.species.trim() !== sp.species) {
    diffs.push(`物种 ${sp.species} → ${patch.species.trim()}`);
    next.species = patch.species.trim();
  }
  if (patch.idStatus !== undefined && patch.idStatus !== sp.idStatus) {
    diffs.push(`鉴定状态 → ${patch.idStatus === "identified" ? "已鉴定" : "待鉴定"}`);
    next.idStatus = patch.idStatus;
  }
  if (patch.idRemark !== undefined && patch.idRemark.trim() !== (sp.idRemark ?? "")) {
    diffs.push(`鉴定备注已更新`);
    next.idRemark = patch.idRemark.trim() || undefined;
  }
  if (diffs.length === 0) return { db, messages: ["标本信息无变化"] };

  const logs = log(db, "specimen", sp.id, sp.eventId, `修改标本 ${sp.collectionNo}：${diffs.join("；")}`);
  return {
    db: {
      ...db,
      specimens: db.specimens.map((s) => (s.id === specimenId ? next : s)),
      logs,
    },
    messages: [`标本 ${sp.collectionNo} 已更新`],
  };
}

// 标本展示用的地点 / 海拔：未上柜跟随事件，已上柜用上柜快照
export function displayLocality(sp: Specimen, ev: CollectingEvent | undefined): string {
  if (sp.shelfStatus === "shelved" && sp.localitySnapshot !== undefined) return sp.localitySnapshot;
  return ev?.locality ?? "—";
}

export function displayAltitude(sp: Specimen, ev: CollectingEvent | undefined): string {
  if (sp.shelfStatus === "shelved" && sp.altitudeSnapshot !== undefined) return sp.altitudeSnapshot;
  return ev?.altitude ?? "—";
}

export function findShelfConflict(db: Database, position: string, excludeId?: string) {
  const pos = position.trim().toUpperCase();
  if (!pos) return undefined;
  return db.specimens.find(
    (s) => s.id !== excludeId && s.shelfStatus === "shelved" && s.shelfPosition === pos
  );
}
