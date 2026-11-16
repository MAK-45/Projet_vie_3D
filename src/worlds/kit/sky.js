// Ciel d'un monde : la lumière du jour (le soleil qui éclaire et projette les ombres), l'astre visible à l'horizon
// et les nuages qui dérivent au-dessus de la carte en traînant leur ombre.

import * as THREE from "three";
import { disposeObject, sharedUniforms } from "../../engine/toon-material.js";
import * as cloudAsset from "../../assets/nature/sky/cloud.js";
import * as sunAsset from "../../assets/nature/sky/sun.js";

const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _lightRight = new THREE.Vector3();
const _lightUp = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Lumière du jour : une directionnelle fixe dans le monde (les ombres ne tournent pas avec la caméra), dont la
 * carte d'ombre suit la zone regardée. Elle se déplace par pas d'un texel d'ombre : les ombres ne scintillent
 * pas quand le personnage marche.
 *
 * @param {{azimuth?: number, elevation?: number, mapSize?: number}} [options] angles en radians
 */
export function createDaylight({ azimuth = THREE.MathUtils.degToRad(-17), elevation = THREE.MathUtils.degToRad(44), mapSize = 1024 } = {}) {
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.castShadow = true;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.bias = -0.0015;
  light.shadow.normalBias = 0.05;

  /** Direction vers le soleil. */
  const direction = new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  );
  _lightRight.crossVectors(WORLD_UP, direction).normalize();
  _lightUp.crossVectors(direction, _lightRight).normalize();
  const right = _lightRight.clone();
  const up = _lightUp.clone();
  const DISTANCE = 120;
  let radius = 0;

  return {
    light,
    direction,
    azimuth,
    elevation,
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
        camera.far = DISTANCE * 2;
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
}

/**
 * Soleil visible : l'asset « Soleil » posé au fond du décor. En vue orthographique il n'y a pas d'horizon ; l'astre
 * est donc accroché à l'écran, derrière tout le reste, et n'apparaît que dans le ciel dégagé (au-dessus du bord de
 * la carte) : il descend dans l'image quand la caméra s'incline vers l'horizon, et glisse sur le côté quand elle
 * tourne, comme s'il était très loin dans la direction de la lumière.
 *
 * @param {{azimuth: number, elevation: number}} daylight
 * @param {{seed?: number, size?: number}} [options]
 */
export function createSunDisc(daylight, { seed = 1, size = 4.5 } = {}) {
  const group = sunAsset.create({ seed, time: "noon", size });
  group.name = "sun";
  const mesh = group.children[0];
  mesh.frustumCulled = false;
  // Le disque de l'asset flotte au-dessus de son origine : on le ramène à l'origine du groupe.
  mesh.geometry.computeBoundingBox();
  const center = new THREE.Vector3();
  mesh.geometry.boundingBox.getCenter(center);
  mesh.position.sub(center);

  return {
    group,
    /**
     * @param {THREE.OrthographicCamera} camera caméra de la vue (matrices à jour)
     * @param {number} cameraAzimuth azimut de la caméra (rad)
     */
    update(camera, cameraAzimuth) {
      const e = camera.matrixWorld.elements;
      _right.set(e[0], e[1], e[2]);
      _up.set(e[4], e[5], e[6]);
      _forward.set(-e[8], -e[9], -e[10]);
      const halfWidth = (camera.right - camera.left) / camera.zoom / 2;
      const halfHeight = (camera.top - camera.bottom) / camera.zoom / 2;
      const cameraElevation = Math.asin(THREE.MathUtils.clamp(-_forward.y, -1, 1));

      // La caméra regarde vers l'azimut opposé à sa position : le soleil est « devant » quand il est de ce côté.
      const delta = Math.atan2(Math.sin(daylight.azimuth - cameraAzimuth - Math.PI), Math.cos(daylight.azimuth - cameraAzimuth - Math.PI));
      const facing = Math.cos(delta);
      group.visible = facing > 0.05;
      if (!group.visible) return;
      const x = Math.sin(delta) * halfWidth * 1.15;
      // Hauteur à l'écran : en haut de l'image à l'horizontale, sorti par le haut en vue plongeante.
      const y = halfHeight * (0.62 + (cameraElevation - THREE.MathUtils.degToRad(14)) * 2.6);
      const depth = (camera.far - camera.near) * 0.985;
      group.position.copy(camera.position)
        .addScaledVector(_forward, depth)
        .addScaledVector(_right, x)
        .addScaledVector(_up, y);
      group.scale.setScalar(1 / Math.sqrt(camera.zoom));
    },
    dispose() {
      disposeObject(group);
    },
  };
}

