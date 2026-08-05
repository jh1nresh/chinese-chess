import * as THREE from "three";

import type { Faction, PieceKind } from "../core/types";

/**
 * 楚漢相爭 armies — hand-authored low-poly figures for the Chu-Han contention
 * (項羽 vs 劉邦, ~203 BC), the war the river inscription 楚河漢界 names.
 *
 * 紅方 = 楚軍: 楚人尚赤 — vermilion robes, bronze lamellar, the overlord in a
 * 鶡冠 with twin pheasant plumes carrying a 戟.
 * 黑方 = 漢軍: 漢承秦制尚黑 — ink robes, iron lamellar, 劉邦 in his own 長冠
 * (the "劉氏冠") carrying a 劍.
 * Soldiers wear the era's topknot and head-wrap over 札甲 — no anachronistic
 * conical hats — and the 炮 rank is a traction stone-thrower (砲), the actual
 * siege engine of the period.
 *
 * Figures are authored roughly 1.4–2.0 units tall and rescaled by the
 * factory's normalize step. Every material carries `userData.keepLook` so the
 * shared-sculpt faction re-tint leaves the painted colours alone, and every
 * root carries `userData.noProps` so no western weapon props are attached.
 */

interface Colourway {
  robe: number;
  robeTrim: number;
  armour: number;
  skin: number;
  cloth: number;
  metal: number;
  tassel: number;
  wood: number;
}

const COLOURS: Record<Faction, Colourway> = {
  // 楚 — authored darker than intent; the halls' warm key light and ACES
  // tone mapping lift everything roughly one stop.
  w: {
    robe: 0x821712,
    robeTrim: 0xa87a28,
    armour: 0x54351c,
    skin: 0xb98d62,
    cloth: 0x8f1d15,
    metal: 0x71717a,
    tassel: 0xa01f16,
    wood: 0x5a3d24,
  },
  // 漢
  b: {
    robe: 0x191b21,
    robeTrim: 0x6e5c33,
    armour: 0x272930,
    skin: 0xa87e56,
    cloth: 0x22242b,
    metal: 0x53535c,
    tassel: 0x8f7432,
    wood: 0x453222,
  },
};

function standard(color: number, roughness = 0.62, metalness = 0.08): THREE.MeshStandardMaterial {
  // Surface response mirrors applyFactionLook's tinted sculpts: a tighter
  // roughness band and a same-hue emissive floor keep the authored hue from
  // being washed toward violet by the halls' cool ambient light.
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: Math.min(roughness, 0.45),
    metalness: Math.max(metalness, 0.1),
    emissive: new THREE.Color(color).multiplyScalar(0.35),
    emissiveIntensity: 0.05,
    envMapIntensity: 0.6,
  });
  material.userData.keepLook = true;
  return material;
}

/** 曲裾深衣 — the wrapped robe: wide hem, narrow shoulders, sash at the waist. */
function addRobe(group: THREE.Group, c: Colourway, height: number, hemRadius: number): void {
  const robe = new THREE.Mesh(
    new THREE.CylinderGeometry(hemRadius * 0.55, hemRadius, height, 14),
    standard(c.robe, 0.72, 0.02),
  );
  robe.position.y = height / 2;
  group.add(robe);

  const sash = new THREE.Mesh(
    new THREE.TorusGeometry(hemRadius * 0.72, 0.028, 8, 20),
    standard(c.robeTrim, 0.45, 0.25),
  );
  sash.rotation.x = Math.PI / 2;
  sash.position.y = height * 0.58;
  group.add(sash);
}

/** 札甲 — lamellar bands over the torso, with 披膊 shoulder guards. */
function addLamellar(group: THREE.Group, c: Colourway, baseY: number, radius: number): void {
  for (let band = 0; band < 3; band += 1) {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(radius - band * 0.012, radius + 0.012 - band * 0.012, 0.085, 12),
      standard(c.armour, 0.5, 0.28),
    );
    plate.position.y = baseY + band * 0.095;
    group.add(plate);
  }
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), standard(c.armour, 0.5, 0.28));
    pauldron.position.set(side * (radius + 0.05), baseY + 0.3, 0);
    group.add(pauldron);
  }
}

