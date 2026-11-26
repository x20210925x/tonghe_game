import * as T from '../../assets/three.module.min.js';
import { ARCHIVE_SPOTS } from '../game/layout.js';
import { chapterOf } from '../game/lore.js';

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,214,160,1)');
  r.addColorStop(0.25, 'rgba(255,150,80,.55)');
  r.addColorStop(1, 'rgba(255,120,60,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}

// Archive cases: a steel lectern with an orange-tagged folder and a soft beacon until read.
// a1 lies on the duty desk and a2 on the bench, so they need no stand.
export function buildPickups(b) {
  const { scene, mat } = b;
  const tex = glowTexture();
  const items = {};
  for (const [id, spot] of Object.entries(ARCHIVE_SPOTS)) {
    const resting = id === 'a1' ? 1.02 : id === 'a2' ? 0.48 : null;
    const top = resting ?? spot.base + 1.02;
    if (resting === null) {
      b.box(spot.x, spot.base + 0.48, spot.z, 0.36, 0.96, 0.36, mat.enamel, { camera: false });
      b.box(spot.x, spot.base + 0.99, spot.z, 0.62, 0.06, 0.48, mat.iron);
      b.box(spot.x, spot.base + 0.02, spot.z, 0.6, 0.04, 0.6, mat.iron);
    }
    const folder = new T.Group();
    folder.position.set(spot.x, top, spot.z);
    folder.rotation.y = (spot.x * 13.1 + spot.z * 7.7) % Math.PI;
    scene.add(folder);
    b.part(folder, 0, 0.012, 0, 0.32, 0.024, 0.42, mat.ochreDark);
    b.part(folder, 0, 0.028, 0, 0.29, 0.01, 0.39, mat.paper);
    b.part(folder, 0.13, 0.03, -0.15, 0.06, 0.012, 0.1, mat.ochre);
    const glow = new T.Sprite(
      new T.SpriteMaterial({ map: tex, color: 0xffb070, transparent: true, depthWrite: false, blending: T.AdditiveBlending })
    );
    glow.position.set(spot.x, top + 0.35, spot.z);
    glow.scale.set(0.9, 0.9, 1);
    scene.add(glow);
    items[id] = { folder, glow, base: top + 0.35, pos: [spot.x, top, spot.z] };
  }
  return {
    items,
    update(time, site) {
      for (const [id, it] of Object.entries(items)) {
        // Another chapter's archives stay on their stands, unlit and closed to reading.
        const found = site.found(id) || chapterOf(id) !== site.chapter;
        it.glow.visible = !found;
        if (!found) {
          const p = 0.5 + 0.5 * Math.sin(time * 2.2 + it.pos[0]);
          it.glow.position.y = it.base + 0.06 * p;
          it.glow.material.opacity = 0.55 + 0.4 * p;
          it.glow.scale.setScalar(0.7 + 0.25 * p);
        }
      }
    },
  };
}
