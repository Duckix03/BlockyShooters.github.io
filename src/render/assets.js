// Carregamento de assets comprimidos: glTF com Draco/Meshopt e texturas KTX2 (Basis).
// O mapa atual é procedural, mas os loaders já ficam prontos para modelos/texturas reais.
// Os decodificadores ficam em /public (basis/ e draco/), servidos na mesma origem (compatível com COEP).
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const base = import.meta.env.BASE_URL;
let gltfLoader = null;
let ktx2Loader = null;

/** Configura os loaders uma vez, depois do renderer inicializado (KTX2 precisa detectar suporte da GPU). */
export function setupLoaders(renderer) {
  ktx2Loader = new KTX2Loader().setTranscoderPath(`${base}basis/`);
  ktx2Loader.detectSupport(renderer);
  const draco = new DRACOLoader().setDecoderPath(`${base}draco/`);
  gltfLoader = new GLTFLoader()
    .setDRACOLoader(draco)
    .setKTX2Loader(ktx2Loader)
    .setMeshoptDecoder(MeshoptDecoder);
}

/** Carrega um .glb (Draco/Meshopt/KTX2 suportados automaticamente). */
export const loadModel = (url) => gltfLoader.loadAsync(url);
/** Carrega uma textura .ktx2. */
export const loadTexture = (url) => ktx2Loader.loadAsync(url);
