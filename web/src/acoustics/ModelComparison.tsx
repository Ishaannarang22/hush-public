import { useMemo } from "react";
import {
  roomTargets,
  yaleRoomTargets,
  type RoomTarget,
} from "./integration/datasets";
import { TIME_BLOCKS, type TimeBlock } from "./integration/sources";
import { roomMeans } from "./integration/comparison";
import type { SpectralField } from "./engine/grid";
import type { RegionData } from "./engine/domain";
const level = (n: number | null | undefined) =>
  n == null ? "—" : n.toFixed(1);
export default function ModelComparison({
  field,
  regions,
  block,
  modified,
  freshTargets,
  current,
}: {
  field: SpectralField | null;
  regions: RegionData[];
  block: TimeBlock;
  modified: boolean;
  freshTargets?: Record<string, RoomTarget>;
  current?: boolean;
}) {
  const means = useMemo(() => roomMeans(field, regions), [field, regions]);
  return (
    <details className="lab-notes">
      <summary>Room predictions · 2 properties</summary>
      <p>Volterra at West Lake · {TIME_BLOCKS[block]}</p>
      <p>
        {freshTargets
          ? current
            ? "Fresh octave-band room balance. "
            : "Previous run; recalculating current settings. "
          : "Saved baseline while the model starts. "}
        The grid averages the listening-height slice; the room balance estimates
        a diffuse room mean. They are separate predictions and are never added
        together.
        {modified
          ? " Edited or demo sources affect the grid only; the room balance uses the emission inputs."
          : ""}
      </p>
      <table className="lab-material-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Grid dBA</th>
            <th>{freshTargets ? "Room balance dBA" : "Saved dBA"}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(freshTargets ?? roomTargets).map(([id, r]) => (
            <tr key={id}>
              <td>{r.name}</td>
              <td>{level(means[id])}</td>
              <td>{level(r.blocks[block].dba)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Combined predictions have no calibrated confidence interval. The earlier
        field test validates its original model and configuration.
      </p>
      <p>
        2125 Yale · reference predictions only. Its window survey is available
        below; wall registration is still needed for a spatial grid.
      </p>
      <table className="lab-material-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Reference dBA</th>
          </tr>
        </thead>
        <tbody>
          {yaleRoomTargets.map((r, i) => (
            <tr key={i}>
              <td>{r.name}</td>
              <td>{level(r.blocks[block].dba)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
