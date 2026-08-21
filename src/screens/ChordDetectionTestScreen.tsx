// TEST ISOLÉ — évalue la FIABILITÉ d'une détection d'accords via le micro,
// AVANT toute intégration. Capture le micro (AudioRecorder), route le signal
// dans un AnalyserNode (FFT) via un RecorderAdapterNode, et affiche à la fois
// les NOTES BRUTES détectées dans le spectre ET un ACCORD RECONNU (voir
// recognizeChord) — indépendant de l'octave, affiché de façon "collante"
// (reste affiché tant qu'un autre accord stable n'est pas détecté).
//
// GRAPHE : AudioRecorder → RecorderAdapterNode → AnalyserNode → GainNode
// (gain=0, SILENCIEUX) → audioContext.destination.
//
// audioContext.resume() EST OBLIGATOIRE : un AudioContext démarre "suspended"
// (standard Web Audio) — sans resume(), le moteur de rendu ne tourne pas du
// tout (diagnostiqué : premier symptôme observé, max=-Infinity permanent).
//
// LE GAIN SILENCIEUX EST AUSSI OBLIGATOIRE, et c'est moins connu : vérifié
// dans le code natif de la lib (common/cpp/audioapi/core/AudioContext.cpp +
// AudioNode.cpp) — le moteur de rendu est un graphe PULL, entièrement
// entraîné depuis audioContext.destination (AudioDestinationNode::renderAudio,
// appelé par le flux audio de sortie réel du téléphone) : un nœud qui n'est
// PAS connecté, même indirectement, à destination n'est JAMAIS visité par
// processAudio()/processNode() — quel que soit l'état du contexte. C'est
// pour ça que l'AnalyserNode restait à -Infinity même APRÈS resume() : il
// était bien "suspended" → "running", mais toujours hors du chemin que le
// moteur parcourt réellement pour produire du son.
// Connecter l'analyseur à destination le fait enfin traiter à chaque
// trame — mais un GainNode à gain=0 intercalé juste avant coupe le niveau
// de sortie à zéro, donc AUCUN son du micro n'est réellement audible dans
// les haut-parleurs (pas de retour/larsen) : seul le graphe "tourne", rien
// n'en sort en pratique.
//
// PERMISSION MICRO : AudioManager.requestRecordingPermissions() (appel JS)
// déclenche le prompt OS. Aucun changement natif nécessaire ici — vérifié :
// le plugin Expo "expo-audio" (déjà dans app.json → plugins, déjà appliqué à
// chaque build existant) déclare déjà NSMicrophoneUsageDescription (iOS) et
// RECORD_AUDIO (Android, aussi déclaré directement dans app.json).
//
// ALGO D'EXTRACTION DES NOTES BRUTES (volontairement NAÏF — voir
// extractDetectedNotes) : pics locaux du spectre en dB au-dessus d'un seuil,
// dans la plage utile piano, convertis en notes via tonal
// (Midi.freqToMidi/midiToNoteName). AUCUN filtrage d'harmoniques — reste
// affiché tel quel, c'est un repère diagnostique brut.
//
// ALGO DE RECONNAISSANCE D'ACCORD (voir recognizeChord) : contrairement à la
// liste brute ci-dessus, celui-ci ignore délibérément l'octave — les pics
// sont d'abord réduits à leurs 12 CLASSES DE HAUTEUR (do..si), en ne gardant
// que la plus forte occurrence de chaque classe (un pic à l'octave d'une
// note déjà jouée n'ajoute donc pas une classe séparée). Seules les classes
// à moins de RELATIVE_MAGNITUDE_WINDOW_DB de la plus forte du moment sont
// retenues (les vraies notes jouées ensemble sont d'un volume proche ; les
// harmoniques parasites, elles, sont généralement plus faibles). Cet
// ensemble réduit passe ensuite par findTriadQuality — PAS Chord.detect
// (tonal) : vérifié empiriquement que Chord.detect, qui cherche la
// meilleure explication de TOUT le set, est fragile sur les triades
// DIMINUÉES dès qu'une seule note supplémentaire s'y ajoute (un cas RÉALISTE
// avec un micro, les harmoniques du piano en ajoutent souvent) — voir le
// commentaire détaillé sur recognizeChord pour les exemples concrets.
// findTriadQuality cherche directement une forme de triade par intervalles,
// robuste à ce genre de pollution. AFFICHAGE "COLLANT" : le nouvel accord
// n'est affiché que s'il ressort IDENTIQUE sur CHORD_STABILITY_POLLS sondes consécutives
// (évite qu'un pic isolé ne fasse clignoter l'affichage), et l'ancien reste
// affiché tant qu'aucun autre accord stable n'est détecté (jamais effacé
// sur une sonde silencieuse/ambiguë).
//
// 7e MAJEURE (voir findMajorSeventhChord) : classifieur SÉPARÉ de
// findTriadQuality, pas une extension de celui-ci. Raison, trouvée par
// instrumentation (logMajorSeventhComparison, gardé) + discussion avant
// codage : Mi-Sol-Si (tierce/quinte/7e de Do maj7) forment TOUJOURS une
// VRAIE triade mineure — un fait structurel de tout accord maj7, pas du
// bruit — donc findTriadQuality, qui cherche une triade par sous-ensemble,
// se fait systématiquement détourner dès qu'une vraie 7e est jouée (vérifié
// sur device : Do maj7 → "Mi mineur" à chaque fois). Un détecteur qui évalue
// les 4 notes EN BLOC (Chord.detect, tonal) plutôt que par sous-ensembles
// évite ce piège par construction — vérifié empiriquement : aucun autre
// accord réel à 4 notes (dominante 7, m7, m7b5, dim7, 6, sus4/2 7, 7#5, 7b5)
// ne fait jamais ressortir "major seventh" dans ses candidats. Chord.detect
// N'EST PAS repris pour les triades (voir le commentaire sur recognizeChord
// pour pourquoi ça reste juste pour elles) : le problème qui le rendait
// fragile là-bas (meilleure explication d'un ensemble de taille VARIABLE,
// pollué par des harmoniques) ne se pose pas ici, l'entrée est contrainte à
// EXACTEMENT 4 notes déjà filtrées par fenêtre relative.
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chord, Midi, Note } from 'tonal';
import {
  AudioContext,
  AudioManager,
  AudioRecorder,
  type AnalyserNode,
  type GainNode,
  type RecorderAdapterNode,
} from 'react-native-audio-api';

