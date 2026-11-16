// Ciel d'un monde : la lumière (soleil ou lune) qui éclaire et projette les ombres, et les nuages dont on ne
// voit que l'ombre glisser sur le sol.

import * as THREE from "three";
import { sharedUniforms } from "../../engine/toon-material.js";
import * as cloudAsset from "../../assets/nature/sky/cloud.js";

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Lumière du jour : une directionnelle fixe dans le monde (les ombres ne tournent pas avec la caméra), dont la
 * carte d'ombre suit la zone regardée. Elle se déplace par pas d'un texel d'ombre : les ombres ne scintillent
 * pas quand le promeneur marche.
 *
 * @param {{azimuth?: number, elevation?: number, mapSize?: number}} [options] angles en radians
 */
export function createDaylight({ azimuth = THREE.MathUtils.degToRad(-17), elevation = THREE.MathUtils.degToRad(44), mapSize = 1024 } = {}) {
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.castShadow = true;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.bias = -0.0015;
  light.shadow.normalBias = 0.05;

  const direction = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const DISTANCE = 140;
  let radius = 0;

  const daylight = {
    light,
    /** Direction vers l'astre. */
    direction,
    azimuth,
    elevation,
    /** Change la position de l'astre (heure du jour). Angles en radians. */
    setSun(nextAzimuth, nextElevation) {
      daylight.azimuth = nextAzimuth;
      daylight.elevation = nextElevation;
      direction.set(
        Math.sin(nextAzimuth) * Math.cos(nextElevation),
        Math.sin(nextElevation),
        Math.cos(nextAzimuth) * Math.cos(nextElevation),
      );
      right.crossVectors(WORLD_UP, direction).normalize();
      up.crossVectors(direction, right).normalize();
    },
    /**
     * Cadre la carte d'ombre sur un disque de `reach` mètres autour de `target`.
     * @param {THREE.Vector3} target point regardé
     * @param {number} reach rayon à couvrir (m)
     */
    update(target, reach) {
      // Rayon par paliers : la carte d'ombre ne change de taille que rarement.
      const wanted = Math.ceil(THREE.MathUtils.clamp(reach, 16, 90) / 8) * 8;
      const camera = light.shadow.camera;
      if (wanted !== radius) {
        radius = wanted;
        camera.left = -radius;
        camera.right = radius;
        camera.top = radius;
        camera.bottom = -radius;
        camera.near = 1;
        camera.far = DISTANCE * 2.5;
        camera.updateProjectionMatrix();
      }
      // Position alignée sur la grille des texels de la carte d'ombre.
      const texel = (radius * 2) / light.shadow.mapSize.x;
      const x = Math.round(target.dot(right) / texel) * texel;
      const y = Math.round(target.dot(up) / texel) * texel;
      const z = target.dot(direction);
      light.target.position.set(0, 0, 0).addScaledVector(right, x).addScaledVector(up, y).addScaledVector(direction, z);
      light.position.copy(light.target.position).addScaledVector(direction, DISTANCE);
      light.target.updateMatrixWorld();
    },
    dispose() {
      light.shadow.map?.dispose();
      light.dispose();
    },
  };
  daylight.setSun(azimuth, elevation);
  return daylight;
}

/**
 * Ombres de nuages : des cumulus de la bibliothèque dérivent avec le vent au-dessus de la carte et reviennent par
 * l'autre bord, mais ils ne sont dessinés que dans la carte d'ombre. On voit leur ombre glisser sur le pré ; le
 * nuage lui-même cacherait le promeneur.
 *
 * @param {object} rng générateur (kit/rng.js)
 * @param {object} options
 * @param {{minX: number, maxX: number, minZ: number, maxZ: number}} options.bounds emprise du monde
 * @param {number} [options.count] nombre de nuages
 * @param {number[]} [options.altitude] [min, max] du dessous des nuages (m)
 */
export function createCloudShadows(rng, { bounds, count = 6, altitude = [26, 36] }) {
  const group = new THREE.Group();
  group.name = "cloud shadows";
  const margin = 45;
  const span = {
    minX: bounds.minX - margin,
    maxX: bounds.maxX + margin,
    minZ: bounds.minZ - margin,
    maxZ: bounds.maxZ + margin,
  };
  const prototypes = [
    cloudAsset.create({ seed: rng.int(1, 400), kind: "cumulus", size: 9 }),
    cloudAsset.create({ seed: rng.int(1, 400), kind: "cumulus", size: 7 }),
  ].map((prototype) => prototype.children[0]);
  for (const prototype of prototypes) prototype.material.dispose();
  // N'écrit ni couleur ni profondeur dans l'image : seule la passe d'ombre le voit.
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

  const clouds = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(prototypes[rng.int(0, 1)].geometry, shadowOnly);
    mesh.name = "cloud shadow";
    mesh.castShadow = true;
    mesh.position.set(rng.range(span.minX, span.maxX), rng.range(altitude[0], altitude[1]), rng.range(span.minZ, span.maxZ));
    mesh.scale.setScalar(rng.range(1.5, 2.3));
    mesh.rotation.y = rng.range(-0.5, 0.5);
    group.add(mesh);
    clouds.push({ mesh, speed: rng.range(0.5, 0.95) });
  }

  return {
    group,
    /** @param {number} dt secondes écoulées depuis l'image précédente */
    update(dt) {
      const wind = sharedUniforms.uWindDir.value;
      const strength = sharedUniforms.uWindStrength.value;
      for (const cloud of clouds) {
        const position = cloud.mesh.position;
        position.x += wind.x * cloud.speed * strength * dt;
        position.z += wind.y * cloud.speed * strength * dt;
        if (position.x > span.maxX) position.x = span.minX;
        else if (position.x < span.minX) position.x = span.maxX;
        if (position.z > span.maxZ) position.z = span.minZ;
        else if (position.z < span.minZ) position.z = span.maxZ;
      }
    },
    dispose() {
      for (const prototype of prototypes) prototype.geometry.dispose();
      shadowOnly.dispose();
      group.clear();
    },
  };
}