function addHead(group: THREE.Group, c: Colourway, y: number, scale = 1): THREE.Mesh {
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 14, 12), standard(c.skin, 0.55, 0));
  head.position.y = y;
  group.add(head);
  return head;
}

/** 髮髻與幘巾 — the era's topknot bun over a cloth head-wrap band. */
function addTopknot(group: THREE.Group, c: Colourway, headY: number, z = 0): void {
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.055, 12), standard(c.cloth, 0.8, 0));
  wrap.position.set(0, headY + 0.075, z);
  group.add(wrap);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), standard(0x1c1712, 0.8, 0));
  bun.position.set(0, headY + 0.14, z - 0.03);
  group.add(bun);
}

function addArms(group: THREE.Group, c: Colourway, shoulderY: number, spread: number): void {
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.26, 4, 8), standard(c.robe, 0.7, 0.02));
    arm.position.set(side * spread, shoulderY - 0.16, 0.01);
    arm.rotation.z = side * 0.3;
    group.add(arm);
  }
}

/** 長戟 — the ge-halberd: spear point plus a side blade, tasselled. */
function addHalberd(group: THREE.Group, c: Colourway, x: number, totalHeight: number): void {
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, totalHeight, 8),
    standard(c.wood, 0.7, 0.05),
  );
  shaft.position.set(x, totalHeight / 2, 0.06);
  group.add(shaft);
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.15, 8), standard(c.metal, 0.35, 0.75));
  point.position.set(x, totalHeight + 0.075, 0.06);
  group.add(point);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.015), standard(c.metal, 0.35, 0.75));
  blade.position.set(x + 0.05, totalHeight - 0.06, 0.06);
  group.add(blade);
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 8), standard(c.tassel, 0.85, 0));
  tassel.position.set(x, totalHeight - 0.14, 0.06);
  tassel.rotation.x = Math.PI;
  group.add(tassel);
}

/** 卒／兵 — line infantry: topknot, 札甲, halberd at the ready. */
function buildSoldier(c: Colourway): THREE.Group {
  const group = new THREE.Group();
  addRobe(group, c, 1.06, 0.34);
  addLamellar(group, c, 0.66, 0.21);
  addArms(group, c, 1.06, 0.24);
  const head = addHead(group, c, 1.2);
  addTopknot(group, c, head.position.y);
  addHalberd(group, c, 0.3, 1.5);
  return group;
}

/** 帥 — 項羽: 鶡冠 twin plumes, heavy lamellar, war cloak, the overlord's 戟. */
function buildXiangYu(c: Colourway): THREE.Group {
  const group = new THREE.Group();
  addRobe(group, c, 1.3, 0.42);
  addLamellar(group, c, 0.78, 0.27);

  const cloak = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.44, 1.1, 12, 1, true, Math.PI * 0.75, Math.PI * 0.5),
    standard(c.cloth, 0.75, 0.05),
  );
  cloak.material.side = THREE.DoubleSide;
  cloak.position.y = 0.72;
  group.add(cloak);

  addArms(group, c, 1.3, 0.3);
  const head = addHead(group, c, 1.46, 1.1);

  // 鶡冠 — war crown with two pheasant plumes sweeping up and outward.
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), standard(c.armour, 0.45, 0.35));
  helm.position.y = head.position.y + 0.05;
  group.add(helm);
  const brow = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.04, 12), standard(c.robeTrim, 0.4, 0.4));
  brow.position.y = head.position.y + 0.06;
  group.add(brow);
  for (const side of [-1, 1]) {
    const plume = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.34, 4, 8), standard(c.tassel, 0.85, 0));
    plume.position.set(side * 0.12, head.position.y + 0.34, -0.03);
    plume.rotation.z = side * -0.35;
    group.add(plume);
  }

  addHalberd(group, c, 0.34, 1.8);
  return group;
}