import { theme } from '../theme';

// Taille de FFT — 8192 échantillons, un compromis entre résolution en
// fréquence (~5,4Hz/bin à 44100Hz, suffisant pour distinguer 2 notes de
// piano voisines même dans le grave) et fréquence de rafraîchissement
// (~186ms/trame) pour un affichage encore lisible en "temps réel".
const FFT_SIZE = 8192;

// En-dessous de ce niveau (dB), un pic est considéré comme du bruit de fond,
// pas une vraie note jouée — valeur de départ raisonnable, à ajuster à
// l'oreille/l'œil selon ce que révèle le test.
const MIN_DECIBELS_THRESHOLD = -70;

// Plage de fréquences utile pour un piano (~La0 à ~Si6) — ignore l'infrason/
// bruit très grave et les harmoniques très aiguës peu utiles pour identifier
// une fondamentale.
const MIN_FREQUENCY_HZ = 55;
const MAX_FREQUENCY_HZ = 2000;

// Nombre maximum de notes affichées par trame — au-delà, l'affichage
// deviendrait illisible (et ce sont de toute façon les pics les plus faibles,
// les moins fiables).
const MAX_NOTES_DISPLAYED = 6;

// Intervalle de rafraîchissement de l'affichage — proche de la durée d'une
// trame FFT (~186ms) : interroger plus souvent ne donnerait pas plus
// d'information, la trame FFT ne change pas plus vite que ça.
const POLL_INTERVAL_MS = 180;

// Les 12 classes de hauteur, indexées comme Note.chroma (0 = Do) — sert à
// convertir un index de classe en nom de note pour l'affichage/le log
// (voir formatChordLabelFrench/recognizeChord).
const CHROMA_PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Une classe de hauteur n'est retenue pour la reconnaissance d'accord que si
// elle est à moins de cet écart (dB) de la classe la plus forte du moment —
// les notes RÉELLEMENT jouées ensemble sont généralement d'un volume
// proche ; les harmoniques parasites d'une seule note jouée sont, elles,
// souvent plus faibles que sa fondamentale. Valeur de départ raisonnable, à
// ajuster selon ce que révèle le test.
const RELATIVE_MAGNITUDE_WINDOW_DB = 15;

// Nombre de sondes CONSÉCUTIVES où le même nouvel accord doit ressortir
// avant d'être accepté comme le nouvel accord affiché — un simple
// anti-scintillement contre un pic isolé/une transition entre 2 accords.
const CHORD_STABILITY_POLLS = 2;

const FRENCH_TONIC_LETTERS: Record<string, string> = {
  C: 'Do',
  D: 'Ré',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

const FRENCH_QUALITY_LABEL: Record<string, string> = {
  Major: 'majeur',
  Minor: 'mineur',
  Diminished: 'diminué',
  Augmented: 'augmenté',
  Unknown: '?',
};

// Même recette que toFrenchTonicLabel dans harmonyAnalysis.ts — dupliquée
// ici plutôt qu'importée : ce fichier reste un test isolé, autonome (voir
// le commentaire en haut de fichier), même principe déjà suivi ailleurs
// dans l'app pour les écrans/briques volontairement indépendants.
// Extraite séparément (plutôt que gardée dans formatChordLabelFrench) : le
// classifieur maj7 en a aussi besoin, pour un libellé qui n'est pas juste
// "tonique + qualité" (voir son usage dans recognizeChord).
function frenchTonicLabel(tonic: string): string {
  const { letter, acc } = Note.get(tonic);
  const accidentals = [...acc].map((char) => (char === '#' ? '♯' : '♭')).join('');
  return `${FRENCH_TONIC_LETTERS[letter] ?? letter}${accidentals}`;
}

function formatChordLabelFrench(tonic: string, quality: string): string {
  return `${frenchTonicLabel(tonic)} ${FRENCH_QUALITY_LABEL[quality] ?? quality}`;
}

// Réduit le spectre en dB à un score par CLASSE DE HAUTEUR (0=Do..11=Si) :
// pour chaque pic local au-dessus du seuil, on ne garde que le plus fort
// retombant sur chaque classe — un pic à l'octave d'une note déjà comptée
// (même classe) n'ajoute donc rien de plus, il ne fait que renforcer si
// besoin. Retourne -Infinity pour une classe absente du spectre.
function buildChromaProfile(magnitudesDb: Float32Array, sampleRate: number, fftSize: number): Float32Array {
  const profile = new Float32Array(CHROMA_PITCH_CLASSES.length).fill(-Infinity);
  const hzPerBin = sampleRate / fftSize;
  const minBin = Math.max(1, Math.floor(MIN_FREQUENCY_HZ / hzPerBin));
  const maxBin = Math.min(magnitudesDb.length - 2, Math.ceil(MAX_FREQUENCY_HZ / hzPerBin));

  for (let bin = minBin; bin <= maxBin; bin++) {
    const magnitude = magnitudesDb[bin];
    if (magnitude < MIN_DECIBELS_THRESHOLD) continue;
    if (!(magnitude > magnitudesDb[bin - 1] && magnitude > magnitudesDb[bin + 1])) continue;

    const frequency = bin * hzPerBin;
    const chromaIndex = ((Math.round(Midi.freqToMidi(frequency)) % 12) + 12) % 12;
    if (magnitude > profile[chromaIndex]) {
      profile[chromaIndex] = magnitude;
    }
  }

  return profile;
}

// Ne garde que les classes de hauteur "présentes" : à moins de
// RELATIVE_MAGNITUDE_WINDOW_DB de la classe la plus forte du profil —
// exclut les classes trop en retrait pour être de vraies notes jouées
// (voir le commentaire sur RELATIVE_MAGNITUDE_WINDOW_DB).
function selectPresentChromaClasses(profile: Float32Array): number[] {
  let maxMagnitude = -Infinity;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] > maxMagnitude) maxMagnitude = profile[i];
  }
  if (maxMagnitude === -Infinity) return [];

  const present: number[] = [];
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] >= maxMagnitude - RELATIVE_MAGNITUDE_WINDOW_DB) {
      present.push(i);
    }
  }
  return present;
}

