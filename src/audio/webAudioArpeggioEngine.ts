// MOTEUR (pas un test isolé, contrairement à webAudioTest.ts/
// webAudioArpeggio.ts, briques 1 et 2) — utilisé EN PRODUCTION par :
// - AccompanimentPanelContent (src/exercices/improResult.tsx), pour les
//   accompagnements "arpège" (jouerArpegeWebAudio, UNE note par pas) et
//   "valse" (jouerValseWebAudio, PLUSIEURS notes plaquées par pas) ;
// - PianoChord (src/components/PianoChord.tsx), pour le bouton "Écouter"
//   (jouerAccordWebAudio, PLUSIEURS notes plaquées EN UNE SEULE FOIS, avec
//   coupure/retrigger de la lecture précédente) ;
// - InteractivePiano (src/components/InteractivePiano.tsx), pour le clavier
//   de leçon (jouerNoteImmediateWebAudio, UNE note déclenchée IMMÉDIATEMENT
//   au tap, en voix INDÉPENDANTE) ;
// - ResultScreen (src/exercices/improResult.tsx), pour le bouton "▶ Écouter
//   la progression" (jouerProgressionWebAudio, PLUSIEURS accords à la
//   suite, chacun plaqué, avec coupure/retrigger — voir plus bas).
// Toujours via react-native-audio-api. jouerArpegeWebAudio/jouerValseWebAudio/
// jouerAccordWebAudio/jouerProgressionWebAudio programment leur départ contre
// l'horloge audio (start(when) avec un décalage calculé à l'avance) ;
// jouerNoteImmediateWebAudio, elle, démarre quasi tout de suite (réactivité
// au tap), sans rien couper (superposition des voix, pas de GainNode maître).
//
// Ne touche PAS à expo-audio (src/lib/piano.ts reste intact, toujours
// utilisé comme filet pour ces usages, et pour tout le reste de l'app) : ce
// moteur vit À CÔTÉ.
//
// Réutilise calculerCorrespondanceSample (exportée depuis piano.ts) pour
// résoudre chaque note vers son sample le plus proche + son rate de
// pitch-shift, plutôt que de dupliquer la table des 13 samples et le calcul
// — ce sont des fonctions PURES (aucun état interne, aucun lien avec le pool
// de voix expo-audio de piano.ts), sûres à réutiliser ici sans coupler ce
// moteur à l'implémentation expo-audio.
import {
  AudioContext,
  type AudioBuffer,
  type AudioBufferSourceNode,
  type GainNode,
} from 'react-native-audio-api';
import { calculerCorrespondanceSample } from '../lib/piano';

// AudioContext PARTAGÉ, créé UNE SEULE FOIS et réutilisé pour tous les
// appels suivants (comme le pool de voix de piano.ts pour expo-audio) —
// éviter d'en recréer un à chaque tour de boucle de l'arpège.
let audioContext: AudioContext | null = null;

function obtenirAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Cache des AudioBuffer déjà décodés, indexé par l'id de module (le "source"
// require()'d, voir PianoSample.source dans piano.ts) : un sample n'est
// décodé qu'UNE SEULE FOIS, quel que soit le nombre de fois où l'arpège est
// rejoué ensuite — même esprit que le préchargement de piano.ts, mais
// construit paresseusement ici (au premier besoin) plutôt qu'explicitement à
// l'entrée d'un écran, pour rester dans le périmètre strict de cette brique.
const audioBufferCache = new Map<number, Promise<AudioBuffer>>();

function obtenirBufferDecode(context: AudioContext, source: number): Promise<AudioBuffer> {
  const dejaEnCours = audioBufferCache.get(source);
  if (dejaEnCours) {
    return dejaEnCours;
  }

  const promesse = context.decodeAudioData(source);
  audioBufferCache.set(source, promesse);
  return promesse;
}

