// Registre des assets : la liste de tout ce qui est dessiné. Ajouter ici chaque nouvel asset.
// Chaque module exporte `meta` (fiche : id, catégorie, tags, paramètres...) et `create(params)`.

import * as boulder from "./nature/rocks/boulder.js";
import * as buriedRock from "./nature/rocks/buried-rock.js";
import * as dirtMound from "./nature/terrain/dirt-mound.js";
import * as mossPatch from "./nature/terrain/moss-patch.js";
import * as snowPatch from "./nature/terrain/snow-patch.js";
import * as birch from "./nature/trees/birch.js";
import * as oak from "./nature/trees/oak.js";
import * as linden from "./nature/trees/linden.js";

import * as flowerClump from "./nature/plants/flower-clump.js";
import * as grassTuft from "./nature/plants/grass-tuft.js";
import * as lawn from "./nature/terrain/lawn.js";
import * as meadowGround from "./nature/terrain/meadow-ground.js";
import * as sun from "./nature/sky/sun.js";
import * as moon from "./nature/sky/moon.js";
import * as cloud from "./nature/sky/cloud.js";
import * as star from "./nature/sky/star.js";
import * as couveuseBlob from "./creatures/spirits/couveuse-blob.js";
import * as heroine from "./creatures/humanoid/superhero-female.js";
import * as hero from "./creatures/humanoid/superhero-male.js";
import * as mannequin from "./creatures/humanoid/mannequin.js";
import * as magicMannequin from "./creatures/humanoid/magic-mannequin.js";
import * as animLocomotionWalk from "./animations/locomotion/walk.js";
import * as animLocomotionWalkFormal from "./animations/locomotion/walk-formal.js";
import * as animLocomotionJog from "./animations/locomotion/jog.js";
import * as animLocomotionSprint from "./animations/locomotion/sprint.js";
import * as animLocomotionCrouchWalk from "./animations/locomotion/crouch-walk.js";
import * as animLocomotionJump from "./animations/locomotion/jump.js";
import * as animLocomotionRoll from "./animations/locomotion/roll.js";
import * as animLocomotionPush from "./animations/locomotion/push.js";
import * as animLocomotionSwim from "./animations/locomotion/swim.js";
import * as animIdleIdle from "./animations/idle/idle.js";
import * as animIdleTalk from "./animations/idle/talk.js";
import * as animIdleTorch from "./animations/idle/torch.js";
import * as animIdleCrouch from "./animations/idle/crouch.js";
import * as animIdleSit from "./animations/idle/sit.js";
import * as animIdleDrive from "./animations/idle/drive.js";
import * as animIdleSwimIdle from "./animations/idle/swim-idle.js";
import * as animIdleDance from "./animations/idle/dance.js";
import * as animActionsInteract from "./animations/actions/interact.js";
import * as animActionsPickUp from "./animations/actions/pick-up.js";
import * as animActionsRepair from "./animations/actions/repair.js";
import * as animActionsHit from "./animations/actions/hit.js";
import * as animActionsDeath from "./animations/actions/death.js";
import * as animCombatPunch from "./animations/combat/punch.js";
import * as animCombatSword from "./animations/combat/sword.js";
import * as animCombatPistol from "./animations/combat/pistol.js";
import * as animMagicSpell from "./animations/magic/spell.js";
import * as starPortal from "./props/magic/star-portal.js";
import * as starPortalDial from "./props/magic/star-portal-dial.js";
import * as summerMeadow from "./worlds/islands/summer-meadow.js";
import * as glyphFloorSlab from "./buildings/structure/glyph-floor-slab.js";
import * as glyphWall from "./buildings/structure/glyph-wall.js";
import * as glyphColumn from "./buildings/structure/glyph-column.js";
import * as cofferedVault from "./buildings/structure/coffered-vault.js";
import * as complexDoor from "./buildings/structure/complex-door.js";
import * as filamentLamp from "./furniture/lighting/filament-lamp.js";
import * as filamentChandelier from "./furniture/lighting/filament-chandelier.js";
import * as copperPipe from "./props/machines/copper-pipe.js";
import * as wheelValve from "./props/machines/wheel-valve.js";
import * as braidedCable from "./props/machines/braided-cable.js";
import * as stoneBench from "./furniture/seating/stone-bench.js";
import * as equipmentLocker from "./furniture/storage/equipment-locker.js";
import * as leverDesk from "./props/machines/lever-desk.js";
import * as ventGrate from "./buildings/structure/vent-grate.js";
import * as glyphPlaque from "./props/decor/glyph-plaque.js";
import * as irisDoor from "./buildings/structure/iris-door.js";
import * as travelTrunk from "./furniture/storage/travel-trunk.js";
import * as bronzeRailing from "./buildings/structure/bronze-railing.js";
import * as handLamp from "./props/tools/hand-lamp.js";
import * as drawerArchive from "./furniture/storage/drawer-archive.js";
import * as dataCassette from "./props/books/data-cassette.js";
import * as rollingLadder from "./buildings/structure/rolling-ladder.js";
import * as stoneTable from "./furniture/tables/stone-table.js";
import * as workbench from "./furniture/tables/workbench.js";
import * as articulatedLamp from "./furniture/lighting/articulated-lamp.js";
import * as bronzeStool from "./furniture/seating/bronze-stool.js";
import * as armMagnifier from "./props/tools/arm-magnifier.js";
import * as anvil from "./props/tools/anvil.js";
import * as complexCart from "./props/machines/complex-cart.js";
import * as crankRecorder from "./props/machines/crank-recorder.js";
import * as metalLathe from "./props/machines/metal-lathe.js";
import * as coilFurnace from "./props/machines/coil-furnace.js";
import * as displayCase from "./furniture/storage/display-case.js";
import * as toolRack from "./furniture/storage/tool-rack.js";
import * as spiralStair from "./buildings/structure/spiral-stair.js";
import * as straightStair from "./buildings/structure/straight-stair.js";
import * as gratingWalkway from "./buildings/structure/grating-walkway.js";
import * as cardCatalogue from "./furniture/tables/card-catalogue.js";
import * as complexTest from "./worlds/interiors/complex-test.js";
import * as ancientComplex from "./worlds/interiors/ancient-complex.js";

