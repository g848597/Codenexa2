import { createCollectionStorage } from "./collectionStorage";
import { TASKS } from "../data/tasksData";

const tasksStore = createCollectionStorage("tasks", TASKS);

export const loadTasks = tasksStore.load;
export const persistTasksIndex = tasksStore.persistIndex;
export const persistTask = tasksStore.persistItem;
export const deleteTask = tasksStore.deleteItem;
