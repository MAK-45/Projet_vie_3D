// Prépare les modèles importés (personnages et animations) pour public/models/ : maillages simplifiés (~5 000
// triangles), quantifiés et compressés Meshopt, sans textures embarquées ; texture de couleur réduite à 256 px
// (64 couleurs) ; bibliothèque d'animations sans maillage, rotations seules (plus la translation de root et pelvis).
//
// Outils hors du projet (lourds, utiles une fois) :
//   npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
// Dossier source : les fichiers d'origine, sous leurs noms d'origine (female.gltf, male.gltf, ual.glb, .bin, .png) :
//   node scripts/prepare-models.mjs <dossier source> public/models [ratio du corps, 0.3]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, prune, quantize, resample, simplify, simplifyPrimitive, weld, reorder } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const [SRC, OUT, ratio = "0.3"] = process.argv.slice(2);
const RATIO = Number(ratio);
mkdirSync(`${OUT}/characters`, { recursive: true });
mkdirSync(`${OUT}/animations`, { recursive: true });

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.encoder": MeshoptEncoder,
  "meshopt.decoder": MeshoptDecoder,
});

async function finish(doc, file) {
  await doc.transform(
    prune({ keepAttributes: true }),
    dedup(),
    reorder({ encoder: MeshoptEncoder }),
    quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12, quantizeWeight: 8 }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(file, doc);
}

function stripAttributes(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of prim.listSemantics()) {
        if (!["POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0"].includes(semantic)) {
          prim.setAttribute(semantic, null);
        }
      }
    }
  }
}

function stripTextures(doc) {
  for (const material of doc.getRoot().listMaterials()) {
    material.setNormalTexture(null).setMetallicRoughnessTexture(null).setBaseColorTexture(null);
  }
  for (const texture of doc.getRoot().listTextures()) texture.dispose();
}

// --- Personnages
for (const [name, file, body] of [
  ["superhero-female", "female.gltf", "T_Superhero_Female_Dark_BaseColor.png"],
  ["superhero-male", "male.gltf", "T_Superhero_Male_Dark.png"],
]) {
  const doc = await io.read(`${SRC}/${file}`);
  for (const anim of doc.getRoot().listAnimations()) { for (const sm of anim.listSamplers()) { sm.getInput()?.dispose(); sm.getOutput()?.dispose(); sm.dispose(); } anim.dispose(); }
  stripAttributes(doc);
  stripTextures(doc);
  // Noms stables : le chargeur reconnaît les parties à leur nom.
  const meshes = doc.getRoot().listNodes().filter((node) => node.getMesh());
  for (const node of meshes) {
    const material = node.getMesh().listPrimitives()[0].getMaterial().getName();
    const part = material.includes("Eyes") ? "eyes" : material.includes("Hair") ? "brows" : "body";
    node.setName(part);
    node.getMesh().setName(part);
  }
  await doc.transform(weld());
  for (const node of meshes) {
    const ratio = node.getName() === "body" ? RATIO : 0.3;
    for (const prim of node.getMesh().listPrimitives()) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error: node.getName() === "body" ? 0.002 : 0.02 });
  }
  await finish(doc, `${OUT}/characters/${name}.glb`);
  await sharp(`${SRC}/${body}`).resize(256, 256, { kernel: "lanczos3" }).modulate({ brightness: 1.14, saturation: 1.1 }).png({ palette: true, colors: 64 }).toFile(`${OUT}/characters/${name}.png`);
}
await sharp(`${SRC}/T_Eye_Brown.png`).resize(32, 32).png().toFile(`${OUT}/characters/eye-brown.png`);

// --- Bibliothèque d'animations : le mannequin devient un personnage, les animations un fichier à part.
{
  const doc = await io.read(`${SRC}/ual.glb`);
  for (const anim of doc.getRoot().listAnimations()) { for (const sm of anim.listSamplers()) { sm.getInput()?.dispose(); sm.getOutput()?.dispose(); sm.dispose(); } anim.dispose(); }
  stripAttributes(doc);
  for (const node of doc.getRoot().listNodes()) if (node.getMesh()) { node.setName("body"); node.getMesh().setName("body"); }
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.002 }));
  await finish(doc, `${OUT}/characters/mannequin.glb`);
}
{
  const doc = await io.read(`${SRC}/ual.glb`);
  const root = doc.getRoot();
  // Seules les rotations voyagent d'un corps à l'autre ; root et pelvis gardent leur translation (hauteur du
  // bassin, déplacement). Les échelles sont constantes.
  for (const anim of root.listAnimations()) {
    for (const channel of anim.listChannels()) {
      const target = channel.getTargetNode()?.getName();
      const keep = channel.getTargetPath() === "rotation" || (channel.getTargetPath() === "translation" && (target === "root" || target === "pelvis"));
      if (!keep) {
        const sampler = channel.getSampler();
        channel.dispose();
        sampler.dispose();
      }
    }
  }
  for (const node of root.listNodes()) {
    if (node.getMesh()) node.setMesh(null);
    node.setSkin(null);
  }
  for (const skin of root.listSkins()) skin.dispose();
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const material of root.listMaterials()) material.dispose();
  await doc.transform(resample({ tolerance: 2e-4 }), prune({ keepLeaves: true }), dedup());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  await io.write(`${OUT}/animations/ual-standard.glb`, doc);
}
console.log("ok");