type TriadQuality = 'Major' | 'Minor' | 'Diminished' | 'Augmented';

// BUG DIAGNOSTIQUÉ (voir la trace loggée plus bas, [Diag][Qualité]) : à la
// fondamentale RÉELLEMENT jouée, une note en PLUS (harmonique naturelle
// d'une des notes jouées, ex: la 5e harmonique d'une tierce jouée franchement
// retombe sur la tierce majeure DE CETTE NOTE) peut occuper EXACTEMENT la
// position de la "quinte augmentée" relative à cette même fondamentale —
// ex: Sol# majeur (Sol#-Do-Ré#) + Mi (5e harmonique du Do joué) : Mi est
// PILE la quinte augmentée de Sol# (Sol#+8 demi-tons = Mi). L'ancienne
// version vérifiait "tierce majeure + quinte AUGMENTÉE" AVANT "tierce
// majeure + quinte JUSTE" — à la MÊME fondamentale Sol#, les 2 motifs
// matchaient SIMULTANÉMENT (la quinte juste Ré# est bien là aussi), mais
// l'ordre de vérification faisait gagner l'augmenté à tort. Vérifié par
// simulation : Sol#-Do-Ré#-Mi → Augmenté (ancien code) vs Majeur (corrigé).
//
// CORRECTIF — 2 PASSES plutôt qu'un seul passage par fondamentale :
// 1) Diminué/Majeur/Mineur d'abord, sur TOUTES les fondamentales
//    candidates (par force décroissante) — l'augmenté n'est même pas
//    regardé ici.
// 2) Augmenté SEULEMENT si AUCUNE fondamentale, nulle part, n'a donné de
//    diminué/majeur/mineur — dernier recours, jamais prioritaire face à une
//    autre lecture valide, cohérent avec le fait qu'aucune gamme
//    majeure/mineure naturelle diatonique n'en produit (voir
//    ReproduisAccordExercise.tsx, qui ne propose d'ailleurs même pas de
//    filtre "augmentés" pour cette raison).
//
// LIMITE CONNUE (pas corrigée ici, hors périmètre de cette brique — voir le
// récap) : ce correctif résout le cas rapporté (bonne fondamentale,
// verdict augmenté à tort), mais PAS le cas plus général où une note
// parasite ferait gagner une fondamentale ENTIÈREMENT DIFFÉRENTE (plus
// forte que la vraie fondamentale) sur un verdict majeur/mineur erroné —
// non observé/rapporté à ce jour, nécessiterait de savoir distinguer la
// fondamentale par autre chose que le seul volume (ex: le registre/la
// fréquence réelle, pas seulement la classe de hauteur).
function findTriadQuality(
  presentChromaClasses: number[],
  profile: Float32Array,
): { rootChroma: number; quality: TriadQuality } | null {
  const present = new Set(presentChromaClasses);
  const rootsByLoudness = [...presentChromaClasses].sort((a, b) => profile[b] - profile[a]);

  // DIAGNOSTIC — trace complète : pour CHAQUE fondamentale candidate (dans
  // l'ordre testé), quels intervalles sont présents et quel(s) motif(s)
  // matchent. Permet de voir un cas comme celui du bug (une fondamentale où
  // majeur ET augmenté matchent tous les deux) avant même de regarder le
  // verdict final.
  const trace: string[] = [];

  // Passe 1 — diminué/majeur/mineur, jamais augmenté ici.
  for (const root of rootsByLoudness) {
    const hasMinorThird = present.has((root + 3) % 12);
    const hasMajorThird = present.has((root + 4) % 12);
    const hasDiminishedFifth = present.has((root + 6) % 12);
    const hasPerfectFifth = present.has((root + 7) % 12);
    const hasAugmentedFifth = present.has((root + 8) % 12);
    const matches = [
      hasMinorThird && hasDiminishedFifth ? 'diminué' : null,
      hasMajorThird && hasPerfectFifth ? 'majeur' : null,
      hasMinorThird && hasPerfectFifth ? 'mineur' : null,
      hasMajorThird && hasAugmentedFifth ? 'augmenté(différé)' : null,
    ].filter((m): m is string => m !== null);
    trace.push(`${CHROMA_PITCH_CLASSES[root]}: ${matches.length > 0 ? matches.join('+') : '—'}`);

    if (hasMinorThird && hasDiminishedFifth) {
      console.log('[Diag][Qualité] Trace fondamentales:', trace.join(', '));
      return { rootChroma: root, quality: 'Diminished' };
    }
    if (hasMajorThird && hasPerfectFifth) {
      console.log('[Diag][Qualité] Trace fondamentales:', trace.join(', '));
      return { rootChroma: root, quality: 'Major' };
    }
    if (hasMinorThird && hasPerfectFifth) {
      console.log('[Diag][Qualité] Trace fondamentales:', trace.join(', '));
      return { rootChroma: root, quality: 'Minor' };
    }
  }

  // Passe 2 — augmenté, dernier recours seulement.
  for (const root of rootsByLoudness) {
    const hasMajorThird = present.has((root + 4) % 12);
    const hasAugmentedFifth = present.has((root + 8) % 12);
    if (hasMajorThird && hasAugmentedFifth) {
      console.log('[Diag][Qualité] Trace fondamentales:', trace.join(', '), '→ augmenté (dernier recours)');
      return { rootChroma: root, quality: 'Augmented' };
    }
  }

  console.log('[Diag][Qualité] Trace fondamentales:', trace.join(', '), '→ aucun verdict');
  return null;
}