// Joue "notes" comme une séquence PROGRAMMÉE contre l'horloge audio :
// - "notes[i]" démarre à t0 + (somme des dureesMs des pas PRÉCÉDENTS), donc
//   au même rythme que le séquenceur visuel (setTimeout enchaînés dans
//   AccompanimentPanelContent), mais programmé EN AVANCE ici, en une seule
//   fois, plutôt que déclenché pas par pas — c'est CE point qui élimine la
//   gigue que setTimeout introduirait s'il servait aussi à déclencher le son
//   (voir le test validé, webAudioArpeggio.ts).
// - "dureesMs[i]" est la durée du pas i (accompaniment.steps[i].durationMs
//   côté appelant) : le décalage cumulé suit donc EXACTEMENT les durées
//   réelles de la séquence, pas un intervalle fixe supposé.
// - Chaque note obtient son PROPRE AudioBufferSourceNode (usage unique,
//   comme sur le web) et son propre rate (pitch-shift vers la note demandée,
//   voir calculerCorrespondanceSample) — aucun état partagé entre les notes
//   au-delà de l'AudioContext et des AudioBuffer déjà décodés (partageables,
//   contrairement aux AudioBufferSourceNode).
export async function jouerArpegeWebAudio(notes: string[], dureesMs: number[]): Promise<void> {
  if (notes.length === 0) {
    return;
  }

  try {
    const context = obtenirAudioContext();

    // Résout TOUTES les notes ET décode TOUS les buffers nécessaires AVANT
    // de programmer quoi que ce soit : si l'un de ces sons n'était pas
    // encore en cache, on ne veut pas commencer à jouer la séquence pendant
    // qu'un décodage encore en cours plus loin.
    const correspondances = notes.map((note) => calculerCorrespondanceSample(note));
    const buffers = await Promise.all(
      correspondances.map((correspondance) => obtenirBufferDecode(context, correspondance.sample.source)),
    );

    // t0 lu UNE SEULE FOIS, avant la boucle — même principe que
    // webAudioArpeggio.ts (brique 2, déjà validée) : c'est cette référence
    // commune, pas le temps pris par la boucle elle-même, qui détermine le
    // rythme des notes programmées.
    const t0 = context.currentTime;
    console.log(
      `[webAudioArpeggioEngine] Séquence programmée depuis t0=${t0.toFixed(4)}s (${notes.length} notes)`,
    );

    let offsetCumuleMs = 0;
    correspondances.forEach((correspondance, index) => {
      const startTime = t0 + offsetCumuleMs / 1000;

      const source = context.createBufferSource();
      source.buffer = buffers[index];
      // playbackRate est un AudioParam (readonly), pas un number assignable
      // directement — voir .value, vérifié dans les .d.ts (même point que
      // webAudioArpeggio.ts).
      source.playbackRate.value = correspondance.rate;
      source.connect(context.destination);
      source.start(startTime);

      console.log(
        `[webAudioArpeggioEngine] Note ${index + 1}/${notes.length} (${notes[index]} → sample ${correspondance.sample.note}, rate=${correspondance.rate.toFixed(4)}) à startTime=${startTime.toFixed(4)}s`,
      );

      // Décalage du PAS COURANT ajouté APRÈS avoir programmé sa note : le
      // décalage de la note SUIVANTE doit inclure la durée de CE pas-ci, pas
      // celle du pas suivant.
      offsetCumuleMs += dureesMs[index] ?? 0;
    });

    console.log('[webAudioArpeggioEngine] Planification de la séquence terminée');
  } catch (error) {
    // Catché ICI (pas propagé) : même convention que webAudioTest.ts/
    // webAudioArpeggio.ts — l'appelant (AccompanimentPanelContent) n'a donc
    // pas besoin de son propre .catch(), un échec de ce moteur ne doit
    // jamais faire planter l'animation visuelle de l'arpège.
    console.error('[webAudioArpeggioEngine] Échec de la lecture programmée :', error);
  }
}

