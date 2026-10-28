"use client";
import { CalendarCheck, UsersThree, UserCircle, Receipt } from "@phosphor-icons/react";
import DashboardSection, { IconTile, Tone, ViewAllLink } from "./DashboardSection";

const activity: { title: string; detail?: string; detailBelow?: boolean; time: string; tone: Tone; Icon: typeof Receipt }[] = [
  { title: "WO-10482 marked as completed",     detail: "by Michael Thomas",  detailBelow: true, time: "5 min ago",  tone: "green", Icon: CalendarCheck },
  { title: "WO-10491 assigned to Sarah Wilson",                                                 time: "12 min ago", tone: "blue",  Icon: UsersThree },
  { title: "Customer updated",                 detail: "ABC Manufacturing",                     time: "18 min ago", tone: "amber", Icon: UserCircle },
  { title: "Invoice generated",                detail: "WO-10463",                              time: "26 min ago", tone: "amber", Icon: Receipt },
];

export default function RecentActivityCard() {
  return (
    <DashboardSection title="Recent activity" headerRight={<ViewAllLink href="/jobs" />}>
      <ul className="m-0 p-0 list-none flex flex-col gap-3.5">
        {activity.map(({ title, detail, detailBelow, time, tone, Icon }) => (
          <li key={title} className="flex items-start gap-3">
            <IconTile tone={tone} size={32}><Icon size={18} weight="fill" /></IconTile>
            <div className="flex-1 min-w-0 pt-1.5">
              <p className="m-0 text-card-metadata sm:text-[13px] sm:leading-[18px] text-[var(--text-primary)]">
                {title}
                {detail && !detailBelow && <span className="ml-2 text-[var(--text-muted)]">{detail}</span>}
              </p>
              {detail && detailBelow && <p className="m-0 text-card-metadata text-[var(--text-muted)]">{detail}</p>}
            </div>
            <span className="pt-1.5 text-card-metadata text-[var(--text-muted)] whitespace-nowrap">{time}</span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}
