import { createCollectionStorage } from "./collectionStorage";
import { NOTIFICATIONS } from "../data/notificationsData";

const notificationsStore = createCollectionStorage("notifications", NOTIFICATIONS);

export const loadNotifications = notificationsStore.load;
export const persistNotificationsIndex = notificationsStore.persistIndex;
export const persistNotification = notificationsStore.persistItem;
export const deleteNotification = notificationsStore.deleteItem;