// Joue "pasNotes" (un tableau DE TABLEAUX de notes : "pasNotes[i]" = toutes
// les notes à plaquer SIMULTANÉMENT au pas i) comme une séquence PROGRAMMÉE
// contre l'horloge audio — même mécanique que jouerArpegeWebAudio ci-dessus
// (t0 lu une seule fois, décalage cumulé à partir de dureesMs[i], un
// AudioBufferSourceNode par note), généralisée à PLUSIEURS notes par pas :
// c'est ce qui permet de respecter le motif propre de la valse (temps fort
// "root" seul, puis 2 temps faibles "root+third+fifth" plaqués, voir
// ACCOMPANIMENTS dans ../dataset/accompaniments.ts) SANS le réinventer ici —
// cette fonction ne fait qu'exécuter la séquence de pas telle que fournie
// par l'appelant, quel que soit le nombre de notes de chaque pas.
//
// Toutes les notes d'UN MÊME pas partagent le MÊME startTime (c'est ça,
// "plaquées") : la seule vraie différence avec jouerArpegeWebAudio est
// cette boucle imbriquée (pas → notes de ce pas), pas la façon de
// programmer le son lui-même (toujours start(when) sur un
// AudioBufferSourceNode dédié).
export async function jouerValseWebAudio(pasNotes: string[][], dureesMs: number[]): Promise<void> {
  if (pasNotes.length === 0) {
    return;
  }

  try {
    const context = obtenirAudioContext();

    // Résout TOUTES les notes de TOUS les pas ET décode TOUS les buffers
    // nécessaires AVANT de programmer quoi que ce soit — même précaution que
    // jouerArpegeWebAudio, juste appliquée à un tableau de tableaux ici.
    const correspondancesParPas = pasNotes.map((notesDuPas) =>
      notesDuPas.map((note) => calculerCorrespondanceSample(note)),
    );
    const buffersParPas = await Promise.all(
      correspondancesParPas.map((correspondances) =>
        Promise.all(
          correspondances.map((correspondance) => obtenirBufferDecode(context, correspondance.sample.source)),
        ),
      ),
    );

    // t0 lu UNE SEULE FOIS, avant la boucle — même principe que
    // jouerArpegeWebAudio.
    const t0 = context.currentTime;
    console.log(
      `[webAudioArpeggioEngine] Valse programmée depuis t0=${t0.toFixed(4)}s (${pasNotes.length} pas)`,
    );

    let offsetCumuleMs = 0;
    correspondancesParPas.forEach((correspondancesDuPas, indexPas) => {
      const startTime = t0 + offsetCumuleMs / 1000;

      // TOUTES les notes de CE pas démarrent au MÊME startTime — c'est
      // uniquement CETTE boucle interne (absente de jouerArpegeWebAudio,
      // qui n'a qu'une note par pas) qui plaque plusieurs notes ensemble.
      correspondancesDuPas.forEach((correspondance, indexNote) => {
        const source = context.createBufferSource();
        source.buffer = buffersParPas[indexPas][indexNote];
        source.playbackRate.value = correspondance.rate;
        source.connect(context.destination);
        source.start(startTime);
      });

      console.log(
        `[webAudioArpeggioEngine] Pas ${indexPas + 1}/${pasNotes.length} (${correspondancesDuPas
          .map((correspondance) => correspondance.sample.note)
          .join('+')}) à startTime=${startTime.toFixed(4)}s`,
      );

      // Décalage du PAS COURANT ajouté APRÈS l'avoir programmé : le pas
      // suivant démarre après la durée de CE pas-ci, pas celle du pas
      // suivant.
      offsetCumuleMs += dureesMs[indexPas] ?? 0;
    });

    console.log('[webAudioArpeggioEngine] Planification de la valse terminée');
  } catch (error) {
    // Catché ICI (pas propagé), même convention que jouerArpegeWebAudio.
    console.error('[webAudioArpeggioEngine] Échec de la lecture programmée (valse) :', error);
  }
}

// Petit délai de sécurité avant le départ d'un accord — même principe que
// webAudioArpeggio.ts (brique 2) : laisse au moteur natif le temps de
// traiter les PLUSIEURS appels start() à venir (un par note de l'accord)
// avant l'instant programmé. Plus court que le délai du test isolé (0.1s) :
// un accord n'a besoin que de quelques dizaines de ms de marge, pas d'un
// tour de boucle complet à préparer à l'avance.
const CHORD_START_DELAY_SECONDS = 0.05;

// Durée de la rampe d'extinction anti-clic quand un accord en coupe un
// autre (RETRIGGER, voir couperAccordEnCours plus bas) — 20ms : assez court
// pour être perçu comme une coupure quasi instantanée, assez long pour
// qu'une rampe LINÉAIRE (pas un saut net) évite le clic audible d'une
// coupure de volume instantanée (même raisonnement que
// VOICE_STEAL_FADE_MS/fadeOutEtCouper dans piano.ts, pour le même problème
// côté expo-audio — ici via un GainNode plutôt qu'un réglage direct de
// volume, voir plus bas).
const CHORD_RETRIGGER_FADE_SECONDS = 0.02;