// Détecteur DÉDIÉ à la 7e majeure — SÉPARÉ de findTriadQuality, voir le
// commentaire en tête de fichier pour l'analyse complète (Mi-Sol-Si étant
// TOUJOURS une vraie triade mineure à l'intérieur de tout Do maj7,
// findTriadQuality ne peut structurellement pas s'en charger correctement).
//
// N'ESSAIE QUE SI EXACTEMENT 4 classes sont retenues — PAS un "top 4 par
// volume" forcé : vérifié qu'un top-4 forcé peut EXCLURE la vraie quinte au
// profit de 2 notes de bruit plus fortes (ex: Do majeur pollué en
// Do-Mi-Fa-La → Chord.detect dit "Fmaj7/C" à tort, testé). En n'agissant
// QUE sur l'ensemble déjà filtré par fenêtre relative (même
// selectPresentChromaClasses que pour les triades), une trame polluée à 5
// classes ou plus retenues est simplement IGNORÉE ici plutôt que mal
// interprétée — et sur les données réellement capturées, les sondes d'un
// Do maj7 propre tombent souvent naturellement sur EXACTEMENT 4 classes.
//
// LIMITE CONNUE, PAS éliminée par ce qui précède (à garder en tête) : si la
// pollution retombe elle-même PILE sur 4 classes (ex: Do majeur + Fa + La,
// SANS Sol dans l'ensemble retenu), l'ensemble est LITTÉRALEMENT identique à
// celui d'un vrai Fa maj7 (Fa-La-Do-Mi partage Do/Mi/Fa/La — vérifié :
// mêmes 4 classes) — aucun filtre travaillant SEULEMENT sur l'ensemble de
// classes ne peut distinguer ces 2 situations, l'info manque (pas la
// logique). Résiduel, pas corrigé ici : nécessiterait une donnée
// supplémentaire (ex: équilibre interne des 4 magnitudes, ou contexte
// temporel) — à revisiter seulement si observé en pratique.
//
// chord.tonic reste fiable même en notation slash (basse différente de la
// fondamentale, ex: Chord.detect(['E','B','C','G']) → "Cmaj7/E", tonic
// toujours "C") — vérifié : c'est pour ça qu'on peut lire chord.tonic
// directement, sans avoir besoin de connaître laquelle des 4 notes était la
// plus grave.
function findMajorSeventhChord(presentChromaClasses: number[]): { rootChroma: number } | null {
  if (presentChromaClasses.length !== 4) return null;

  const noteNames = presentChromaClasses.map((chroma) => CHROMA_PITCH_CLASSES[chroma]);
  const candidates = Chord.detect(noteNames);
  const majorSeventhCandidate = candidates
    .map((symbol) => Chord.get(symbol))
    .find((chord) => chord.type === 'major seventh' && chord.tonic !== null);

  console.log(
    '[Diag][Maj7Classifier] 4 classes retenues:',
    noteNames,
    '→ candidats Chord.detect:',
    candidates,
    '→',
    majorSeventhCandidate ? `maj7 trouvé, fondamentale=${majorSeventhCandidate.tonic}` : 'pas de maj7 parmi les candidats',
  );

  if (!majorSeventhCandidate || majorSeventhCandidate.tonic === null) return null;
  return { rootChroma: Note.chroma(majorSeventhCandidate.tonic) };
}

