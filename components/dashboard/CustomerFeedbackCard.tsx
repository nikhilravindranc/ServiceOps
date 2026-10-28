"use client";
import { Smiley, SmileyMeh, SmileySad } from "@phosphor-icons/react";
import DashboardSection, { ChevronLink, TONES, Tone } from "./DashboardSection";

const feedback: { label: string; value: number; tone: Tone; Icon: typeof Smiley }[] = [
  { label: "Happy",   value: 32, tone: "green", Icon: Smiley },
  { label: "Neutral", value: 4,  tone: "amber", Icon: SmileyMeh },
  { label: "Unhappy", value: 2,  tone: "red",   Icon: SmileySad },
];

export default function CustomerFeedbackCard() {
  return (
    <DashboardSection title="Customer feedback" headerRight={<ChevronLink href="/reports?r=first-time-fix" label="View customer feedback" />}>
      <div className="grid grid-cols-3 gap-2">
        {feedback.map(({ label, value, tone, Icon }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full" style={{ backgroundColor: TONES[tone].tint, color: TONES[tone].fg }}>
                <Icon size={28} weight="fill" />
              </span>
              <span className="text-h1 font-bold text-[var(--text-primary)]">{value}</span>
            </div>
            <span className="text-card-metadata text-[var(--text-muted)]">{label}</span>
          </div>
        ))}
      </div>
    </DashboardSection>
  );
}