/**
 * Nuages : des cumulus qui dérivent avec le vent au-dessus de la carte et reviennent par l'autre bord, plus
 * quelques bancs immobiles autour de l'île, en contrebas, qui meublent l'horizon.
 *
 * Vus d'en haut, les nuages qui passent au-dessus de la carte cacheraient le promeneur : ils ne sont dessinés que
 * dans la carte d'ombre. On voit leur ombre glisser sur le pré, pas le nuage. Les bancs de l'horizon, eux, sont
 * visibles.
 *
 * @param {object} rng générateur (kit/rng.js)
 * @param {object} options
 * @param {{minX: number, maxX: number, minZ: number, maxZ: number}} options.bounds emprise du monde
 * @param {number} [options.drifting] nombre de nuages qui dérivent
 * @param {number} [options.horizon] nombre de bancs à l'horizon
 * @param {number[]} [options.altitude] [min, max] du dessous des nuages qui dérivent (m)
 */
export function createClouds(rng, { bounds, drifting = 6, horizon = 6, altitude = [26, 36] }) {
  const group = new THREE.Group();
  group.name = "clouds";
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
    cloudAsset.create({ seed: rng.int(1, 400), kind: "stratus", size: 9 }),
  ].map((prototype) => prototype.children[0]);
  const shared = prototypes[0].material;
  for (const prototype of prototypes.slice(1)) {
    prototype.material.dispose();
    prototype.material = shared;
  }

  // Matériau des nuages d'ombre : n'écrit ni couleur ni profondeur dans l'image, seule la passe d'ombre le voit.
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

  const clouds = [];
  const add = (kind, x, y, z, scale, speed) => {
    const source = prototypes[kind];
    const mesh = new THREE.Mesh(source.geometry, speed > 0 ? shadowOnly : shared);
    mesh.name = speed > 0 ? "cloud shadow" : "cloud";
    mesh.castShadow = speed > 0;
    mesh.receiveShadow = false;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(scale);
    mesh.rotation.y = rng.range(-0.5, 0.5);
    group.add(mesh);
    clouds.push({ mesh, speed });
  };

  for (let i = 0; i < drifting; i++) {
    add(
      rng.int(0, 1),
      rng.range(span.minX, span.maxX),
      rng.range(altitude[0], altitude[1]),
      rng.range(span.minZ, span.maxZ),
      rng.range(1.5, 2.3),
      rng.range(0.5, 0.95),
    );
  }
  // Bancs à l'horizon : hors de la carte, plus bas que le sol, immobiles.
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const halfX = (bounds.maxX - bounds.minX) / 2;
  const halfZ = (bounds.maxZ - bounds.minZ) / 2;
  for (let i = 0; i < horizon; i++) {
    const angle = ((i + rng.range(0.1, 0.9)) / horizon) * Math.PI * 2;
    const reach = rng.range(22, 55);
    add(
      rng.chance(0.6) ? 2 : 1,
      centerX + Math.cos(angle) * (halfX * 1.2 + reach),
      rng.range(-16, 4),
      centerZ + Math.sin(angle) * (halfZ * 1.2 + reach),
      rng.range(2.4, 3.6),
      0,
    );
  }

  return {
    group,
    /** @param {number} dt secondes écoulées depuis l'image précédente */
    update(dt) {
      const wind = sharedUniforms.uWindDir.value;
      const strength = sharedUniforms.uWindStrength.value;
      for (const cloud of clouds) {
        if (cloud.speed === 0) continue;
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
      shared.dispose();
      shadowOnly.dispose();
      group.clear();
    },
  };
}
