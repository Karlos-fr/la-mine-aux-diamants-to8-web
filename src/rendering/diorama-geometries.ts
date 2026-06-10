/**
 * Role: Regroupe les geometries speciales du rendu Diorama.
 * Scope: Fournit des primitives Three.js avec UV adaptees aux tiles TO8.
 * ISO: Ces geometries sont purement visuelles et ne portent aucune logique gameplay.
 * Notes: Les geometries standard Three.js restent creees directement dans le renderer.
 */

import * as THREE from "three";

/** Cree un diamant bipyramide dont chaque facette mappe une moitie de la tile diamant. */
export function createDiamondGeometry(radius: number, halfHeight: number): THREE.BufferGeometry {
  const top = new THREE.Vector3(0, halfHeight, 0);
  const bottom = new THREE.Vector3(0, -halfHeight, 0);
  const north = new THREE.Vector3(0, 0, -radius);
  const east = new THREE.Vector3(radius, 0, 0);
  const south = new THREE.Vector3(0, 0, radius);
  const west = new THREE.Vector3(-radius, 0, 0);
  const ring = [north, east, south, west];
  const positions: number[] = [];
  const uvs: number[] = [];

  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    pushDiamondFace(positions, uvs, top, current, next, "top");
    pushDiamondFace(positions, uvs, bottom, next, current, "bottom");
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Ajoute une facette de diamant avec les UV de la demi-tile correspondante. */
function pushDiamondFace(
  positions: number[],
  uvs: number[],
  apex: THREE.Vector3,
  left: THREE.Vector3,
  right: THREE.Vector3,
  half: "top" | "bottom"
): void {
  positions.push(
    apex.x, apex.y, apex.z,
    left.x, left.y, left.z,
    right.x, right.y, right.z
  );

  if (half === "top") {
    uvs.push(0.5, 1, 0, 0.5, 1, 0.5);
  } else {
    uvs.push(0.5, 0, 0, 0.5, 1, 0.5);
  }
}