// Une "lecture" = toutes les notes déclenchées par UN SEUL appui sur
// "Écouter" OU "Écouter la progression", routées à travers un GainNode
// COMMUN (le "GainNode maître") : couper la lecture revient à ramper CE SEUL
// gain vers 0, pas à toucher chaque source individuellement. Type partagé
// par accordEnCours (un accord) ET progressionEnCours (plusieurs accords à
// la suite, voir plus bas) — dans les 2 cas, "sources" contient TOUTES les
// AudioBufferSourceNode de la lecture, quel que soit leur nombre.
type LectureEnCours = {
  sources: AudioBufferSourceNode[];
  gain: GainNode;
};

// Rampe le GainNode maître d'UNE lecture (accord seul ou progression
// entière) vers 0 sur CHORD_RETRIGGER_FADE_SECONDS, puis programme .stop()
// sur CHAQUE source à la fin EXACTE de cette rampe (pas un .stop()
// immédiat, pas un setTimeout — un 2e argument "when" sur stop(), comme
// start(when), laisse le moteur natif gérer ce timing lui-même). FACTORISÉE
// ici : RÉUTILISÉE par couperAccordEnCours ET couperProgressionEnCours
// (plus bas) — même geste anti-clic, appliqué à un nombre de sources
// différent selon l'appelant, jamais dupliqué.
function couperLecture(context: AudioContext, lecture: LectureEnCours): void {
  const { sources, gain } = lecture;
  const maintenant = context.currentTime;

  // setValueAtTime AVANT linearRampToValueAtTime : fixe explicitement la
  // valeur ACTUELLE du gain comme point de DÉPART de la rampe à l'instant
  // présent — sans cet ancrage, la rampe pourrait interpoler depuis une
  // valeur programmée précédemment (ex: un ancien setValueAtTime resté
  // "actif" dans la timeline de l'AudioParam) plutôt que depuis le volume
  // réellement en train de sonner maintenant.
  gain.gain.setValueAtTime(gain.gain.value, maintenant);
  gain.gain.linearRampToValueAtTime(0, maintenant + CHORD_RETRIGGER_FADE_SECONDS);

  sources.forEach((source) => {
    try {
      source.stop(maintenant + CHORD_RETRIGGER_FADE_SECONDS);
    } catch {
      // stop() peut lever (InvalidStateError) si cette source est déjà
      // arrêtée/terminée naturellement entre-temps — sans conséquence ici,
      // elle est de toute façon déjà silencieuse.
    }
  });
}

// État PARTAGÉ entre appels successifs de jouerAccordWebAudio (module-level,
// comme audioContext/audioBufferCache plus haut) : mémorise la lecture
// d'accord ACTUELLEMENT en cours pour pouvoir la couper au prochain appui.
// Ne concerne QUE le bouton "Écouter" — jouerArpegeWebAudio/jouerValseWebAudio
// gèrent leurs propres notes séparément, sans lien avec cet état.
let accordEnCours: LectureEnCours | null = null;

// Jeton de génération : incrémenté à CHAQUE appel de jouerAccordWebAudio,
// AVANT tout "await" (voir son usage plus bas). Cas limite couvert : si un
// 2e appui survient PENDANT que le décodage du 1er est encore en cours
// (rare en pratique, les buffers sont mis en cache dès le premier accord
// joué — voir obtenirBufferDecode), ce jeton empêche la lecture DEVENUE
// PÉRIMÉE d'écraser "accordEnCours" avec des sources que le 2e appui a déjà
// coupées — même principe que triggerToken/declenchedAt dans piano.ts pour
// exactement le même genre de course.
let generationAccordCourante = 0;

// Coupe la lecture d'accord en cours, si il y en a une — voir couperLecture.
function couperAccordEnCours(context: AudioContext): void {
  if (!accordEnCours) {
    return;
  }

  couperLecture(context, accordEnCours);
  accordEnCours = null;
}