// Reconnaît un accord à partir d'un ensemble de classes de hauteur (peu
// importe l'octave). Moins de 2 classes : pas assez pour nommer un accord
// (une seule note isolée ne remplace jamais l'accord affiché — voir son
// utilisation dans la boucle de sonde).
//
// POURQUOI PAS Chord.detect (tonal) ICI : vérifié empiriquement — sur une
// triade DIMINUÉE propre (ex: B-D-F), Chord.detect trouve bien "Bdim"
// (quality Diminished). Mais dès qu'UNE seule note supplémentaire s'ajoute
// au set (ex: la quinte réelle d'un piano ajoute naturellement F#, 3e
// harmonique de B) — un cas RÉALISTE et fréquent avec un micro, pas un cas
// limite artificiel — Chord.detect cherche la MEILLEURE explication de
// TOUT le set et part sur une tout autre famille d'accord (vérifié :
// B-D-F-F# → "F#M7#5sus4/B", quality Augmented ; B-D-F-D# → aucun
// candidat) : le diminué est nettement plus fragile à ce phénomène que
// majeur/mineur (vérifié : D-F#-A-E, le même genre de pollution, reste
// correctement "Major" via Chord.detect). findTriadQuality ci-dessus est
// robuste à exactement ce cas : il cherche une forme de triade PARMI les
// classes présentes, sans exiger que le set entier corresponde à un seul
// accord cohérent — vérifié sur les mêmes exemples pollués (diminué et
// majeur/mineur tous corrects).
//
// findTriadQuality a ENSUITE eu son propre bug (majeur → augmenté à tort,
// voir le commentaire détaillé au-dessus de sa définition) — corrigé par
// l'ordre en 2 passes qui y est expliqué.
function recognizeChord(presentChromaClasses: number[], profile: Float32Array): string | null {
  if (presentChromaClasses.length < 2) return null;

  // 7e MAJEURE d'abord, TOUJOURS avant findTriadQuality — voir
  // findMajorSeventhChord et le commentaire en tête de fichier : essayer
  // findTriadQuality en premier sur un ensemble à 4 classes trouverait la
  // sous-triade cachée (ex: Mi mineur dans Do maj7) avant même d'arriver
  // ici, reproduisant exactement le bug qu'un détecteur séparé évite.
  const majorSeventh = findMajorSeventhChord(presentChromaClasses);
  if (majorSeventh !== null) {
    return `${frenchTonicLabel(CHROMA_PITCH_CLASSES[majorSeventh.rootChroma])} majeur 7`;
  }

  const found = findTriadQuality(presentChromaClasses, profile);
  console.log(
    '[Diag][Qualité] Classes retenues:',
    presentChromaClasses.map((c) => CHROMA_PITCH_CLASSES[c]),
    '→',
    found ? `fondamentale=${CHROMA_PITCH_CLASSES[found.rootChroma]} qualité=${found.quality}` : 'aucune forme de triade trouvée',
  );
  if (found === null) return null;

  // DIAGNOSTIC UNIQUEMENT — voir logMajorSeventhComparison : AUCUNE
  // classification 7e ici, seulement de quoi COMPARER "triade propre" vs
  // "vraie maj7" avant de choisir une approche (voir le commentaire détaillé
  // sur la fonction). Appelé seulement quand une triade a été reconnue : la
  // comparaison n'a de sens que relative à UNE fondamentale déjà identifiée.
  logMajorSeventhComparison(found.rootChroma, profile);

  return formatChordLabelFrench(CHROMA_PITCH_CLASSES[found.rootChroma], found.quality);
}

// DIAGNOSTIC UNIQUEMENT (aucune classification — voir la tâche en cours :
// distinguer une VRAIE 7e majeure jouée d'une simple harmonique avant de
// coder quoi que ce soit). Logge, relativement à la fondamentale déjà
// reconnue :
// - la magnitude BRUTE à la position de la 7e majeure (fondamentale + 11
//   demi-tons), qu'elle ait ou non passé le seuil de "présence" (voir
//   selectPresentChromaClasses) — c'est justement les valeurs SOUS le seuil
//   qui intéressent ici, pour voir où elles se situent d'habitude ;
// - l'écart (dB) par rapport à la classe la plus forte du profil ;
// - l'écart (dB) par rapport à la fondamentale elle-même.
// Pourquoi la fondamentale comme référence PLUTÔT que la tierce/quinte :
// analyse préalable (voir le commentaire en tête de fichier) — la 7e
// majeure est un harmonique naturel À LA FOIS de la tierce (3e harmonique)
// ET de la quinte (5e harmonique) de la triade ; comparer à la fondamentale
// donne un repère fixe indépendant de LAQUELLE de ces 2 notes produirait
// l'harmonique parasite.
function logMajorSeventhComparison(rootChroma: number, profile: Float32Array): void {
  const seventhChroma = (rootChroma + 11) % 12;
  const seventhMagnitude = profile[seventhChroma];

  let loudestMagnitude = -Infinity;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] > loudestMagnitude) loudestMagnitude = profile[i];
  }
  const rootMagnitude = profile[rootChroma];

  const formatDb = (value: number) => (value === -Infinity ? 'absente' : `${value.toFixed(1)}dB`);
  const formatGap = (reference: number) =>
    seventhMagnitude === -Infinity || reference === -Infinity
      ? 'n/a'
      : `${(reference - seventhMagnitude).toFixed(1)}dB`;

  console.log(
    `[Diag][Maj7] fondamentale=${CHROMA_PITCH_CLASSES[rootChroma]}(${formatDb(rootMagnitude)}) ` +
      `7e_majeure=${CHROMA_PITCH_CLASSES[seventhChroma]}(${formatDb(seventhMagnitude)}) ` +
      `écart_vs_plus_fort=${formatGap(loudestMagnitude)} écart_vs_fondamentale=${formatGap(rootMagnitude)}`,
  );
}

