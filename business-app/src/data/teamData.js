/** Team roster and derived list of manager first names. */
import { genId } from "../utils/helpers";

export const TEAM_ROLES = ["Head of Sales", "Project Manager", "Product Designer", "Frontend Engineer", "Backend Engineer", "Marketing Manager"];

export const TEAM = [
  { id: genId("u"), name: "Айгерим Сабитова", role: "Head of Sales", kpi: 94, tasks: 6, salary: 420000, color: "#6E6AF6", kpiHistory: [82, 85, 88, 91, 94] },
  { id: genId("u"), name: "Тимур Ахметов", role: "Project Manager", kpi: 88, tasks: 9, salary: 380000, color: "#17D896", kpiHistory: [79, 81, 84, 86, 88] },
  { id: genId("u"), name: "Дана Оспанова", role: "Product Designer", kpi: 91, tasks: 5, salary: 350000, color: "#F2B84B", kpiHistory: [88, 87, 89, 90, 91] },
  { id: genId("u"), name: "Канат Ержанов", role: "Frontend Engineer", kpi: 82, tasks: 7, salary: 460000, color: "#22B8FF", kpiHistory: [75, 77, 79, 80, 82] },
];
export const MANAGERS = TEAM.map((m) => m.name.split(" ")[0]);
