/** What kind of work a request is. The trade (HVAC, Electrical, …) is separate and says which team does it. */
export const WORK_TYPES = ["Installation", "Service", "Maintenance", "Repair", "Inspection"] as const;
export type WorkType = typeof WORK_TYPES[number];

export type DetailField = {
  key: string; label: string; kind: "text" | "textarea" | "select" | "date" | "number";
  required?: boolean; options?: string[]; hint?: string;
};

export const WORK_TYPE_INFO: Record<WorkType, { blurb: string; fields: DetailField[] }> = {
  Installation: {
    blurb: "New equipment to be fitted at the customer's site.",
    fields: [
      { key: "equipment", label: "Equipment to install", kind: "text", required: true, hint: "Make and model, e.g. Daikin VRV 12 kW" },
      { key: "quantity", label: "Quantity", kind: "number", required: true },
      { key: "siteReady", label: "Is the site ready?", kind: "select", required: true, options: ["Yes", "Partly", "No"] },
      { key: "permits", label: "Permits or approvals needed", kind: "select", required: true, options: ["None", "Customer arranges", "We arrange"] },
      { key: "targetDate", label: "Target completion date", kind: "date" },
    ],
  },
  Service: {
    blurb: "A routine or one-off service of existing equipment.",
    fields: [
      { key: "equipment", label: "Equipment", kind: "text", required: true, hint: "Name, tag or location of the equipment" },
      { key: "serviceRequested", label: "Service needed", kind: "select", required: true, options: ["Cleaning", "Tune-up", "Calibration", "Part replacement", "Other"] },
      { key: "lastServiced", label: "Last serviced", kind: "date" },
    ],
  },
  Maintenance: {
    blurb: "Planned preventive visit, usually under a service plan.",
    fields: [
      { key: "equipment", label: "Equipment covered", kind: "text", required: true },
      { key: "visitBasis", label: "Visit basis", kind: "select", required: true, options: ["Gold AMC visit", "Silver AMC visit", "Pay per visit"] },
      { key: "lastServiced", label: "Last maintenance", kind: "date" },
      { key: "checklistNeeds", label: "Checklist or access notes", kind: "textarea" },
    ],
  },
  Repair: {
    blurb: "Something is broken or not working properly.",
    fields: [
      { key: "equipment", label: "Faulty equipment", kind: "text", required: true },
      { key: "fault", label: "What is wrong?", kind: "textarea", required: true, hint: "Symptoms, noises, error codes, when it started" },
      { key: "equipmentDown", label: "Is the equipment out of action?", kind: "select", required: true, options: ["Yes, completely", "Partly working", "Still working"] },
      { key: "warranty", label: "Under warranty?", kind: "select", required: true, options: ["Yes", "No", "Not sure"] },
    ],
  },
  Inspection: {
    blurb: "A check, test or audit, often for compliance.",
    fields: [
      { key: "equipment", label: "What is being inspected", kind: "text", required: true },
      { key: "inspectionKind", label: "Inspection type", kind: "select", required: true, options: ["Safety", "Statutory / compliance", "Condition report", "Pre-purchase"] },
      { key: "certificate", label: "Certificate needed?", kind: "select", required: true, options: ["Yes", "No"] },
      { key: "deadline", label: "Compliance deadline", kind: "date" },
    ],
  },
};

/** Names of the required detail fields that are missing or blank. */
export function missingDetails(workType: WorkType, details: Record<string, string> | undefined): string[] {
  return WORK_TYPE_INFO[workType].fields.filter(f => f.required && !String(details?.[f.key] ?? "").trim()).map(f => f.label);
}

/** The details as readable label/value pairs, skipping blanks. */
export function detailPairs(workType: WorkType, details: Record<string, string> | undefined): [string, string][] {
  return WORK_TYPE_INFO[workType].fields.map(f => [f.label, String(details?.[f.key] ?? "").trim()] as [string, string]).filter(([, v]) => v);
}

export const parseDetails = (raw: string | null | undefined): Record<string, string> => {
  try { const v = raw ? JSON.parse(raw) : {}; return v && typeof v === "object" ? v : {}; } catch { return {}; }
};