// Joue "notes" comme un accord PLAQUÉ : TOUTES les notes démarrent au MÊME
// startTime (t0 + CHORD_START_DELAY_SECONDS), contrairement à
// jouerArpegeWebAudio/jouerValseWebAudio qui étalent leurs pas dans le
// temps — ici, un seul "pas", avec autant de notes simultanées que l'accord
// en compte. Même mécanique de programmation par en-dessous (un
// AudioBufferSourceNode par note, start(when) sur l'horloge audio) et mêmes
// helpers partagés (obtenirAudioContext/obtenirBufferDecode) que les 2
// fonctions ci-dessus — un seul AudioContext pour tout ce fichier, jamais
// recréé ici.
//
// RETRIGGER (voir couperAccordEnCours) : coupe D'ABORD toute lecture
// d'accord précédente encore en cours avant de programmer la nouvelle — un
// appui rapide et répété sur "Écouter" ne peut donc plus jamais empiler
// plusieurs accords, chaque nouvel appui coupe proprement le précédent
// (fondu de 20ms, pas de clic) puis relance.
export async function jouerAccordWebAudio(notes: string[]): Promise<void> {
  if (notes.length === 0) {
    return;
  }

  const context = obtenirAudioContext();

  // Coupée ICI, de façon SYNCHRONE (avant le moindre "await" plus bas) :
  // garantit qu'un appui immédiatement suivant voit déjà cette coupure
  // effectuée, plutôt que de risquer une fenêtre où 2 lectures se
  // chevauchent le temps d'un décodage.
  couperAccordEnCours(context);

  generationAccordCourante += 1;
  const maGeneration = generationAccordCourante;

  try {
    // Résout ET décode TOUTES les notes AVANT de programmer quoi que ce
    // soit — même précaution que jouerArpegeWebAudio/jouerValseWebAudio.
    const correspondances = notes.map((note) => calculerCorrespondanceSample(note));
    const buffers = await Promise.all(
      correspondances.map((correspondance) => obtenirBufferDecode(context, correspondance.sample.source)),
    );

    // Un appui PLUS RÉCENT a eu lieu pendant ce décodage (voir le
    // commentaire sur generationAccordCourante) : cette lecture-ci est
    // périmée, le nouvel appui s'occupe déjà de tout — ne rien programmer,
    // sous peine d'écraser accordEnCours avec des sources obsolètes.
    if (maGeneration !== generationAccordCourante) {
      return;
    }

    const startTime = context.currentTime + CHORD_START_DELAY_SECONDS;
    console.log(
      `[webAudioArpeggioEngine] Accord programmé (${notes.length} notes) à startTime=${startTime.toFixed(4)}s`,
    );

    // GainNode MAÎTRE de CETTE lecture : toutes les notes de cet accord y
    // sont routées (source → gain → destination, plus directement vers
    // destination) — un seul point à ramper pour toutes les couper d'un
    // coup au prochain appui (voir couperAccordEnCours). Volume normal
    // (1.0, valeur par défaut d'un GainNode) : aucun fondu d'ENTRÉE demandé
    // ici, seulement en sortie lors d'un retrigger.
    const gain = context.createGain();
    gain.connect(context.destination);

    const sources: AudioBufferSourceNode[] = [];

    correspondances.forEach((correspondance, index) => {
      const source = context.createBufferSource();
      source.buffer = buffers[index];
      source.playbackRate.value = correspondance.rate;
      // Connecté au GAIN maître (pas directement à context.destination) :
      // c'est ce qui permet à couperAccordEnCours de toutes les faire taire
      // ensemble via ce seul nœud.
      source.connect(gain);
      // MÊME startTime pour TOUTES les notes de la boucle : c'est ça,
      // "plaqué" — aucun décalage entre elles.
      source.start(startTime);
      sources.push(source);

      console.log(
        `[webAudioArpeggioEngine] Note accord ${index + 1}/${notes.length} (${notes[index]} → sample ${correspondance.sample.note}, rate=${correspondance.rate.toFixed(4)})`,
      );
    });

    // Mémorisée pour le PROCHAIN appui (retrigger) — voir couperAccordEnCours.
    accordEnCours = { sources, gain };

    console.log('[webAudioArpeggioEngine] Planification de l’accord terminée');
  } catch (error) {
    // Catché ICI (pas propagé), même convention que jouerArpegeWebAudio/
    // jouerValseWebAudio.
    console.error('[webAudioArpeggioEngine] Échec de la lecture programmée (accord) :', error);
  }
}

