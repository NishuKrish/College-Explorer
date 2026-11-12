export const plannerKey = "dream-campus.application-planner.v1";
export const stages = ["Not started", "In progress", "Submitted", "Decision received"] as const;
export type ApplicationStage = typeof stages[number];
export type ApplicationTask = { id: string; label: string; done: boolean };
export type ApplicationPlan = { deadline: string; visitDate: string; stage: ApplicationStage; tasks: ApplicationTask[] };
export type PlannerState = Record<string, ApplicationPlan>;
export function defaultPlan(): ApplicationPlan {
  return { deadline: "", visitDate: "", stage: "Not started", tasks: ["Application form", "Personal essay", "Supplemental essays", "Transcript", "Recommendation letters"].map((label, index) => ({ id: `default-${index}`, label, done: false })) };
}
export function validDate(value: unknown): value is string {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0,10) === value;
}
export function parsePlanner(raw: string | null): PlannerState {
  if (!raw) return {};
  try {
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const result: PlannerState = {};
    for (const [id, value] of Object.entries(input).slice(0, 150)) {
      if (!/^\d+$/.test(id) || !value || typeof value !== "object") continue;
      const plan = value as Partial<ApplicationPlan>;
      if (!validDate(plan.deadline) || !validDate(plan.visitDate) || !stages.includes(plan.stage as ApplicationStage) || !Array.isArray(plan.tasks)) continue;
      const ids = new Set<string>();
      const tasks = plan.tasks.filter((task): task is ApplicationTask => {
        if (!task || typeof task.id !== "string" || task.id.length > 80 || ids.has(task.id) || typeof task.label !== "string" || !task.label.trim() || task.label.length > 120 || typeof task.done !== "boolean") return false;
        ids.add(task.id); return true;
      }).slice(0, 25);
      result[id] = { deadline: plan.deadline, visitDate: plan.visitDate, stage: plan.stage as ApplicationStage, tasks };
    }
    return result;
  } catch { return {}; }
}
export function dateLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
