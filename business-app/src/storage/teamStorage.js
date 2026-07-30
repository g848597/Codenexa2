import { createCollectionStorage } from "./collectionStorage";
import { TEAM } from "../data/teamData";

const teamStore = createCollectionStorage("team", TEAM);

export const loadTeam = teamStore.load;
export const persistTeamIndex = teamStore.persistIndex;
export const persistTeamMember = teamStore.persistItem;
export const deleteTeamMember = teamStore.deleteItem;
