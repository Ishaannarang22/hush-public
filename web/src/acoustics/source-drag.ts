import type { SceneComponent } from "./matterport";
import type { OverlayState } from "./overlay";
import type { Point } from "./field";

// Parent-page handles stay above the iframe, so dragging a source never pans
// Showcase. Empty space still passes through to its normal camera controls.
export function sourceDragHandles(
  context: SceneComponent["context"],
  state: () => OverlayState,
  container: HTMLElement,
  onMove: (id: string, point: Point) => void,
) {
  const THREE = context.three;
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
  const hit = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const inverseViewProjection = new THREE.Matrix4();
  const farPoint = new THREE.Vector3();
  const buttons = new Map<string, HTMLButtonElement>();
  let drag: { id: string; pointer: number; offset: Point } | null = null;

  function floorPoint(e: PointerEvent): Point | null {
    const rect = container.getBoundingClientRect(),
      s = state();
    if (!rect.width || !rect.height) return null;
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
    // Showcase can replace the projection for floor-plan mode without updating
    // Three's inverse cache. Invert the matrices actually used to draw handles.
    inverseViewProjection
      .multiplyMatrices(
        context.camera.projectionMatrix,
        context.camera.matrixWorldInverse,
      )
      .invert();
    ray.ray.origin.set(x, y, -1).applyMatrix4(inverseViewProjection);
    farPoint.set(x, y, 1).applyMatrix4(inverseViewProjection);
    ray.ray.direction.copy(farPoint).sub(ray.ray.origin).normalize();
    // Match the sphere's height and undo the SDK floor-plan handedness.
    plane.constant = -(s.floor + 0.2);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x, z: hit.z / s.flipZ };
  }

  function tick() {
    const s = state(),
      width = container.clientWidth,
      height = container.clientHeight;
    for (const [id, button] of buttons) {
      if (!s.sources.some((source) => source.id === id)) {
        button.remove();
        buttons.delete(id);
        if (drag?.id === id) drag = null;
      }
    }
    for (const source of s.sources) {
      let button = buttons.get(source.id);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "lab-source-handle";
        button.title = `Drag ${source.name}; arrow keys move it 0.25 m`;
        button.setAttribute("aria-label", `Move ${source.name} source`);
        button.onpointerdown = (e) => {
          if (e.button !== 0 || drag) return;
          const p = floorPoint(e),
            current = state().sources.find((v) => v.id === source.id);
          if (!p || !current) return;
          e.preventDefault();
          e.stopPropagation();
          drag = {
            id: source.id,
            pointer: e.pointerId,
            offset: { x: current.x - p.x, z: current.z - p.z },
          };
          button!.setPointerCapture(e.pointerId);
          container.style.pointerEvents = "auto";
          container.style.touchAction = "none";
          button!.style.cursor = "grabbing";
        };
        button.onpointermove = (e) => {
          if (drag?.id !== source.id || drag.pointer !== e.pointerId) return;
          e.preventDefault();
          const p = floorPoint(e);
          if (p)
            onMove(source.id, {
              x: p.x + drag.offset.x,
              z: p.z + drag.offset.z,
            });
        };
        const end = (e: PointerEvent) => {
          if (drag?.id !== source.id || drag.pointer !== e.pointerId) return;
          if (e.type === "pointerup") {
            const p = floorPoint(e);
            if (p)
              onMove(source.id, {
                x: p.x + drag.offset.x,
                z: p.z + drag.offset.z,
              });
          }
          drag = null;
          container.style.pointerEvents = "none";
          container.style.touchAction = "";
          if (button!.hasPointerCapture(e.pointerId))
            button!.releasePointerCapture(e.pointerId);
          button!.style.cursor = "grab";
        };
        button.onpointerup = end;
        button.onpointercancel = end;
        button.onlostpointercapture = end;
        button.onkeydown = (e) => {
          const direction: Record<string, Point> = {
            ArrowLeft: { x: -0.25, z: 0 },
            ArrowRight: { x: 0.25, z: 0 },
            ArrowUp: { x: 0, z: -0.25 },
            ArrowDown: { x: 0, z: 0.25 },
          };
          const delta = direction[e.key],
            current = state().sources.find((v) => v.id === source.id);
          if (!delta || !current) return;
          e.preventDefault();
          onMove(source.id, { x: current.x + delta.x, z: current.z + delta.z });
        };
        buttons.set(source.id, button);
        container.append(button);
      }
      projected
        .set(source.x, s.floor + 0.2, source.z * s.flipZ)
        .project(context.camera);
      button.hidden =
        !s.visible ||
        projected.z < -1 ||
        projected.z > 1 ||
        Math.abs(projected.x) > 1 ||
        Math.abs(projected.y) > 1;
      button.style.left = `${((projected.x + 1) * width) / 2}px`;
      button.style.top = `${((1 - projected.y) * height) / 2}px`;
      button.style.backgroundColor = source.color;
      button.style.opacity = source.enabled ? "1" : ".45";
    }
  }
  return {
    tick,
    dispose() {
      drag = null;
      container.style.pointerEvents = "none";
      container.style.touchAction = "";
      buttons.forEach((button) => button.remove());
      buttons.clear();
    },
  };
}
