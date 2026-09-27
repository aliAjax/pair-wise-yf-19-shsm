import type { ReactNode } from "react";
import type { IdStatus, Specimen } from "../types";

type Variant = "green" | "teal" | "amber" | "gray" | "red" | "blue";

const variantClass: Record<Variant, string> = {
  green: "bd bd-green",
  teal: "bd bd-teal",
  amber: "bd bd-amber",
  gray: "bd bd-gray",
  red: "bd bd-red",
  blue: "bd bd-blue",
};

export function Badge({ variant = "gray", children }: { variant?: Variant; children: ReactNode }) {
  return <span className={variantClass[variant]}>{children}</span>;
}

export function specimenBadges(s: Specimen): ReactNode[] {
  const out: ReactNode[] = [];
  out.push(
    <Badge key="p" variant={s.pressed ? "teal" : "gray"}>
      {s.pressed ? "已压制" : "待压制"}
    </Badge>
  );
  out.push(
    <Badge key="id" variant={s.idStatus === ("confirmed" as IdStatus) ? "green" : "amber"}>
      {s.idStatus === "confirmed" ? "已鉴定" : "待鉴定"}
    </Badge>
  );
  if (s.shelved) {
    out.push(
      <Badge key="sh" variant="blue">
        已上柜 {s.cabinet ? `· ${s.cabinet}` : ""}
      </Badge>
    );
  } else {
    out.push(<Badge key="sh" variant="gray">未上柜</Badge>);
  }
  if (s.pendingReview && s.pendingReview.length > 0) {
    out.push(
      <Badge key="rv" variant="red">
        待复核 ×{s.pendingReview.length}
      </Badge>
    );
  }
  return out;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