export { taxonomy, biomes } from "./taxonomy.js";

/** @type {Array<{meta: object, create: (params?: object) => import("three").Group}>} */
export const assets = [birch, oak, linden, boulder, buriedRock, snowPatch, mossPatch, dirtMound, grassTuft, lawn, meadowGround, flowerClump, sun, moon, cloud, star, couveuseBlob, heroine, hero, mannequin, magicMannequin,
  animLocomotionWalk, animLocomotionWalkFormal, animLocomotionJog, animLocomotionSprint, animLocomotionCrouchWalk, animLocomotionJump, animLocomotionRoll, animLocomotionPush, animLocomotionSwim, animIdleIdle, animIdleTalk, animIdleTorch, animIdleCrouch, animIdleSit, animIdleDrive, animIdleSwimIdle, animIdleDance, animActionsInteract, animActionsPickUp, animActionsRepair, animActionsHit, animActionsDeath, animCombatPunch, animCombatSword, animCombatPistol, animMagicSpell,
  starPortal, starPortalDial,
  glyphFloorSlab, glyphWall, glyphColumn, cofferedVault, complexDoor,
  filamentLamp, filamentChandelier, copperPipe, wheelValve, braidedCable,
  stoneBench, equipmentLocker, leverDesk, ventGrate, glyphPlaque,
  irisDoor, travelTrunk, bronzeRailing, handLamp,
  drawerArchive, dataCassette, rollingLadder, stoneTable, articulatedLamp,
  armMagnifier, bronzeStool, complexCart, crankRecorder, displayCase,
  spiralStair, straightStair, gratingWalkway, cardCatalogue,
  workbench, metalLathe, coilFurnace, anvil, toolRack,
  summerMeadow, ancientComplex, complexTest,
];

/** Retrouve un asset par son identifiant (`nature/trees/birch`). */
export function getAsset(id) {
  return assets.find((asset) => asset.meta.id === id);
}

/**
 * Cherche des assets par catégorie, sous-catégorie, biome ou mots (nom, description, tags).
 * @param {{category?: string, subcategory?: string, biome?: string, text?: string}} [query]
 */
export function findAssets({ category, subcategory, biome, text } = {}) {
  const words = (text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return assets.filter(({ meta }) => {
    if (category && meta.category !== category) return false;
    if (subcategory && meta.subcategory !== subcategory) return false;
    if (biome && !meta.biomes?.includes(biome)) return false;
    const haystack = [meta.id, meta.name, meta.nameEn, meta.description, ...meta.tags].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