/** 將 — 劉邦: the 長冠 he invented (劉氏冠), imperial robe, hand on his 劍. */
function buildLiuBang(c: Colourway): THREE.Group {
  const group = new THREE.Group();
  addRobe(group, c, 1.3, 0.42);

  // Imperial over-robe band instead of heavy armour: 帝王氣, not brute force.
  const mantle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.34, 0.5, 12),
    standard(c.robeTrim, 0.6, 0.15),
  );
  mantle.position.y = 0.95;
  group.add(mantle);

  addArms(group, c, 1.3, 0.3);
  const head = addHead(group, c, 1.46, 1.1);

  // 長冠 — the tall, back-swept board cap.
  const capBase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.125, 0.06, 10), standard(0x17140f, 0.5, 0.15));
  capBase.position.y = head.position.y + 0.11;
  group.add(capBase);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.05), standard(0x17140f, 0.5, 0.15));
  board.position.set(0, head.position.y + 0.28, -0.06);
  board.rotation.x = 0.35;
  group.add(board);

  // 佩劍 held point-down at the sash.
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.02), standard(c.metal, 0.3, 0.8));
  blade.position.set(0.08, 0.62, 0.17);
  group.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.045), standard(c.robeTrim, 0.35, 0.5));
  guard.position.set(0.08, 0.94, 0.17);
  group.add(guard);

  return group;
}

/** 仕／士 — 謀士 (范增 / 張良): scholar in a 進賢冠 with folded sleeves. */
function buildAdvisor(c: Colourway): THREE.Group {
  const group = new THREE.Group();
  addRobe(group, c, 1.18, 0.36);
  const sleeves = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 6, 10), standard(c.robe, 0.75, 0.02));
  sleeves.rotation.z = Math.PI / 2;
  sleeves.position.set(0, 0.82, 0.16);
  group.add(sleeves);
  const head = addHead(group, c, 1.32);
  // 進賢冠 — the forward-sloping scholar's wedge.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.2), standard(0x17140f, 0.55, 0.1));
  cap.position.set(0, head.position.y + 0.16, -0.02);
  cap.rotation.x = -0.35;
  group.add(cap);
  return group;
}

/** 相／象 — armoured commandery official with an elephant-crest helm. */
function buildMinister(c: Colourway): THREE.Group {
  const group = new THREE.Group();
  addRobe(group, c, 1.1, 0.4);
  addLamellar(group, c, 0.6, 0.26);
  const head = addHead(group, c, 1.24);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), standard(c.armour, 0.45, 0.3));
  helm.position.y = head.position.y + 0.08;
  group.add(helm);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.3, 8), standard(c.armour, 0.45, 0.3));
  trunk.position.set(0, head.position.y + 0.16, 0.14);
  trunk.rotation.x = 0.9;
  group.add(trunk);
  for (const side of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.18, 8), standard(0xe8ddc4, 0.35, 0.1));
    tusk.position.set(side * 0.14, head.position.y + 0.02, 0.12);
    tusk.rotation.x = 1.15;
    group.add(tusk);
  }
  return group;
}

/** 馬／傌 — cavalry: topknotted rider on an armoured horse. */
function buildHorse(c: Colourway): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 12), standard(c.armour, 0.6, 0.1));
  body.rotation.z = Math.PI / 2;
  body.rotation.y = Math.PI / 2;
  body.position.y = 0.5;
  group.add(body);
  for (const [x, z] of [
    [-0.12, 0.16],
    [0.12, 0.16],
    [-0.12, -0.16],
    [0.12, -0.16],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.5, 8), standard(0x2b2118, 0.7, 0.05));
    leg.position.set(x, 0.25, z);
    group.add(leg);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.5, 10), standard(c.armour, 0.6, 0.1));
  neck.position.set(0, 0.86, 0.3);
  neck.rotation.x = -0.5;
  group.add(neck);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.26, 8), standard(c.armour, 0.6, 0.1));
  muzzle.position.set(0, 1.06, 0.5);
  muzzle.rotation.x = -1.25;
  group.add(muzzle);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), standard(c.armour, 0.6, 0.1));
    ear.position.set(side * 0.06, 1.16, 0.36);
    group.add(ear);
  }
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.34, 0.14), standard(c.tassel, 0.8, 0));
  mane.position.set(0, 0.98, 0.26);
  mane.rotation.x = -0.5;
  group.add(mane);
  const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 6, 10), standard(c.robe, 0.7, 0.02));
  rider.position.set(0, 0.95, -0.12);
  group.add(rider);
  const riderHead = addHead(group, c, 1.28, 0.85);
  riderHead.position.z = -0.12;
  addTopknot(group, c, 1.26, -0.12);
  return group;
}

