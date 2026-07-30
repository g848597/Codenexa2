import { createCollectionStorage } from "./collectionStorage";
import { CONTENT_IDEAS } from "../data/marketingData";

const marketingStore = createCollectionStorage("marketing", CONTENT_IDEAS);

export const loadContentIdeas = marketingStore.load;
export const persistContentIdeasIndex = marketingStore.persistIndex;
export const persistContentIdea = marketingStore.persistItem;
export const deleteContentIdea = marketingStore.deleteItem;
