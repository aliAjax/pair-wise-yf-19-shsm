// 标本馆入库：数据类型定义

/** 鉴定状态：待鉴定 / 已鉴定 */
export type IdStatus = "pending" | "confirmed";

/** 地点 / 海拔 改动后，已上柜标本挂起的待复核项 */
export interface ReviewItem {
  field: "locality" | "elevation";
  label: string;
  oldValue: string;
  newValue: string;
}

/** 采集事件：同一场采集（同地点、海拔、生境、采集人） */
export interface CollectEvent {
  id: string; // 采集事件号，如 EV-0001
  date: string; // 采集日期 YYYY-MM-DD
  locality: string; // 采集地点
  elevation: string; // 海拔（米）
  habitat: string; // 生境描述
  collectors: string; // 采集人
  createdAt: number;
}

/** 单份压制标本 */
export interface Specimen {
  id: string;
  eventId: string; // 所属采集事件号
  collectionNo: string; // 采集号（唯一）
  species: string; // 物种名称
  pressed: boolean; // 压制状态：false 待压制 / true 已压制
  idStatus: IdStatus; // 鉴定状态
  shelved: boolean; // 是否已上柜
  cabinet: string | null; // 馆藏柜位，如 B-12-04
  // 登记时从事件带出的快照信息
  locality: string;
  elevation: string;
  habitat: string;
  collectors: string;
  // 已上柜后事件地点/海拔变动时挂起，null 表示无待复核
  pendingReview: ReviewItem[] | null;
  createdAt: number;
  updatedAt: number;
}

/** 修改记录（含事件级联动记录） */
export interface LogEntry {
  id: string;
  at: number;
  kind: string;
  eventId?: string;
  specimenId?: string; // 省略表示事件级记录
  collectionNo?: string;
  detail: string;
}

export interface PersistShape {
  version: 1;
  events: CollectEvent[];
  specimens: Specimen[];
  logs: LogEntry[];
  eventSeq: number;
}

export const FIELD_LABELS: Record<"locality" | "elevation" | "habitat" | "collectors" | "date", string> = {
  locality: "采集地点",
  elevation: "海拔",
  habitat: "生境",
  collectors: "采集人",
  date: "采集日期",
};