/** 車／俥 — the war chariot: crenellated tower, faction pennant, spoked wheels. */
function buildChariot(c: Colourway): THREE.Group {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.44), standard(c.armour, 0.6, 0.15));
  hull.position.y = 0.62;
  group.add(hull);
  for (const side of [-1, -0.33, 0.33, 1]) {
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.44), standard(c.armour, 0.6, 0.15));
    merlon.position.set(side * 0.2, 0.99, 0);
    group.add(merlon);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.8, 8), standard(c.wood, 0.7, 0.05));
  pole.position.set(0, 1.3, 0);
  group.add(pole);
  const pennant = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.012), standard(c.tassel, 0.8, 0));
  pennant.position.set(0.14, 1.56, 0);
  group.add(pennant);
  for (const side of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 18), standard(0x2b2118, 0.65, 0.1));
    wheel.position.set(side * 0.3, 0.24, 0);
    wheel.rotation.y = Math.PI / 2;
    group.add(wheel);
    const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), standard(c.robeTrim, 0.4, 0.4));
    hubcap.rotation.z = Math.PI / 2;
    hubcap.position.set(side * 0.3, 0.24, 0);
    group.add(hubcap);
  }
  return group;
}

/** 炮／砲 — the traction stone-thrower (砲) with its loader crew. */
function buildStoneThrower(c: Colourway): THREE.Group {
  const group = new THREE.Group();
  // Crew figure, slightly off-centre, hauling the ropes.
  const crew = new THREE.Group();
  addRobe(crew, c, 0.94, 0.28);
  addLamellar(crew, c, 0.56, 0.18);
  const head = addHead(crew, c, 1.06);
  addTopknot(crew, c, head.position.y);
  crew.position.x = -0.26;
  group.add(crew);

  // A-frame timber base.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.85, 8), standard(c.wood, 0.75, 0.05));
    strut.position.set(0.2, 0.42, side * 0.16);
    strut.rotation.x = side * 0.35;
    group.add(strut);
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), standard(c.wood, 0.75, 0.05));
  axle.rotation.x = Math.PI / 2;
  axle.position.set(0.2, 0.78, 0);
  group.add(axle);
  // Throwing arm cocked back, sling cradling a stone.
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1.0, 8), standard(c.wood, 0.75, 0.05));
  arm.position.set(0.2, 0.82, 0);
  arm.rotation.z = -0.9;
  group.add(arm);
  const stone = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), standard(0x6f6a60, 0.85, 0.02));
  stone.position.set(0.62, 1.14, 0);
  group.add(stone);
  const counterRopes = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), standard(c.tassel, 0.85, 0));
  counterRopes.position.set(-0.16, 0.6, 0);
  counterRopes.rotation.z = 0.5;
  group.add(counterRopes);
  return group;
}

const BUILDERS: Record<PieceKind, (c: Colourway, faction: Faction) => THREE.Group> = {
  p: (c) => buildSoldier(c),
  k: (c, faction) => (faction === "w" ? buildXiangYu(c) : buildLiuBang(c)),
  q: (c) => buildAdvisor(c),
  b: (c) => buildMinister(c),
  n: (c) => buildHorse(c),
  r: (c) => buildChariot(c),
  c: (c) => buildStoneThrower(c),
};

/** One hand-authored Chu-Han figure; sized in author units, normalized later. */
export function buildChineseFigure(kind: PieceKind, faction: Faction): THREE.Object3D {
  const group = BUILDERS[kind](COLOURS[faction], faction);
  group.userData.noProps = true;
  return group;
}