// Délai de sécurité MINIMAL avant le départ d'une note isolée jouée en
// réaction à un tap (InteractivePiano.tsx) — bien plus court que
// CHORD_START_DELAY_SECONDS (0.05s, un accord programme PLUSIEURS notes à la
// suite) : une seule note suffit avec une marge minime, l'essentiel est
// d'éviter qu'un startTime confondu avec "maintenant" ne tombe déjà dans le
// passé une fois traité côté natif (même raisonnement que les autres
// fonctions de ce fichier) — pas de laisser le temps de préparer plusieurs
// départs, la réactivité au tap prime ici.
const IMMEDIATE_NOTE_START_DELAY_SECONDS = 0.01;

// Joue "note" IMMÉDIATEMENT et de façon INDÉPENDANTE — DIFFÉRENCE VOLONTAIRE
// avec jouerAccordWebAudio : PAS de coupure de la lecture précédente, PAS de
// GainNode maître, PAS d'état module-level à mémoriser. Chaque appel crée sa
// PROPRE voix (son propre AudioBufferSourceNode, connecté DIRECTEMENT à
// context.destination) qui s'éteint TOUTE SEULE une fois le sample terminé,
// sans jamais toucher aux voix déclenchées par les appels précédents ou
// suivants — c'est précisément ce qui permet à 2 notes tapées rapidement
// (ex: do puis ré) de SE SUPERPOSER au lieu de s'couper l'une l'autre,
// comme sur un vrai piano. Aucun suivi/nettoyage manuel nécessaire : comme
// sur le Web Audio API standard, un AudioBufferSourceNode qui a fini de
// jouer (ou dont plus rien ne détient la référence JS, ici une variable
// locale à cette fonction) devient éligible au nettoyage automatique, sans
// .remove()/.stop() explicite à appeler ici.
export async function jouerNoteImmediateWebAudio(note: string): Promise<void> {
  try {
    const context = obtenirAudioContext();

    const correspondance = calculerCorrespondanceSample(note);
    const buffer = await obtenirBufferDecode(context, correspondance.sample.source);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = correspondance.rate;
    source.connect(context.destination);
    source.start(context.currentTime + IMMEDIATE_NOTE_START_DELAY_SECONDS);

    console.log(
      `[webAudioArpeggioEngine] Note immédiate (${note} → sample ${correspondance.sample.note}, rate=${correspondance.rate.toFixed(4)}) déclenchée`,
    );
  } catch (error) {
    // Catché ICI (pas propagé), même convention que les autres fonctions de
    // ce fichier — un échec de lecture ne doit jamais faire planter le
    // feedback visuel du clavier interactif.
    console.error('[webAudioArpeggioEngine] Échec de la lecture immédiate :', error);
  }
}

// Durée de chaque accord d'une progression jouée via "▶ Écouter la
// progression" (voir jouerProgressionWebAudio) — EN MILLISECONDES, comme
// dureesMs ailleurs dans ce fichier. Constante unique, facile à ajuster :
// tous les accords d'une progression durent la même chose (contrairement à
// l'arpège/la valse, où chaque pas a SA PROPRE durée venant de la table
// d'accompagnement).
const DUREE_ACCORD_MS = 1000;

// État PARTAGÉ entre appels successifs de jouerProgressionWebAudio, même
// principe que accordEnCours/generationAccordCourante plus haut — mais
// COMPLÈTEMENT SÉPARÉ : jouer une progression ne coupe PAS un accord isolé
// en cours (bouton "Écouter" de PianoChord) et inversement, ce sont 2
// lectures indépendantes, chacune avec son propre retrigger.
let progressionEnCours: LectureEnCours | null = null;
let generationProgressionCourante = 0;

// Coupe la lecture de progression en cours, si il y en a une — voir
// couperLecture. Coupe TOUTES les sources de TOUS les accords de cette
// progression d'un seul coup (même GainNode maître partagé par toute la
// progression, voir jouerProgressionWebAudio), y compris les accords pas
// encore commencés à l'instant de la coupure : ils sont déjà connectés au
// même gain, la rampe les fait donc taire eux aussi avant même d'avoir
// sonné.
function couperProgressionEnCours(context: AudioContext): void {
  if (!progressionEnCours) {
    return;
  }

  couperLecture(context, progressionEnCours);
  progressionEnCours = null;
}