// Cherche les MAXIMA LOCAUX du spectre (plus fort que ses 2 voisins
// immédiats) au-dessus du seuil, dans la plage utile piano — un algo de
// détection de pics volontairement simple, PAS un vrai algo de détection de
// hauteur (pitch detection) robuste : c'est justement ce que ce test doit
// évaluer. Convertit chaque pic en note (via tonal), déduplique par NUMÉRO
// MIDI (2 bins voisins peuvent retomber sur la même note arrondie), trie du
// grave à l'aigu pour un affichage lisible.
function extractDetectedNotes(magnitudesDb: Float32Array, sampleRate: number, fftSize: number): string[] {
  const hzPerBin = sampleRate / fftSize;
  const minBin = Math.max(1, Math.floor(MIN_FREQUENCY_HZ / hzPerBin));
  const maxBin = Math.min(magnitudesDb.length - 2, Math.ceil(MAX_FREQUENCY_HZ / hzPerBin));

  const peaks: { frequency: number; magnitude: number }[] = [];
  for (let bin = minBin; bin <= maxBin; bin++) {
    const magnitude = magnitudesDb[bin];
    if (magnitude < MIN_DECIBELS_THRESHOLD) continue;
    if (magnitude > magnitudesDb[bin - 1] && magnitude > magnitudesDb[bin + 1]) {
      peaks.push({ frequency: bin * hzPerBin, magnitude });
    }
  }

  peaks.sort((a, b) => b.magnitude - a.magnitude);

  // DIAGNOSTIC (étape 4) — pics bruts AVANT le top-N, pour voir si le seuil
  // (MIN_DECIBELS_THRESHOLD) élimine tout, ou si des pics existent bel et
  // bien mais ne remontent pas jusqu'à l'affichage.
  if (peaks.length === 0) {
    console.log('[Diag][Peaks] Aucun pic local trouvé au-dessus du seuil', MIN_DECIBELS_THRESHOLD, 'dB');
  } else {
    console.log(
      `[Diag][Peaks] ${peaks.length} pic(s) brut(s) — top 5:`,
      peaks.slice(0, 5).map((p) => `${p.frequency.toFixed(1)}Hz@${p.magnitude.toFixed(1)}dB`),
    );
  }

  const loudestPeaks = peaks.slice(0, MAX_NOTES_DISPLAYED);

  const midiNumbers = Array.from(
    new Set(loudestPeaks.map((peak) => Math.round(Midi.freqToMidi(peak.frequency)))),
  );
  midiNumbers.sort((a, b) => a - b);

  return midiNumbers.map((midi) => Midi.midiToNoteName(midi, { sharps: true }));
}

