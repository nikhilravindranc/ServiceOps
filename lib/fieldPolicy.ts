import type { ServiceType } from "@/lib/jobsData";

/**
 * Company rules for field exceptions, in one place. Safe to import from the browser and the server (no data access).
 * When these become company settings, only this file has to change.
 */

/** Charged when a visit fails because of the customer (no access, nobody there). Dollars, before tax. */
export const CALL_OUT_FEE = 95;

/** Today a technician only asks for extra work; the office creates the work order. Switch on to allow it directly (not built yet). */
export const techCanCreateWork = false;

/** Why a visit could not be finished. "Other" needs a note; the others do not. */
export const FAIL_REASONS = ["No access", "Customer absent", "Part missing", "Unsafe to continue", "Equipment needs more work", "Other"] as const;
export type FailReason = typeof FAIL_REASONS[number];

/** What the office suggests for each reason; the Dispatcher can always choose differently. */
export const DEFAULT_FOLLOW_UP: Record<FailReason, FollowUpAction> = {
  "No access": "Rebook with call-out fee",
  "Customer absent": "Rebook with call-out fee",
  "Part missing": "Rebook free",
  "Unsafe to continue": "Rebook free",
  "Equipment needs more work": "Rebook free",
  Other: "Rebook free",
};

export const FOLLOW_UP_ACTIONS = ["Rebook free", "Rebook with call-out fee", "Charge call-out fee only", "Cancel"] as const;
export type FollowUpAction = typeof FOLLOW_UP_ACTIONS[number];
export const followUpRebooks = (a: FollowUpAction) => a === "Rebook free" || a === "Rebook with call-out fee";
export const followUpCharges = (a: FollowUpAction) => a === "Rebook with call-out fee" || a === "Charge call-out fee only";

/** Sign-off options at the end of a job. Only "customer" and "other" carry a signature. */
export const SIGN_OFF_KINDS = ["customer", "other", "refused", "unattended"] as const;
export type SignOffKind = typeof SIGN_OFF_KINDS[number];
export const SIGN_OFF_LABEL: Record<SignOffKind, string> = {
  customer: "Signed by the customer",
  other: "Signed by another person on site",
  refused: "Customer refused to sign",
  unattended: "Nobody on site, work completed unattended",
};

/** Job types where work may be done with nobody on site (a simple flag per trade). */
export const UNATTENDED_ALLOWED: Record<ServiceType, boolean> = {
  HVAC: true, Mechanical: true, Preventive: true, Plumbing: false, Electrical: false, Elevator: false,
};

export const URGENCIES = ["Low", "Normal", "Urgent"] as const;
export type Urgency = typeof URGENCIES[number];
