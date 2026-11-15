import { useMemo, useState } from "react";
import survey from "./data/yale-facades.json";
import { MATERIALS } from "./engine/materials";
import { AcousticMaterial, OCTAVES } from "./engine/domain";
import { FacadeAssembly } from "./engine/facade";
export default function MeasuredFacadePanel() {
  const [id, setId] = useState("living-n-glazing"),
    [open, setOpen] = useState(false),
    [materialId, setMaterialId] = useState("concrete");
  const facade = survey.facades.find((f) => f.id === id)!;
  const assembly = useMemo(
    () =>
      new FacadeAssembly(
        facade.widthM,
        facade.heightM,
        new AcousticMaterial(MATERIALS.find((m) => m.id === materialId)!),
        facade.openings.map((o) => ({
          id: o.id,
          widthM: o.widthM,
          heightM: o.heightM,
          open,
          material: new AcousticMaterial(
            MATERIALS.find((m) => m.id === "glass")!,
          ),
        })),
      ),
    [facade, materialId, open],
  );
  return (
    <details className="lab-notes">
      <summary>Measured Yale window dataset</summary>
      <p>
        <strong>{survey.propertyName}</strong> · a different property from the
        displayed apartment.
      </p>
      <p>
        Measured from scan elevations, with reported uncertainty ±
        {survey.measurementUncertaintyM * 100} cm. Window positions still need
        registration before this dataset can drive a spatial grid.
      </p>
      <label>
        Measured facade
        <select
          aria-label="Measured facade"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          {survey.facades.map((f) => (
            <option key={f.id} value={f.id}>
              {f.id}
            </option>
          ))}
        </select>
      </label>
      <p>
        Wall: {facade.widthM.toFixed(2)} × {facade.heightM.toFixed(2)} m. Glazed
        opening area: {assembly.openingAreaM2.toFixed(2)} m².
      </p>
      {facade.openings.map((o) => (
        <p key={o.id}>
          {o.kind}: {o.widthM.toFixed(2)} × {o.heightM.toFixed(2)} m; sill{" "}
          {o.sillM.toFixed(2)} m.
        </p>
      ))}
      <label>
        Facade wall · assumed
        <select
          aria-label="Facade wall material"
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
        >
          <option value="concrete">Concrete</option>
          <option value="plasterboard">Plasterboard</option>
        </select>
      </label>
      <button
        className="lab-reset"
        aria-pressed={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Open apertures" : "Closed single glazing"}
      </button>
      <table className="lab-material-table">
        <caption>Composite facade reduction · assumed materials</caption>
        <thead>
          <tr>
            <th>Hz</th>
            <th>Reduction dB</th>
          </tr>
        </thead>
        <tbody>
          {assembly.transmissionLossDb().map((n, i) => (
            <tr key={i}>
              <td>{OCTAVES[i]}</td>
              <td>{n.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        This area-weighted calculation uses the measured dimensions. It is a
        facade reduction estimate, not an indoor sound level; it does not alter
        the other apartment’s grid.
      </p>
    </details>
  );
}
