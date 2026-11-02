import type { ServiceType } from "@/lib/jobsData";

export type CheckItem = { label: string; mandatory: boolean; sop?: string };
export type Sop = { id: string; title: string; steps: string[] };

/** Safety steps every visit starts with, then the checks for the trade. Mandatory steps must be ticked before a job can be completed. */
const COMMON_START: CheckItem[] = [
  { label: "Site check-in done and area made safe", mandatory: true, sop: "safety" },
];
const COMMON_END: CheckItem[] = [
  { label: "Work area cleaned and waste removed", mandatory: false },
  { label: "Customer shown the work and test result", mandatory: true },
];

export const CHECKLISTS: Record<ServiceType, CheckItem[]> = {
  HVAC: [
    ...COMMON_START,
    { label: "Isolate power and lock out the unit", mandatory: true, sop: "loto" },
    { label: "Inspect filters, belts and coils", mandatory: true, sop: "hvac" },
    { label: "Clean or replace filters", mandatory: false, sop: "hvac" },
    { label: "Check refrigerant pressure and airflow", mandatory: true, sop: "hvac" },
    { label: "Test cooling and heating cycle", mandatory: true },
    ...COMMON_END,
  ],
  Mechanical: [
    ...COMMON_START,
    { label: "Isolate power and lock out the equipment", mandatory: true, sop: "loto" },
    { label: "Inspect belts, bearings and oil level", mandatory: true },
    { label: "Check temperature and vibration", mandatory: true },
    { label: "Replace worn parts", mandatory: false },
    { label: "Run under load and record readings", mandatory: true },
    ...COMMON_END,
  ],
  Plumbing: [
    ...COMMON_START,
    { label: "Shut off and drain the affected line", mandatory: true },
    { label: "Locate and repair the leak or fault", mandatory: true },
    { label: "Pressure test the repaired section", mandatory: true },
    { label: "Check surrounding joints and fixtures", mandatory: false },
    ...COMMON_END,
  ],
  Electrical: [
    ...COMMON_START,
    { label: "Isolate supply and test dead before touching", mandatory: true, sop: "loto" },
    { label: "Inspect panel, breakers and connections", mandatory: true, sop: "electrical" },
    { label: "Thermal scan or insulation test", mandatory: false, sop: "electrical" },
    { label: "Repair or replace faulty components", mandatory: false },
    { label: "Re-energise and verify readings", mandatory: true },
    ...COMMON_END,
  ],
  Preventive: [
    ...COMMON_START,
    { label: "Inspect all equipment on the plan", mandatory: true },
    { label: "Clean, lubricate and adjust", mandatory: true },
    { label: "Test each item and record the result", mandatory: true },
    { label: "Note any recommended follow-up work", mandatory: false },
    ...COMMON_END,
  ],
  Elevator: [
    ...COMMON_START,
    { label: "Place car out of service and signpost the landing", mandatory: true, sop: "lift" },
    { label: "Check doors, sensors and landing locks", mandatory: true, sop: "lift" },
    { label: "Check ropes, guide shoes and lubrication", mandatory: true, sop: "lift" },
    { label: "Run safety tests and emergency stop", mandatory: true, sop: "lift" },
    ...COMMON_END,
  ],
};

export const SOPS: Record<string, Sop> = {
  safety: { id: "safety", title: "Site safety and check-in", steps: ["Tell the site contact you have arrived.", "Wear the required PPE for the area.", "Mark off the work area with signs or tape.", "Note any hazards in the job notes before starting."] },
  loto: { id: "loto", title: "Lock-out / tag-out", steps: ["Identify every energy source for the equipment.", "Switch off and isolate each source.", "Fit your personal lock and tag.", "Try to start the equipment to prove it is dead.", "Only remove your own lock when the work is finished."] },
  hvac: { id: "hvac", title: "Rooftop and air-handling unit service", steps: ["Photograph the unit plate and the filters before work.", "Check belt tension and wear.", "Clean coils from the clean side outwards.", "Replace filters with the correct size and airflow direction.", "Record supply and return temperatures after the test run."] },
  electrical: { id: "electrical", title: "Panel inspection", steps: ["Open the panel only after isolation is confirmed.", "Look for burn marks, loose lugs and heat damage.", "Torque connections to the marked values.", "Record the load on each phase.", "Photograph the labelled panel before closing it."] },
  lift: { id: "lift", title: "Lift safety inspection", steps: ["Put the car out of service and place barriers at every landing.", "Inspect door tracks, sensors and landing locks.", "Check rope condition and lubricate guide shoes.", "Test the emergency stop, alarm and intercom.", "Record results for the inspection certificate."] },
};

export const checklistFor = (type: ServiceType): CheckItem[] => CHECKLISTS[type] ?? CHECKLISTS.Preventive;
/** Labels of mandatory steps not yet ticked. */
export const missingMandatory = (type: ServiceType, checks: boolean[] | undefined) =>
  checklistFor(type).filter((c, i) => c.mandatory && !checks?.[i]).map(c => c.label);