// Joue "accords" (un tableau DE TABLEAUX de notes : "accords[i]" = toutes
// les notes de l'accord i, jouées SIMULTANÉMENT) comme une progression
// PROGRAMMÉE contre l'horloge audio, un accord toutes les DUREE_ACCORD_MS —
// même mécanique que jouerValseWebAudio (boucle imbriquée accord → notes de
// cet accord, un AudioBufferSourceNode par note, start(when) programmé à
// l'avance), avec en plus la coupure/retrigger de jouerAccordWebAudio
// (GainNode maître PARTAGÉ PAR TOUTE LA PROGRESSION, pas un par accord — un
// nouvel appui doit pouvoir couper la progression ENTIÈRE d'un coup, y
// compris les accords encore à venir).
//
// RETRIGGER (voir couperProgressionEnCours) : coupe D'ABORD toute lecture de
// progression précédente encore en cours avant de programmer la nouvelle —
// un appui rapide et répété sur "▶ Écouter la progression" ne peut donc plus
// jamais empiler plusieurs progressions.
export async function jouerProgressionWebAudio(accords: string[][]): Promise<void> {
  if (accords.length === 0) {
    return;
  }

  const context = obtenirAudioContext();

  // Coupée ICI, de façon SYNCHRONE (avant le moindre "await" plus bas) —
  // même précaution que jouerAccordWebAudio, pour la même raison.
  couperProgressionEnCours(context);

  generationProgressionCourante += 1;
  const maGeneration = generationProgressionCourante;

  try {
    // Résout ET décode TOUTES les notes de TOUS les accords AVANT de
    // programmer quoi que ce soit — même précaution que les autres
    // fonctions de ce fichier, appliquée à un tableau de tableaux.
    const correspondancesParAccord = accords.map((notesAccord) =>
      notesAccord.map((note) => calculerCorrespondanceSample(note)),
    );
    const buffersParAccord = await Promise.all(
      correspondancesParAccord.map((correspondances) =>
        Promise.all(
          correspondances.map((correspondance) => obtenirBufferDecode(context, correspondance.sample.source)),
        ),
      ),
    );

    // Un appui PLUS RÉCENT a eu lieu pendant ce décodage — voir le
    // commentaire sur generationProgressionCourante : cette lecture-ci est
    // périmée, ne rien programmer.
    if (maGeneration !== generationProgressionCourante) {
      return;
    }

    const t0 = context.currentTime;
    console.log(
      `[webAudioArpeggioEngine] Progression programmée depuis t0=${t0.toFixed(4)}s (${accords.length} accords, ${DUREE_ACCORD_MS}ms/accord)`,
    );

    // GainNode MAÎTRE de TOUTE la progression (pas un par accord) : un seul
    // point à ramper pour couper la progression entière au prochain appui,
    // même les accords pas encore commencés — voir couperProgressionEnCours.
    const gain = context.createGain();
    gain.connect(context.destination);

    const sources: AudioBufferSourceNode[] = [];

    correspondancesParAccord.forEach((correspondances, indexAccord) => {
      const startTime = t0 + (indexAccord * DUREE_ACCORD_MS) / 1000;

      // TOUTES les notes de CET accord démarrent au MÊME startTime (plaqué)
      // — même principe que jouerAccordWebAudio/jouerValseWebAudio.
      correspondances.forEach((correspondance, indexNote) => {
        const source = context.createBufferSource();
        source.buffer = buffersParAccord[indexAccord][indexNote];
        source.playbackRate.value = correspondance.rate;
        source.connect(gain);
        source.start(startTime);
        sources.push(source);
      });

      console.log(
        `[webAudioArpeggioEngine] Accord ${indexAccord + 1}/${accords.length} (${correspondances
          .map((correspondance) => correspondance.sample.note)
          .join('+')}) à startTime=${startTime.toFixed(4)}s`,
      );
    });

    // Mémorisée pour le PROCHAIN appui (retrigger) — voir
    // couperProgressionEnCours.
    progressionEnCours = { sources, gain };

    console.log('[webAudioArpeggioEngine] Planification de la progression terminée');
  } catch (error) {
    // Catché ICI (pas propagé), même convention que les autres fonctions de
    // ce fichier.
    console.error('[webAudioArpeggioEngine] Échec de la lecture programmée (progression) :', error);
  }
}
