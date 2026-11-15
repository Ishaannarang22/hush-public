import exported from "../../../../samples/lab_sources.zzvymDx5ty7.json";
import survey from "../../../../samples/windows.zzvymDx5ty7.json";
import targetData from "../../../../samples/room_targets.zzvymDx5ty7.json";
import savedApartment from "../../../../samples/matterport_model_zzvymDx5ty7.json";
import yaleData from "../../../../samples/levels.yale.json";
import { EnvironmentalSourceAdapter, type TimeBlock } from "./sources";
import { parseOpeningDataset } from "../engine/importer";
import type { ApiRoom } from "../matterport";

export const APARTMENT_ID = "zzvymDx5ty7";
export const modelSources = new EnvironmentalSourceAdapter(
  exported,
  APARTMENT_ID,
);
export const measuredOpenings = parseOpeningDataset(
  JSON.stringify(survey),
  APARTMENT_ID,
).openings.map((o) => ({ ...o, state: "closed" as const }));
export const savedRooms = savedApartment.data.model.rooms as ApiRoom[];
export type RoomTarget = {
  name: string;
  blocks: Record<
    TimeBlock,
    { dba: number | null; range_dba: (number | null)[] | null }
  >;
};
export const roomTargets = targetData.rooms as Record<string, RoomTarget>;
export const yaleRoomTargets = yaleData.rooms as RoomTarget[];
