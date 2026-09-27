// 采集事件：同一场采集（同地点 / 海拔 / 生境 / 采集人）归为一个事件
export interface CollectingEvent {
  id: string;
  code: string; // 采集事件号，如 EV-240615-01
  date: string; // 采集日期 YYYY-MM-DD
  locality: string; // 采集地点
  altitude: string; // 海拔，如 1420 m
  habitat: string; // 生境描述
  collectors: string; // 采集人
  createdAt: number;
}

export type IdStatus = "unidentified" | "identified"; // 待鉴定 / 已鉴定
export type ShelfStatus = "unshelved" | "shelved"; // 未上柜 / 已上柜
// 事件地点或海拔变更后，已上柜标本进入 pending；复核后 synced（采用新值）或 kept（保留原值）
export type ReviewStatus = "none" | "pending" | "synced" | "kept";

export interface Specimen {
  id: string;
  eventId: string;
  collectionNo: string; // 采集号，如 HX-240615-01
  species: string; // 物种名称
  idStatus: IdStatus;
  idRemark?: string; // 鉴定备注（学名 / 鉴定人等）
  shelfStatus: ShelfStatus;
  shelfPosition?: string; // 馆藏柜位，如 A-03-12
  shelvedAt?: number;
  review: ReviewStatus;
  // 上柜时对地点 / 海拔留存快照；事件改动后未复核前仍显示上柜时的原值
  localitySnapshot?: string;
  altitudeSnapshot?: string;
  createdAt: number;
}

export interface ChangeLog {
  id: string;
  at: number;
  scope: "event" | "specimen";
  refId: string; // 事件或标本 id
  eventId: string; // 冗余事件 id，便于详情页汇总
  message: string; // 修改内容描述
}

export interface Database {
  version: 1;
  events: CollectingEvent[];
  specimens: Specimen[];
  logs: ChangeLog[];
}

export const ID_STATUS_LABEL: Record<IdStatus, string> = {
  unidentified: "待鉴定",
  identified: "已鉴定",
};

export const SHELF_STATUS_LABEL: Record<ShelfStatus, string> = {
  unshelved: "未上柜",
  shelved: "已上柜",
};
