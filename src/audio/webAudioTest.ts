// TEST ISOLÉ — react-native-audio-api, monté À CÔTÉ du moteur audio existant
// (expo-audio, voir src/lib/piano.ts — INTACT, non touché ici). Objectif
// UNIQUE de ce fichier : valider que le module natif de
// react-native-audio-api est bien lié sur ce development build — charger UN
// sample déjà présent dans le projet, le décoder, le jouer UNE fois.
//
// Rien de définitif ici : pas de pool de voix, pas de gestion de ressources
// avancée, pas de branchement dans piano.ts. Juste un aller-retour "ça marche
// ou pas", déclenché par le bouton temporaire "Test Web Audio" (voir
// HomeScreen.tsx).
import { AudioContext } from 'react-native-audio-api';

// MÊME fichier que celui déjà utilisé par expo-audio (voir SAMPLE_SOURCES
// dans src/lib/piano.ts, qui charge exactement ce chemin) — AUCUN nouveau
// fichier audio ajouté ici, on réutilise C3.mp3 tel quel.
//
// require() renvoie un id de module (number), typé "any" par défaut — le
// type ": number" absorbe ce "any" au lieu de le laisser se propager, même
// technique que piano.ts. C'est justement le type que decodeAudioData()
// accepte directement (voir DecodeDataInput = number | string | ArrayBuffer,
// vérifié dans node_modules/react-native-audio-api/lib/typescript/types.d.ts)
// : pas besoin de le convertir en URI/ArrayBuffer nous-mêmes.
const C3_SAMPLE: number = require('../dataset/piano songs/C3.mp3');

// Lance le test : crée un AudioContext, décode le sample, le joue une fois.
// Toutes les étapes sont journalisées (console.log) pour lire le déroulé
// dans le terminal ; toute erreur (ex: module natif non lié) est catchée et
// journalisée plutôt que de faire planter l'app.
export async function testWebAudioPlayback(): Promise<void> {
  try {
    // 1) CONTEXTE — si le module natif n'est pas correctement lié sur ce
    // development build, c'est généralement ICI que ça casse (au premier
    // appel natif réel), d'où le try/catch qui englobe tout.
    const audioContext = new AudioContext();
    console.log('[webAudioTest] AudioContext créé', {
      sampleRate: audioContext.sampleRate,
      state: audioContext.state,
    });

    // 2) CHARGEMENT + DÉCODAGE — decodeAudioData() fait les deux à la fois
    // ici (charge le fichier référencé par l'id de module ET le décode en
    // AudioBuffer PCM prêt à jouer), contrairement à expo-audio où
    // chargement et lecture passent par un AudioPlayer dédié par son.
    console.log('[webAudioTest] Chargement + décodage du sample C3.mp3…');
    const audioBuffer = await audioContext.decodeAudioData(C3_SAMPLE);
    console.log('[webAudioTest] Sample décodé en AudioBuffer', {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
    });

    // 3) LECTURE — AudioBufferSourceNode est à USAGE UNIQUE (comme sur le
    // web) : start() ne peut être appelé qu'une seule fois par instance, on
    // en recrée donc un nouveau ici plutôt que de le garder en cache pour
    // un futur appel. connect(audioContext.destination) le relie aux
    // haut-parleurs, comme sur le Web Audio API standard.
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    source.start();
    console.log('[webAudioTest] Lecture lancée via AudioBufferSourceNode.start() — module natif OK');
  } catch (error) {
    console.error('[webAudioTest] Échec du test react-native-audio-api :', error);
  }
}
