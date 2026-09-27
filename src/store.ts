import { useEffect, useMemo, useReducer, type Dispatch } from "react";
import type {
  CollectEvent,
  IdStatus,
  LogEntry,
  PersistShape,
  ReviewItem,
  Specimen,
} from "./types";
import { FIELD_LABELS as LABELS } from "./types";
import { buildSeed } from "./seed";

export const STORAGE_KEY = "herbarium-store-v1";

let uidCounter = 0;
export function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter.toString(36)}`;
}

export function normCabinet(s: string): string {
  return s.trim().toUpperCase();
}

// ---------- 状态 ----------

export interface State extends PersistShape {}

export function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistShape;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.events)) {
        return parsed as State;
      }
    }
  } catch {
    // 数据损坏时回退到示例数据
  }
  return buildSeed();
}

// ---------- 动作 ----------

export interface NewEventInput {
  date: string;
  locality: string;
  elevation: string;
  habitat: string;
  collectors: string;
}

export interface NewSpecimenInput {
  eventId: string;
  collectionNo: string;
  species: string;
  pressed: boolean;
}

export interface EventPatch {
  locality?: string;
  elevation?: string;
  habitat?: string;
  collectors?: string;
  date?: string;
}

export type Action =
  | { type: "register"; event: NewEventInput | null; eventId: string | null; specimen: NewSpecimenInput }
  | { type: "updateEvent"; eventId: string; patch: EventPatch }
  | { type: "updateSpecimen"; id: string; patch: Partial<Pick<Specimen, "collectionNo" | "species" | "pressed" | "idStatus">> }
  | { type: "shelve"; id: string; cabinet: string }
  | { type: "unshelve"; id: string }
  | { type: "resolveReview"; id: string; adopt: boolean }
  | { type: "resetAll" };

// ---------- 联动规则 ----------

export interface EventUpdatePreview {
  event: CollectEvent;
  changed: (keyof EventPatch)[];
  /** 未上柜、将直接联动更新的标本 */
  cascade: Specimen[];
  /** 已上柜、将标记待复核的标本 */
  review: Specimen[];
}

/** 预览事件改动的影响范围（地点/海拔才触发待复核规则） */
export function previewEventUpdate(state: State, eventId: string, patch: EventPatch): EventUpdatePreview | null {
  const event = state.events.find((e) => e.id === eventId);
  if (!event) return null;
  const changed = (Object.keys(patch) as (keyof EventPatch)[]).filter(
    (k) => patch[k] !== undefined && String(patch[k]).trim() !== "" && patch[k] !== event[k]
  );
  const locOrElevChanged = changed.includes("locality") || changed.includes("elevation");
  const siblings = state.specimens.filter((s) => s.eventId === eventId);
  const cascade = locOrElevChanged ? siblings.filter((s) => !s.shelved) : [];
  const review = locOrElevChanged ? siblings.filter((s) => s.shelved) : [];
  return { event, changed, cascade, review };
}

function applyEventUpdate(state: State, eventId: string, patch: EventPatch, now: number): State {
  const preview = previewEventUpdate(state, eventId, patch);
  if (!preview || preview.changed.length === 0) return state;
  const { event, changed } = preview;

  const nextEvent: CollectEvent = { ...event };
  for (const k of changed) nextEvent[k] = String(patch[k]).trim();

  const locOrElev = changed.filter((k) => k === "locality" || k === "elevation") as ("locality" | "elevation")[];
  const others = changed.filter((k) => k !== "locality" && k !== "elevation");

  const specimens = state.specimens.map((s) => {
    if (s.eventId !== eventId) return s;
    let next: Specimen = { ...s, updatedAt: now };
    // 生境 / 采集人 / 日期 不触发复核：直接同步到同事件所有标本
    for (const k of others) {
      if (k === "habitat" || k === "collectors") next[k] = nextEvent[k];
    }
    if (locOrElev.length > 0) {
      if (!s.shelved) {
        // 未上柜：直接联动更新
        for (const k of locOrElev) next[k] = nextEvent[k];
      } else {
        // 已上柜：标记待复核，保留原值
        const items: ReviewItem[] = [...(s.pendingReview ?? [])];
        for (const k of locOrElev) {
          const idx = items.findIndex((it) => it.field === k);
          const base = idx >= 0 ? items[idx].oldValue : s[k];
          const item: ReviewItem = {
            field: k,
            label: LABELS[k],
            oldValue: base,
            newValue: nextEvent[k],
          };
          if (idx >= 0) items[idx] = item;
          else items.push(item);
        }
        next.pendingReview = items;
      }
    }
    return next;
  });

  const changedLabels = changed.map((k) => LABELS[k]).join("、");
  const logs: LogEntry[] = [
    {
      id: uid("log"),
      at: now,
      kind: "event-update",
      eventId,
      detail: `采集事件 ${eventId} 修改${changedLabels}`,
    },
  ];
  if (locOrElev.length > 0) {
    const cascadeNos = specimens
      .filter((s) => s.eventId === eventId && !s.shelved)
      .map((s) => s.collectionNo);
    const reviewNos = specimens
      .filter((s) => s.eventId === eventId && s.shelved)
      .map((s) => s.collectionNo);
    if (cascadeNos.length > 0) {
      logs.push({
        id: uid("log"),
        at: now,
        kind: "cascade",
        eventId,
        detail: `未上柜标本已联动更新（${cascadeNos.join("、")}）`,
      });
    }
    if (reviewNos.length > 0) {
      logs.push({
        id: uid("log"),
        at: now,
        kind: "review-flag",
        eventId,
        detail: `已上柜标本标记待复核（${reviewNos.join("、")}）`,
      });
    }
  }

  return {
    ...state,
    events: state.events.map((e) => (e.id === eventId ? nextEvent : e)),
    specimens,
    logs: [...logs, ...state.logs],
  };
}

// ---------- reducer ----------

export function reducer(state: State, action: Action): State {
  const now = Date.now();
  switch (action.type) {
    case "register": {
      let events = state.events;
      let logs: LogEntry[] = [];
      let eventId = action.eventId;
      let event: CollectEvent | undefined;
      let eventSeq = state.eventSeq;

      if (action.event) {
        // 新建采集事件
        eventSeq += 1;
        eventId = `EV-${String(eventSeq).padStart(4, "0")}`;
        event = {
          id: eventId,
          date: action.event.date,
          locality: action.event.locality.trim(),
          elevation: action.event.elevation.trim(),
          habitat: action.event.habitat.trim(),
          collectors: action.event.collectors.trim(),
          createdAt: now,
        };
        events = [...events, event];
        logs.push({
          id: uid("log"),
          at: now,
          kind: "event-create",
          eventId,
          detail: `新建采集事件 ${eventId}（${event.locality} · ${event.elevation}m · ${event.collectors}）`,
        });
      } else {
        event = events.find((e) => e.id === eventId);
      }
      if (!event || !eventId) return state;

      const sp = action.specimen;
      const specimen: Specimen = {
        id: uid("sp"),
        eventId,
        collectionNo: sp.collectionNo.trim(),
        species: sp.species.trim(),
        pressed: sp.pressed,
        idStatus: "pending",
        shelved: false,
        cabinet: null,
        locality: event.locality,
        elevation: event.elevation,
        habitat: event.habitat,
        collectors: event.collectors,
        pendingReview: null,
        createdAt: now,
        updatedAt: now,
      };
      logs.push({
        id: uid("log"),
        at: now,
        kind: "register",
        eventId,
        specimenId: specimen.id,
        collectionNo: specimen.collectionNo,
        detail: `登记标本 ${specimen.collectionNo}（${specimen.species}），归入事件 ${eventId}`,
      });
      return {
        ...state,
        events,
        eventSeq,
        specimens: [...state.specimens, specimen],
        logs: [...logs, ...state.logs],
      };
    }

    case "updateEvent":
      return applyEventUpdate(state, action.eventId, action.patch, now);

    case "updateSpecimen": {
      const target = state.specimens.find((s) => s.id === action.id);
      if (!target) return state;
      const next: Specimen = { ...target, ...action.patch, updatedAt: now };
      const parts: string[] = [];
      if (action.patch.collectionNo && action.patch.collectionNo !== target.collectionNo)
        parts.push(`采集号 ${target.collectionNo} → ${next.collectionNo}`);
      if (action.patch.species && action.patch.species !== target.species)
        parts.push(`物种 ${target.species} → ${next.species}`);
      if (action.patch.pressed !== undefined && action.patch.pressed !== target.pressed)
        parts.push(next.pressed ? "标记为已压制" : "退回待压制");
      if (action.patch.idStatus && action.patch.idStatus !== target.idStatus)
        parts.push(next.idStatus === "confirmed" ? "鉴定完成" : "退回待鉴定");
      if (parts.length === 0) return state;
      const log: LogEntry = {
        id: uid("log"),
        at: now,
        kind: "specimen-update",
        eventId: target.eventId,
        specimenId: target.id,
        collectionNo: next.collectionNo,
        detail: parts.join("；"),
      };
      return {
        ...state,
        specimens: state.specimens.map((s) => (s.id === target.id ? next : s)),
        logs: [log, ...state.logs],
      };
    }

    case "shelve": {
      const target = state.specimens.find((s) => s.id === action.id);
      if (!target) return state;
      const cabinet = normCabinet(action.cabinet);
      const next: Specimen = { ...target, shelved: true, cabinet, updatedAt: now };
      const log: LogEntry = {
        id: uid("log"),
        at: now,
        kind: "shelve",
        eventId: target.eventId,
        specimenId: target.id,
        collectionNo: target.collectionNo,
        detail: `上柜，柜位 ${cabinet}`,
      };
      return {
        ...state,
        specimens: state.specimens.map((s) => (s.id === target.id ? next : s)),
        logs: [log, ...state.logs],
      };
    }

    case "unshelve": {
      const target = state.specimens.find((s) => s.id === action.id);
      if (!target || !target.shelved) return state;
      // 下柜后即属“未上柜”：挂起的待复核项直接采用事件现值
      const event = state.events.find((e) => e.id === target.eventId);
      const next: Specimen = { ...target, shelved: false, cabinet: null, updatedAt: now };
      let adopted = "";
      if (target.pendingReview && target.pendingReview.length > 0 && event) {
        for (const item of target.pendingReview) next[item.field] = event[item.field];
        next.pendingReview = null;
        adopted = `；待复核项已随事件更新（${target.pendingReview.map((i) => i.label).join("、")}）`;
      }
      const log: LogEntry = {
        id: uid("log"),
        at: now,
        kind: "unshelve",
        eventId: target.eventId,
        specimenId: target.id,
        collectionNo: target.collectionNo,
        detail: `下柜（原柜位 ${target.cabinet ?? "—"}）${adopted}`,
      };
      return {
        ...state,
        specimens: state.specimens.map((s) => (s.id === target.id ? next : s)),
        logs: [log, ...state.logs],
      };
    }

    case "resolveReview": {
      const target = state.specimens.find((s) => s.id === action.id);
      if (!target || !target.pendingReview || target.pendingReview.length === 0) return state;
      const event = state.events.find((e) => e.id === target.eventId);
      const next: Specimen = { ...target, updatedAt: now };
      const parts: string[] = [];
      for (const item of target.pendingReview) {
        if (action.adopt) {
          // 采用事件新值
          next[item.field] = event ? event[item.field] : item.newValue;
          parts.push(`${item.label} ${item.oldValue} → ${next[item.field]}`);
        } else {
          parts.push(`${item.label} 保留原值 ${item.oldValue}（事件现为 ${item.newValue}）`);
        }
      }
      next.pendingReview = null;
      const log: LogEntry = {
        id: uid("log"),
        at: now,
        kind: "review-resolve",
        eventId: target.eventId,
        specimenId: target.id,
        collectionNo: target.collectionNo,
        detail: `复核完成：${action.adopt ? "采用新值" : "保留原值"}（${parts.join("；")}）`,
      };
      return {
        ...state,
        specimens: state.specimens.map((s) => (s.id === target.id ? next : s)),
        logs: [log, ...state.logs],
      };
    }

    case "resetAll":
      return buildSeed();

    default:
      return state;
  }
}

// ---------- 派生查询 ----------

export function cabinetOccupant(state: State, cabinet: string, excludeId?: string): Specimen | undefined {
  const norm = normCabinet(cabinet);
  if (!norm) return undefined;
  return state.specimens.find((s) => s.shelved && s.cabinet && normCabinet(s.cabinet) === norm && s.id !== excludeId);
}

export function collectionNoTaken(state: State, no: string, excludeId?: string): boolean {
  const norm = no.trim().toUpperCase();
  return state.specimens.some((s) => s.collectionNo.trim().toUpperCase() === norm && s.id !== excludeId);
}

export interface Stats {
  total: number;
  pendingId: number;
  shelved: number;
  review: number;
  events: number;
}

export function computeStats(state: State): Stats {
  return {
    total: state.specimens.length,
    pendingId: state.specimens.filter((s) => s.idStatus === "pending").length,
    shelved: state.specimens.filter((s) => s.shelved).length,
    review: state.specimens.filter((s) => (s.pendingReview?.length ?? 0) > 0).length,
    events: state.events.length,
  };
}

// ---------- Hook ----------

export function useHerbarium(): { state: State; dispatch: Dispatch<Action> } {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储失败（如隐私模式）时静默，保持内存态可用
    }
  }, [state]);
  return useMemo(() => ({ state, dispatch }), [state]);
}

export type { IdStatus };