export default function ChordDetectionTestScreen() {
  const [isListening, setIsListening] = useState(false);
  const [detectedNotes, setDetectedNotes] = useState<string[]>([]);
  // Accord "collant" affiché — voir recognizeChord/CHORD_STABILITY_POLLS en
  // haut de fichier : ne change que sur un nouvel accord confirmé sur
  // plusieurs sondes, ne s'efface jamais tout seul.
  const [recognizedChord, setRecognizedChord] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Champ optionnel (voir consigne) : juste un repère visuel pour comparer
  // "attendu" vs "détecté", AUCUNE comparaison automatique/logique dessus —
  // rester simple, comme demandé.
  const [expectedChord, setExpectedChord] = useState('');

  // Toutes les ressources audio vivent dans des refs (pas de state) : elles
  // ne doivent jamais déclencher de re-render à elles seules, seul l'état
  // dérivé (isListening/detectedNotes) doit le faire — même principe que
  // activeKeyTimeoutRef dans InteractivePiano.tsx.
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderAdapterRef = useRef<RecorderAdapterNode | null>(null);
  // Gain silencieux entre l'analyseur et destination — voir le commentaire
  // en haut de fichier (obligatoire pour que le graphe soit réellement
  // traité par le moteur de rendu, SANS rendre le micro audible).
  const silentGainRef = useRef<GainNode | null>(null);
  const magnitudesBufferRef = useRef<Float32Array | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Source de vérité de l'accord affiché, lue/écrite DANS la boucle de
  // sonde (setInterval) — un state y serait "figé" par la fermeture créée
  // au démarrage de l'écoute (même piège que pour les autres refs de ce
  // fichier) ; recognizedChord (state) n'est mis à jour qu'EN PLUS, pour
  // déclencher le re-rendu d'affichage.
  const recognizedChordRef = useRef<string | null>(null);
  // Nouvel accord "candidat" en cours de confirmation (voir
  // CHORD_STABILITY_POLLS) — remis à zéro dès que le candidat change ou
  // qu'il devient accepté.
  const pendingChordRef = useRef<{ label: string; count: number } | null>(null);

  // DIAGNOSTIC (étape 1) — compteur d'appels onAudioReady + amplitude brute
  // reçue depuis le DERNIER résumé loggé (voir diagSummaryIntervalRef) :
  // un tap INDÉPENDANT du graphe RecorderAdapterNode→AnalyserNode, pour
  // savoir si le recorder délivre RÉELLEMENT des données, même si le reste
  // du graphe est muet.
  const diagCallCountRef = useRef(0);
  const diagMaxAmplitudeRef = useRef(0);
  const diagSumAmplitudeRef = useRef(0);
  const diagSampleCountRef = useRef(0);
  const diagSummaryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Coupe proprement si l'écran est quitté pendant que l'écoute tourne —
  // sans ça, le micro resterait ouvert en arrière-plan.
  useEffect(() => {
    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopListening = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (diagSummaryIntervalRef.current) {
      clearInterval(diagSummaryIntervalRef.current);
      diagSummaryIntervalRef.current = null;
    }
    recorderRef.current?.clearOnAudioReady();
    recorderRef.current?.disconnect();
    recorderRef.current?.stop().catch(() => {
      // Rien à faire de plus ici : on quitte de toute façon l'écoute côté
      // UI ; une erreur d'arrêt ne doit pas bloquer le reste.
    });
    recorderRef.current = null;
    analyserRef.current = null;
    recorderAdapterRef.current = null;
    silentGainRef.current = null;
    magnitudesBufferRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    recognizedChordRef.current = null;
    pendingChordRef.current = null;
    setIsListening(false);
    setDetectedNotes([]);
    setRecognizedChord(null);
  };

  const startListening = async () => {
    setErrorMessage(null);

    try {
      const permission = await AudioManager.requestRecordingPermissions();
      console.log('[Diag][Étape 0] Permission micro:', permission);
      if (permission !== 'Granted') {
        setErrorMessage('Permission micro refusée — active-la dans les réglages du téléphone.');
        return;
      }

      const audioContext = new AudioContext();
      console.log(
        '[Diag][Étape 0] AudioContext créé — state=',
        audioContext.state,
        'sampleRate=',
        audioContext.sampleRate,
      );

      const recorder = new AudioRecorder();
      const recorderAdapter = audioContext.createRecorderAdapter();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.minDecibels = MIN_DECIBELS_THRESHOLD - 10;
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      // Micro → adaptateur → analyseur → gain SILENCIEUX → destination. Voir
      // le commentaire en haut de fichier : le moteur de rendu est un graphe
      // PULL entraîné depuis destination — sans ce chemin (même via un gain à
      // 0), l'analyseur n'est JAMAIS traité, quel que soit l'état du
      // contexte. Le gain à 0 garantit qu'aucun son du micro n'est
      // effectivement audible (pas de retour/larsen).
      recorder.connect(recorderAdapter);
      console.log('[Diag][Étape 3] recorder.connect(recorderAdapter) OK — wasConnected=', recorderAdapter.wasConnected);
      recorderAdapter.connect(analyser);
      console.log('[Diag][Étape 3] recorderAdapter.connect(analyser) OK');
      analyser.connect(silentGain);
      silentGain.connect(audioContext.destination);
      console.log('[Diag][Étape 3] analyser.connect(silentGain).connect(destination) OK — gain=', silentGain.gain.value);

      // CORRECTIF — le contexte démarre "suspended" (standard Web Audio) :
      // sans resume(), le moteur de rendu ne fait JAMAIS tourner le graphe
      // connecté ci-dessus, donc l'AnalyserNode ne reçoit jamais rien — c'est
      // exactement ce que le diagnostic précédent a localisé (max=-Infinity
      // en permanence tant que state reste "suspended", alors que le recorder
      // lui-même délivrait bien du son via onAudioReady). Attendu AVANT
      // recorder.start() : le graphe doit être prêt à traiter du son dès que
      // la capture démarre.
      try {
        await audioContext.resume();
      } catch (error) {
        setErrorMessage(
          `Échec de la reprise du contexte audio : ${error instanceof Error ? error.message : String(error)}`,
        );
        audioContext.close().catch(() => {});
        return;
      }
      console.log('[Diag][Étape 3] Après resume() — AudioContext.state=', audioContext.state);
      if (audioContext.state !== 'running') {
        console.log(
          '[Diag][Étape 3] ATTENTION — state toujours pas "running" après resume() : le graphe risque de rester muet.',
        );
      }

      // DIAGNOSTIC (étape 1) — tap INDÉPENDANT du graphe ci-dessus : lit les
      // buffers PCM bruts délivrés par le recorder lui-même (getChannelData),
      // pour savoir si le micro délivre RÉELLEMENT du son, même si le reste
      // du graphe (adapter→analyser) s'avère muet. N'interfère pas avec
      // connect() ci-dessus (2 mécanismes indépendants, voir AudioRecorder.d.ts).
      recorder.onAudioReady(
        { sampleRate: audioContext.sampleRate, bufferLength: 2048, channelCount: 1 },
        (event) => {
          diagCallCountRef.current += 1;
          const channelData = event.buffer.getChannelData(0);
          let maxAmplitude = 0;
          let sumAmplitude = 0;
          for (let i = 0; i < channelData.length; i++) {
            const abs = Math.abs(channelData[i]);
            if (abs > maxAmplitude) maxAmplitude = abs;
            sumAmplitude += abs;
          }
          diagMaxAmplitudeRef.current = Math.max(diagMaxAmplitudeRef.current, maxAmplitude);
          diagSumAmplitudeRef.current += sumAmplitude;
          diagSampleCountRef.current += channelData.length;
        },
      );

      diagSummaryIntervalRef.current = setInterval(() => {
        const calls = diagCallCountRef.current;
        if (calls === 0) {
          console.log('[Diag][Étape 1][onAudioReady] AUCUN appel reçu depuis 1s — le recorder ne délivre rien.');
        } else {
          const meanAmplitude = diagSampleCountRef.current > 0
            ? diagSumAmplitudeRef.current / diagSampleCountRef.current
            : 0;
          console.log(
            `[Diag][Étape 1][onAudioReady] ${calls} appel(s)/s — ampMax=${diagMaxAmplitudeRef.current.toFixed(4)} ampMoyenne=${meanAmplitude.toFixed(4)}`,
          );
        }
        diagCallCountRef.current = 0;
        diagMaxAmplitudeRef.current = 0;
        diagSumAmplitudeRef.current = 0;
        diagSampleCountRef.current = 0;
      }, 1000);

      const startResult = await recorder.start();
      console.log('[Diag][Étape 3] recorder.start() → status=', startResult.status);
      if (startResult.status === 'error') {
        setErrorMessage(`Échec du démarrage du micro : ${startResult.message}`);
        audioContext.close().catch(() => {});
        return;
      }
      console.log(
        '[Diag][Étape 3] Après start — AudioContext.state=',
        audioContext.state,
        'recorder.isRecording()=',
        recorder.isRecording(),
        'recorder.isPaused()=',
        recorder.isPaused(),
      );

      audioContextRef.current = audioContext;
      recorderRef.current = recorder;
      recorderAdapterRef.current = recorderAdapter;
      analyserRef.current = analyser;
      silentGainRef.current = silentGain;
      magnitudesBufferRef.current = new Float32Array(analyser.frequencyBinCount);

      pollIntervalRef.current = setInterval(() => {
        const currentAnalyser = analyserRef.current;
        const buffer = magnitudesBufferRef.current;
        if (!currentAnalyser || !buffer) return;

        currentAnalyser.getFloatFrequencyData(buffer);

        // DIAGNOSTIC (étape 2) — max/moyenne du spectre à CHAQUE sonde. Si
        // max reste à -Infinity (ou proche du plancher minDecibels), le son
        // n'arrive pas jusqu'à l'analyseur malgré le graphe connecté.
        let maxDb = -Infinity;
        let sumDb = 0;
        for (let i = 0; i < buffer.length; i++) {
          if (buffer[i] > maxDb) maxDb = buffer[i];
          sumDb += buffer[i];
        }
        console.log(
          `[Diag][Étape 2][Analyser] max=${maxDb.toFixed(1)}dB moyenne=${(sumDb / buffer.length).toFixed(1)}dB`,
        );

        setDetectedNotes(extractDetectedNotes(buffer, audioContext.sampleRate, FFT_SIZE));

        // Reconnaissance d'accord "collante" — voir le commentaire en haut
        // de fichier pour l'algo complet (chroma → fenêtre relative →
        // findTriadQuality → confirmation sur CHORD_STABILITY_POLLS sondes).
        const profile = buildChromaProfile(buffer, audioContext.sampleRate, FFT_SIZE);
        const presentChromaClasses = selectPresentChromaClasses(profile);
        const recognized = recognizeChord(presentChromaClasses, profile);

        if (recognized !== null && recognized !== recognizedChordRef.current) {
          if (pendingChordRef.current?.label === recognized) {
            pendingChordRef.current.count += 1;
          } else {
            pendingChordRef.current = { label: recognized, count: 1 };
          }

          if (pendingChordRef.current.count >= CHORD_STABILITY_POLLS) {
            recognizedChordRef.current = recognized;
            pendingChordRef.current = null;
            setRecognizedChord(recognized);
          }
        }
        // recognized === null (rien d'assez net ce cycle) OU déjà affiché :
        // on NE TOUCHE PAS à recognizedChord — il reste affiché tel quel
        // (comportement demandé : "collant" tant qu'un AUTRE accord n'est
        // pas confirmé).
      }, POLL_INTERVAL_MS);

      setIsListening(true);
    } catch (error) {
      setErrorMessage(`Erreur inattendue : ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening().catch((error) => {
        setErrorMessage(`Erreur inattendue : ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={theme.text.title}>Test détection d'accords (micro)</Text>
      <Text style={theme.text.subtitle}>
        Brique de diagnostic isolée — n'est branchée à rien d'autre dans l'app.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Accord que tu vas jouer (ex: Ré mineur) — optionnel"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        value={expectedChord}
        onChangeText={setExpectedChord}
      />

      <Pressable
        style={[styles.listenButton, isListening && styles.listenButtonActive]}
        onPress={handleToggleListening}
      >
        <Text style={styles.listenButtonLabel}>
          {isListening ? 'Arrêter l’écoute' : "Démarrer l'écoute"}
        </Text>
      </Pressable>

      {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

      {isListening && (
        <View style={styles.resultBlock}>
          {expectedChord.trim().length > 0 && (
            <Text style={styles.expectedText}>Attendu : {expectedChord.trim()}</Text>
          )}

          <View style={styles.recognizedChordBlock}>
            <Text style={styles.sectionLabel}>Accord reconnu</Text>
            <Text style={styles.recognizedChordLabel}>
              {recognizedChord ?? '…'}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Notes détectées (brut)</Text>
          {detectedNotes.length === 0 ? (
            <Text style={theme.text.subtitle}>…</Text>
          ) : (
            <View style={styles.notesRow}>
              {detectedNotes.map((note) => (
                <View key={note} style={styles.noteChip}>
                  <Text style={styles.noteChipLabel}>{note}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.text.size.md,
    color: theme.colors.text,
  },
  listenButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
  },
  listenButtonActive: {
    backgroundColor: theme.colors.danger,
  },
  listenButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
  },
  resultBlock: {
    gap: theme.spacing.sm,
  },
  expectedText: {
    fontSize: theme.text.size.md,
    color: theme.colors.textMuted,
  },
  // Bloc mis en avant (fond + rayon), pour bien distinguer l'accord
  // RECONNU (collant, "propre") de la liste de notes brutes en dessous.
  recognizedChordBlock: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
  },
  recognizedChordLabel: {
    fontSize: theme.text.size.xxl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  sectionLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  notesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  noteChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.exercice,
  },
  noteChipLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
});
