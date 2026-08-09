import { useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Interval, Note } from 'tonal';

import { theme } from '../theme';
import { fitNotesToRange, invertChord } from '../dataset/chordUtils';
import { jouerAccord } from '../lib/piano';
import { useQuetes } from '../context/QuetesContext';

// Props du composant : l'accord à afficher. On type ça avec une interface
// plutôt qu'un "any" pour que TypeScript nous protège si on passe autre
// chose qu'un tableau de chaînes.
//
// CHANGEMENT à cette étape : chaque note doit maintenant préciser son OCTAVE
// (notation Tonal, ex: "G3", "B3", "D4") au lieu d'un simple nom de note
// ("G", "B", "D"). Choix fait ici, le plus simple des deux proposés : garder
// "notes: string[]" tel quel plutôt qu'ajouter une prop séparée "octave de
// départ". Le clavier affiche, à partir de BASE_OCTAVE = 3, un nombre
// d'octaves qui s'adapte à l'accord reçu (2 au minimum, voir MIN_OCTAVES /
// le calcul de "octaves" plus bas) ; sans octave dans la prop, le composant
// ne peut pas savoir sur laquelle allumer une note donnée — c'est justement
// le bug de cette étape. C'est donc à l'appelant (ex:
// creation.tsx) de préciser l'octave de chaque note, comme le ferait Tonal
// lui-même (Chord.get(...).notes ne renvoie pas d'octave : il faudra les
// ajouter côté appelant, ex: ["G3", "B3", "D4"] pour un Sol majeur à l'état
// fondamental).
//
// La première note du tableau reste la fondamentale (root), utilisée pour
// calculer la fonction des autres notes (tierce, quinte...). La note dont la
// hauteur est la plus basse est en plus repérée comme la BASSE (voir
// getBassMidi plus bas) et reçoit une couleur différente ; pour un accord à
// l'état fondamental (le seul cas géré ici), basse et fondamentale sont la
// même note.
interface PianoChordProps {
  notes: string[];
  // Remplace le libellé de pastille calculé automatiquement (R/3/5/7/9/11/13,
  // via l'intervalle réel entre la note et la fondamentale) pour des notes
  // PRÉCISES, identifiées par leur CHROMA (0-11, indépendant de l'octave) —
  // utilisé pour les altérations idiomatiques (ex: ♯11 sur un accord
  // majeur), dont le libellé attendu ("♯11") ne correspond pas à ce que le
  // calcul générique produirait pour un intervalle augmenté composé. Le
  // chroma plutôt qu'un index ou un MIDI : il reste valide même après un
  // renversement ou un voicing (bassAndClusterVoicing), qui changent
  // l'octave/l'ordre des notes mais jamais leur chroma (voir
  // ExtendedChordResult dans chordUtils.ts). Optionnel : absent par défaut,
  // aucun appelant existant (creation.tsx, accords non altérés) n'est
  // concerné.
  functionLabelOverrides?: Map<number, string>;
  // Démarre l'arpège automatiquement au montage plutôt que d'attendre un tap
  // sur le bouton "Arpège 4 notes" — utilisé par la modale "Découvrir un
  // accompagnement" (improResult.tsx), qui veut montrer l'animation
  // immédiatement à l'ouverture, sans étape supplémentaire. Ne fait QUE
  // changer la valeur initiale de l'état "isArpeggioPlaying" (voir plus
  // bas) : le bouton reste affiché et fonctionnel (l'utilisateur peut
  // toujours arrêter/relancer), et le séquenceur/nettoyage des timers sont
  // exactement les mêmes que pour un démarrage manuel. Optionnel : absent
  // par défaut (false), aucun appelant existant n'est concerné.
  autoPlayArpeggio?: boolean;
  // Contrôles de renversement (flèches + indicateur "X/N") : affichés par
  // défaut (true), comme avant l'ajout de cette prop — aucun appelant
  // existant n'est donc concerné, sauf s'il passe explicitement `false`.
  // Toujours combiné avec les conditions existantes (accord pas étendu, pas
  // de séparation main gauche/main droite, voir inversionControlsVisible) :
  // `false` masque INCONDITIONNELLEMENT les contrôles, `true` (ou absent)
  // laisse ces conditions décider comme avant. Ajouté pour la modale
  // "Découvrir un accompagnement" (improResult.tsx), qui montre un accord
  // d'exemple fixe (un principe) et n'a donc pas besoin de le renverser.
  showInversionControls?: boolean;
  // Bouton "Arpège 4 notes"/"Arrêter l'arpège" : affiché par défaut (true),
  // comme avant l'ajout de cette prop. `false` le masque, sans rien changer
  // au séquenceur lui-même (voir isArpeggioPlaying/autoPlayArpeggio
  // ci-dessus) : un accord avec autoPlayArpeggio ET showArpeggioButton={false}
  // joue quand même l'arpège, simplement sans bouton pour l'arrêter/le
  // relancer manuellement — exactement le cas de la modale "Découvrir un
  // accompagnement" (improResult.tsx), qui veut un arpège 100% automatique.
  // Ajouté aussi pour retirer ce bouton du panneau d'accord de l'écran
  // résultat, où l'accompagnement passe désormais uniquement par cette
  // même modale.
  showArpeggioButton?: boolean;
}

// Nombre d'octaves affichées PAR DÉFAUT (triade, 7e) : suffit tant que
// l'accord reçu tient dans cette plage. Depuis les extensions (9e/11e/13e),
// ce n'est plus une constante fixe mais un MINIMUM — voir son calcul dans le
// composant (computeOctaveCount) : un accord plus large fait grandir le
// clavier au-delà de ce plancher, jamais en dessous.
const MIN_OCTAVES = 2;

// Garde-fou : nombre d'octaves MAXIMUM, même si un accord reçu (mal formé,
// ou notes anormalement dispersées) réclamerait davantage — évite un clavier
// démesuré/illisible. Un accord diatonique jusqu'au niveau 13 (le maximum
// géré par cet écran, 7 notes) ne dépasse jamais 3 octaves en pratique (vérifié
// pour toutes les toniques/degrés de gamme majeure et mineure), donc cette
// borne ne devrait jamais être atteinte dans l'usage normal.
const MAX_OCTAVES = 4;

// Octave de la 1ère touche "C" affichée (donc de toute la 1ère octave) ;
// chaque octave suivante ajoute 1 (la 2e octave commence à BASE_OCTAVE + 1,
// donc 4). C'est ce qui permet de savoir exactement à quelle note-avec-octave
// (ex: "C3", "C#3", "D3"...) correspond chaque touche dessinée.
const BASE_OCTAVE = 3;

// Hauteur du clavier : fixe, elle ne dépend ni du nombre d'octaves ni de la
// largeur de l'écran.
const KEYBOARD_HEIGHT = 120;

// Largeur MAXIMALE d'UNE octave (7 touches blanches) : borne le clavier pour
// qu'il ne devienne pas démesuré sur un grand écran/tablette, même quand le
// conteneur qui l'accueille est très large. Pas de borne MIN symétrique :
// avec une largeur mesurée sur le vrai conteneur (voir handleContainerLayout
// plus bas), imposer un minimum pourrait forcer le clavier à dépasser un
// conteneur trop étroit, ce qu'on veut justement éviter à tout prix — mieux
// vaut des touches plus fines que des touches qui débordent.
const MAX_OCTAVE_WIDTH = 280;

// Largeur de repli utilisée le temps d'un premier rendu, avant que
// handleContainerLayout n'ait mesuré la largeur réelle du conteneur (voir son
// commentaire). Évite un clavier à largeur nulle le temps d'une frame ;
// remplacée par la vraie mesure dès qu'elle est disponible.
const FALLBACK_KEYBOARD_WIDTH = 260;

// Seuil (en demi-tons) au-delà duquel l'écart entre deux notes ADJACENTES de
// l'accord affiché (une fois triées par hauteur) est considéré comme une
// séparation VOLONTAIRE "main gauche / main droite" (voicing basse + accord
// groupé, voir bassAndClusterVoicing dans chordUtils.ts) plutôt qu'un simple
// intervalle interne à l'accord. Choisi au-dessus de l'écart maximal
// possible entre deux notes adjacentes d'un accord diatonique empilé en
// tierces, quel que soit son renversement (vérifié : 6 demi-tons maximum,
// triade à 13e confondues), et nettement en dessous de l'écart minimal
// qu'introduit volontairement bassAndClusterVoicing entre la basse et le
// reste du groupe (au moins 13 demi-tons, une octave plus un demi-ton).
// Volontairement GÉNÉRIQUE plutôt qu'un booléen "mode voicing" transmis par
// l'appelant : PianoChord n'a pas besoin de savoir QUEL voicing lui a été
// donné, seulement s'il détecte un grand vide dans les notes reçues.
const HAND_SPLIT_THRESHOLD_MIDI = 8;

// Les 7 touches blanches d'UNE octave, dans l'ordre visuel de gauche à droite.
const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Répète WHITE_NOTES "octaves" fois pour obtenir la liste complète des
// touches blanches à afficher (ex : pour octaves = 2, C D E F G A B C D E F
// G A B). Comme les touches blanches sont simplement empilées dans l'ordre
// du tableau par flexDirection: 'row', pas besoin de recalculer leur
// position : "keyIndex" (0 à 7*octaves-1) ne sert qu'à fabriquer une clé
// React unique, puisque le même nom de note ("C", "D"...) revient à chaque
// octave. "octave" (BASE_OCTAVE pour la 1ère répétition, BASE_OCTAVE + 1
// pour la 2e, ...) est ce qui permet de reconstituer la note complète de la
// touche (ex: "C" + 3 → "C3") pour le matching avec l'accord reçu.
//
// Fonction plutôt que constante module-level depuis les extensions
// (9e/11e/13e) : le nombre d'octaves n'est plus fixe (voir MIN_OCTAVES /
// computeOctaveCount plus bas), donc cette liste doit être reconstruite à
// chaque rendu, avec le "octaves" de CET accord précis.
function buildWhiteKeys(octaves: number): { note: string; octave: number; keyIndex: number }[] {
  return Array.from(
    { length: octaves },
    (_, octaveIndex) =>
      WHITE_NOTES.map((note, indexInOctave) => ({
        note,
        octave: BASE_OCTAVE + octaveIndex,
        keyIndex: octaveIndex * WHITE_NOTES.length + indexInOctave,
      })),
  ).flat();
}

// Les touches noires ne sont pas régulièrement espacées : il n'y en a pas
// entre E-F ni entre B-C. BLACK_KEY_PATTERN décrit ce motif pour UNE octave
// (afterWhiteIndex de 0 à 6, l'indice de la touche blanche juste avant).
// buildBlackKeys répète ce motif "octaves" fois en décalant afterWhiteIndex
// de WHITE_NOTES.length (7) à chaque octave, pour obtenir des indices
// absolus cohérents avec buildWhiteKeys. Même remarque que ci-dessus : une
// fonction (reconstruite par rendu), pas une constante, depuis que le
// nombre d'octaves varie selon l'accord affiché.
const BLACK_KEY_PATTERN: { note: string; afterWhiteIndex: number }[] = [
  { note: 'C#', afterWhiteIndex: 0 },
  { note: 'D#', afterWhiteIndex: 1 },
  { note: 'F#', afterWhiteIndex: 3 },
  { note: 'G#', afterWhiteIndex: 4 },
  { note: 'A#', afterWhiteIndex: 5 },
];

function buildBlackKeys(octaves: number): { note: string; octave: number; afterWhiteIndex: number }[] {
  return Array.from(
    { length: octaves },
    (_, octaveIndex) =>
      BLACK_KEY_PATTERN.map(({ note, afterWhiteIndex }) => ({
        note,
        octave: BASE_OCTAVE + octaveIndex,
        afterWhiteIndex: octaveIndex * WHITE_NOTES.length + afterWhiteIndex,
      })),
  ).flat();
}

const BLACK_KEY_HEIGHT = KEYBOARD_HEIGHT * 0.6;

// Petit texte du nom de touche (ex: "C", "F#"), collé en bas de la touche.
// Pas de taille assez petite dans le thème (le plus petit, text.size.sm,
// vaut 13 et déborderait sur les touches noires qui ne font que 24px de
// large) : on garde donc une taille en dur ici.
const KEY_NAME_FONT_SIZE = 10;

// Pastille ronde de fonction (R, 3, 5, ...) posée en bas de la touche,
// juste au-dessus du nom de touche.
const FUNCTION_BADGE_SIZE = 18;
const FUNCTION_BADGE_FONT_SIZE = 10;

// Distance entre le bas de la touche et le bas de la pastille. Elle doit
// être assez grande pour laisser la place au nom de touche (ancré, lui, à
// bottom: theme.spacing.xs) sans que les deux se chevauchent : avec
// theme.spacing.lg (24), la pastille (haute de 18) se termine à 42px du bas
// de la touche, largement au-dessus du nom.
//
// C'est aussi ce qui règle le bug de recouvrement par les touches noires :
// une touche noire ne couvre que le HAUT de la touche blanche (elle fait
// BLACK_KEY_HEIGHT = 72 sur une touche blanche de 120), donc une pastille
// ancrée en bas (autour de y = 78 à 96 depuis le haut) tombe entièrement
// SOUS la zone recouverte par les noires (y = 0 à 72) : plus besoin qu'elle
// "passe au-dessus" d'une touche noire, puisqu'elle n'est simplement plus
// dans la même zone.
const FUNCTION_BADGE_BOTTOM = theme.spacing.lg;

// Repère la note la plus GRAVE de l'accord (la "basse"), en comparant les
// positions MIDI de toutes les notes reçues et en gardant la plus petite.
//
// On ne suppose pas que "la basse, c'est toujours notes[0]" : notes[0] est
// la fondamentale (root, utilisée pour calculer les fonctions plus bas), et
// pour un accord à l'état fondamental (le seul cas géré à cette étape) basse
// et fondamentale sont effectivement la même note — mais calculer la basse
// à partir des hauteurs réelles, plutôt que de la déduire de l'ordre du
// tableau, reste correct même si l'ordre change (utile plus tard pour les
// renversements, où la basse ne sera plus la fondamentale).
function getBassMidi(chordNotes: string[]): number | null {
  const midiValues = chordNotes
    .map((note) => Note.midi(note))
    .filter((midi): midi is number => midi !== null);

  if (midiValues.length === 0) return null;
  return Math.min(...midiValues);
}

// 4 catégories utilisées uniquement pour choisir une couleur de pastille.
type FunctionCategory = 'root' | 'third' | 'fifth' | 'other';

// Le thème n'a pas de couleurs dédiées aux fonctions d'accord (fondamentale/
// tierce/quinte/autre) : on réutilise donc des couleurs déjà présentes dans
// theme.colors plutôt que d'en inventer de nouvelles. À noter que
// colors.exercice et colors.backGroundExercice ont été créées pour un autre
// usage (les cartes d'exercice) ; les réutiliser ici fonctionne visuellement
// mais des tokens dédiés (ex: colors.chordThird, colors.chordFifth) seraient
// plus propres à terme.
const FUNCTION_BADGE_BACKGROUND: Record<FunctionCategory, string> = {
  root: theme.colors.primary,
  third: theme.colors.exercice,
  fifth: theme.colors.backGroundExercice,
  other: theme.colors.textMuted,
};

// Couleur du texte de la pastille : blanc partout, sauf sur fond jaune
// (fifth) où un texte sombre reste lisible.
const FUNCTION_BADGE_TEXT: Record<FunctionCategory, string> = {
  root: '#FFFFFF',
  third: '#FFFFFF',
  fifth: theme.colors.text,
  other: '#FFFFFF',
};

interface NoteFunction {
  label: string;
  category: FunctionCategory;
}

// Transforme un intervalle Tonal (ex: { num: 3, q: 'm' } pour une tierce
// mineure) en étiquette courte et lisible : "m3", "3", "+5", "°7"...
// - q === 'm' (mineur)     → "m" + le degré (ex: "m3", "m7")
// - q === 'A' (augmenté)   → "+" + le degré (ex: "+5")
// - q === 'd' (diminué)    → "°" + le degré (même symbole que celui déjà
//                            utilisé dans l'app pour les accords diminués,
//                            ex: "ii°" dans creation.tsx)
// - q === 'M' ou 'P' (majeur / juste) → le degré seul suffit, c'est la
//   valeur "par défaut" attendue pour cet intervalle (ex: "3" pour une
//   tierce majeure, "5" pour une quinte juste).
function formatIntervalLabel(num: number, quality: string): string {
  if (quality.startsWith('m')) return `m${num}`;
  if (quality.startsWith('A')) return `+${num}`;
  if (quality.startsWith('d')) return `°${num}`;
  return `${num}`;
}

// Range un intervalle dans une des 4 catégories, à partir de son degré
// (1 = fondamentale, 3 = tierce, 5 = quinte, tout le reste = "other").
function intervalNumToCategory(num: number): FunctionCategory {
  if (num === 1) return 'root';
  if (num === 3) return 'third';
  if (num === 5) return 'fifth';
  return 'other';
}

// Ramène un degré d'intervalle "composé" à son équivalent "simple" dans une
// octave. Nécessaire depuis l'ajout des renversements : un renversement fait
// remonter une note d'une octave (voir invertChord), donc l'intervalle entre
// elle et la fondamentale peut devenir composé (ex: "8P", une octave, au lieu
// de "1P" à l'état fondamental ; "10M" au lieu de "3M"...). Sans cette
// réduction, la pastille de fonction changerait selon le renversement, alors
// qu'elle doit rester la même (Sol reste "R", Si reste "3", peu importe qui
// est à la basse).
//
// ((num - 1) % 7) + 1 fait tourner le degré dans 1..7 : 8 → 1, 9 → 2,
// 10 → 3, ... 15 → 1, etc. Un cas particulier à connaître : Tonal ne réduit
// PAS lui-même une octave (interval.simple vaut 8, pas 1) — c'est justement
// pour ça qu'on fait ce calcul nous-mêmes plutôt que d'utiliser
// interval.simple directement.
function toSimpleDegree(num: number): number {
  return ((num - 1) % 7) + 1;
}

// Calcule, pour chaque note de l'accord AFFICHÉ (donc potentiellement déjà
// renversé par invertChord), sa fonction par rapport à la fondamentale de
// l'accord, et range le résultat dans une Map indexée par MIDI (la même
// notion de "hauteur exacte, octave incluse" que isNoteInChord utilise déjà)
// pour pouvoir la retrouver facilement touche par touche.
//
// "root" est maintenant un paramètre séparé plutôt que "chordNotes[0]" :
// avec les renversements, la fondamentale n'est plus forcément la 1ère note
// du tableau affiché (ex: en 1er renversement de Sol majeur, c'est Si qui
// est en tête). L'appelant doit donc passer la fondamentale de l'accord à
// l'état FONDAMENTAL, qui ne change jamais quel que soit le renversement.
//
// Pour chaque note, on compare d'abord son chroma à celui de la racine : si
// c'est la même note (à n'importe quelle octave), c'est la fondamentale →
// "R", peu importe l'octave où invertChord l'a placée. Sinon, on calcule
// l'intervalle avec Interval.distance(root, note), qui renvoie le nom de
// l'intervalle séparant deux notes (ex: Interval.distance('C', 'Eb') → "3m",
// une tierce mineure) ; Interval.get(...) décompose ce nom en { num, q } :
// num est le degré (1, 3, 5, ...) et q sa qualité ('P' juste, 'M' majeur,
// 'm' mineur, 'A' augmenté, 'd' diminué). toSimpleDegree(num) ramène ce degré
// dans 1..7 au cas où le renversement a rendu l'intervalle composé (voir son
// commentaire pour le détail).
//
// Point important, déjà vrai avant les renversements : l'intervalle est
// calculé à partir du nom de note tel qu'il est écrit dans les notes reçues
// (ex: "Eb4"), et PAS à partir du nom fixe de la touche du clavier (qui, lui,
// est toujours écrit avec un dièse, ex: "D#"). Si on utilisait le nom de la
// touche, on obtiendrait parfois le mauvais résultat : Interval.distance('C',
// 'D#') renvoie "2A" (seconde augmentée) alors que la vraie fonction, si
// cette touche représente en réalité un Eb de l'accord, est "3m" (tierce
// mineure). C'est pour ça qu'on parcourt ici les notes de l'accord (bien
// orthographiées par Tonal), et qu'on relie seulement le résultat à une
// touche via son MIDI.
function getChordNoteFunctions(chordNotes: string[], root: string): Map<number, NoteFunction> {
  const functionByMidi = new Map<number, NoteFunction>();
  const rootChroma = Note.chroma(root);

  chordNotes.forEach((note) => {
    const midi = Note.midi(note);
    if (midi === null) return; // note mal orthographiée ou sans octave : on l'ignore

    if (Note.chroma(note) === rootChroma) {
      functionByMidi.set(midi, { label: 'R', category: 'root' });
      return;
    }

    const interval = Interval.get(Interval.distance(root, note));
    if (interval.empty) return;

    const simpleNum = toSimpleDegree(interval.num);
    functionByMidi.set(midi, {
      label: formatIntervalLabel(simpleNum, interval.q),
      category: intervalNumToCategory(simpleNum),
    });
  });

  return functionByMidi;
}

// Durées de l'arpège (en ms) : chaque note reste allumée
// ARPEGGIO_NOTE_ON_MS, puis s'éteint pendant ARPEGGIO_NOTE_GAP_MS avant que
// la suivante ne s'allume — ce court "blanc" est ce qui rend les 4 notes
// perceptibles une par une plutôt que comme un glissement continu.
// ARPEGGIO_NOTE_ON_MS est dans la fourchette demandée (~350-500ms allumé).
const ARPEGGIO_NOTE_ON_MS = 400;
const ARPEGGIO_NOTE_GAP_MS = 120;

// Construit la séquence MIDI de l'arpège : TOUJOURS la triade de l'accord
// (fondamentale, tierce, quinte), plus la fondamentale à l'octave
// supérieure comme 4e note — quel que soit le niveau d'enrichissement
// affiché par ailleurs (9e/11e/13e) ou le voicing en cours. On repart de
// "notes" (la position fondamentale REÇUE en prop, pas displayedNotes) pour
// que l'arpège reste toujours la même triade "de référence", indépendamment
// du renversement actuellement navigué.
//
// On retrouve la tierce et la quinte en réutilisant getChordNoteFunctions
// (déjà utilisée pour les pastilles R/3/5/7/9...), en cherchant la 1ère
// note de catégorie 'third' et 'fifth' : ces catégories existent toujours
// dans "notes", qui contient au minimum la triade complète, quel que soit
// le niveau (voir NOTE_COUNT_BY_LEVEL dans chordUtils.ts, minimum 3 notes).
function buildArpeggioSequence(notes: string[]): number[] {
  const root = notes[0];
  const rootMidi = Note.midi(root);
  if (rootMidi === null) return [];

  const functions = getChordNoteFunctions(notes, root);
  let thirdMidi: number | null = null;
  let fifthMidi: number | null = null;

  for (const [midi, noteFunction] of functions) {
    if (noteFunction.category === 'third' && thirdMidi === null) thirdMidi = midi;
    if (noteFunction.category === 'fifth' && fifthMidi === null) fifthMidi = midi;
  }

  if (thirdMidi === null || fifthMidi === null) return [];

  return [rootMidi, thirdMidi, fifthMidi, rootMidi + 12];
}

export function PianoChord({
  notes,
  functionLabelOverrides,
  autoPlayArpeggio,
  showInversionControls = true,
  showArpeggioButton = true,
}: PianoChordProps) {
  // Voir handleListenPress plus bas — PianoChord est monté partout où un
  // accord peut être écouté (résultat impro, Crée ta progression, panneaux
  // voicing/accompagnement), toujours SOUS QuetesProvider (voir App.tsx) :
  // useQuetes() y est donc toujours disponible.
  const { avancerQuete } = useQuetes();

  // Largeur RÉELLE du conteneur (styles.container ci-dessous), mesurée via
  // onLayout plutôt que déduite de useWindowDimensions - largeur.
  //
  // Pourquoi le changement : useWindowDimensions ne connaît que la largeur de
  // l'ÉCRAN, pas celle du conteneur parent exact dans lequel PianoChord est
  // monté. Un appelant peut empiler plusieurs paddings autour du clavier
  // (padding du ScrollView + padding d'une carte + etc.) ; deviner leur somme
  // avec une constante fixe (l'ancienne RESPONSIVE_HORIZONTAL_MARGIN) se
  // désynchronise dès qu'un appelant a une mise en page différente — c'est
  // exactement ce qui causait un clavier plus large que son conteneur. Mesurer
  // la largeur réellement attribuée à CE conteneur (via onLayout) est donc la
  // seule méthode fiable, quel que soit l'empilement de paddings autour.
  //
  // null tant que la première mesure n'est pas arrivée (avant le tout premier
  // onLayout) : FALLBACK_KEYBOARD_WIDTH sert de largeur de repli le temps de
  // cette frame initiale.
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  // Nombre d'octaves affichées POUR CET ACCORD précis, calculé à partir de sa
  // note la plus haute — gestion du débordement clavier pour les accords
  // enrichis (9e/11e/13e).
  //
  // "notes" est toujours reçu en position fondamentale, déjà trié du grave à
  // l'aigu (voir chordNotesWithOctaves/degreeToExtendedNotes) : sa DERNIÈRE
  // note est donc la plus haute. On calcule combien d'octaves, à partir de
  // BASE_OCTAVE, sont nécessaires pour que cette note tienne sur le clavier
  // — MIN_OCTAVES sert de plancher (jamais moins que l'affichage habituel
  // triade/7e), MAX_OCTAVES de garde-fou (jamais plus, voir son commentaire).
  //
  // Volontairement basé sur "notes" (la position FONDAMENTALE), pas sur
  // "displayedNotes" (calculé plus bas, qui dépend du renversement courant) :
  // ça évite que le clavier change de taille à chaque clic sur les flèches de
  // renversement (déstabilisant visuellement) — sa taille reste stable pour
  // TOUT l'accord, quel que soit le renversement affiché. fitNotesToRange
  // (plus bas) reste chargé de faire tenir chaque renversement individuel
  // dans cette taille une fois fixée.
  const highestFundamentalMidi = Note.midi(notes[notes.length - 1]) ?? Note.midi(`B${BASE_OCTAVE}`) ?? 0;
  const lowestPossibleMidi = Note.midi(`C${BASE_OCTAVE}`) ?? 0;
  const octavesNeeded = Math.ceil((highestFundamentalMidi - lowestPossibleMidi + 1) / 12);
  const octaves = Math.min(MAX_OCTAVES, Math.max(MIN_OCTAVES, octavesNeeded));

  // Bornes MIDI du clavier RÉELLEMENT affiché (dépendent de "octaves",
  // calculé juste au-dessus) : la 1ère touche (C de la 1ère octave) et la
  // dernière (B de la dernière octave). Utilisées par fitNotesToRange pour
  // savoir jusqu'où un accord peut monter avant de déborder par le haut.
  const keyboardLowMidi = lowestPossibleMidi;
  const keyboardHighMidi = Note.midi(`B${BASE_OCTAVE + octaves - 1}`) ?? 127;

  const allWhiteKeys = buildWhiteKeys(octaves);
  const allBlackKeys = buildBlackKeys(octaves);

  // On en déduit la largeur d'UNE octave, plafonnée à MAX_OCTAVE_WIDTH pour
  // ne pas devenir démesurée sur un grand écran, mais SURTOUT jamais plus
  // large que ce que le conteneur mesuré peut accueillir : c'est ce second
  // point (absent avant) qui garantit que le clavier ne déborde plus jamais
  // — y compris avec PLUS de 2 octaves (un accord enrichi élargit le clavier
  // mais rétrécit proportionnellement chaque octave pour rester dans le
  // conteneur, jamais l'inverse). Tout ce qui dépend de cette largeur
  // (clavier, touches, pastilles) est donc calculé ICI, à chaque rendu.
  // FUNCTION_BADGE_SIZE, KEY_NAME_FONT_SIZE et KEYBOARD_HEIGHT, eux, restent
  // des constantes fixes : seule la largeur devient responsive, pas la
  // taille du texte/des pastilles ni la hauteur.
  const availableWidth = containerWidth ?? FALLBACK_KEYBOARD_WIDTH;
  const octaveWidth = Math.min(MAX_OCTAVE_WIDTH, availableWidth / octaves);
  const keyboardWidth = octaveWidth * octaves;
  const whiteKeyWidth = octaveWidth / WHITE_NOTES.length;
  const blackKeyWidth = whiteKeyWidth * 0.6;
  const whiteKeyBadgeLeft = (whiteKeyWidth - FUNCTION_BADGE_SIZE) / 2;
  const blackKeyBadgeLeft = (blackKeyWidth - FUNCTION_BADGE_SIZE) / 2;

  // État interne du renversement actuellement affiché : 0 = fondamental,
  // 1 = 1er renversement, etc. useState() crée cette variable dans l'instance
  // du composant qui l'appelle : chaque <PianoChord> monté à l'écran (un par
  // bloc-accord dans creation.tsx) a donc SON PROPRE état "inversion", séparé
  // de celui des autres — naviguer sur l'un ne touche pas les autres.
  //
  // "notes" (la prop) reste toujours l'état fondamental reçu de l'appelant ;
  // l'appelant ne change pas et ne sait même pas qu'un renversement est
  // affiché. C'est ce composant qui, à partir de ce même "notes", recalcule
  // à chaque rendu les notes du renversement courant (voir invertedNotes).
  const [inversion, setInversion] = useState(0);

  // Un accord ÉTENDU (9e/11e/13e, 5 notes ou plus) n'a pas de renversement
  // musicalement sensé : à ce point, l'accord contient presque toute la
  // gamme, donc "renverser" (faire remonter la basse par-dessus le reste)
  // colle simplement des notes adjacentes de la gamme les unes à côté des
  // autres, sans rien évoquer d'un vrai renversement. On se base sur
  // notes.length (3 = triade, 4 = 7e, 5+ = étendu) plutôt que sur un
  // "niveau" transmis explicitement : dans cette app, le nombre de notes de
  // l'accord reçu correspond TOUJOURS exactement à son niveau
  // d'enrichissement (voir NOTE_COUNT_BY_LEVEL dans chordUtils.ts), donc pas
  // besoin de faire remonter ce concept jusqu'à PianoChord.
  const isExtendedChord = notes.length > 4;

  // Si l'accord affiché DEVIENT étendu (ex: l'appelant passe de "7e" à "9e"
  // pour LE MÊME accord, sans démonter <PianoChord>), on réinitialise
  // l'ÉTAT PERSISTANT du renversement à 0. useEffect ne s'exécute qu'APRÈS
  // le rendu, donc ce seul reset ne suffit pas à empêcher, le temps d'UN
  // rendu, qu'un renversement resté actif juste avant s'applique encore à
  // l'accord étendu (voir effectiveInversion juste en dessous, qui corrige
  // ce cas immédiatement). Ce reset de l'état, lui, sert pour la SUITE :
  // il garantit qu'un retour ultérieur à triade/7e reparte de la position
  // fondamentale (0), comme demandé, plutôt que de reprendre l'ancien
  // renversement resté stocké dans "inversion".
  useEffect(() => {
    if (isExtendedChord) {
      setInversion(0);
    }
  }, [isExtendedChord]);

  // Renversement RÉELLEMENT appliqué à ce rendu : 0 pour un accord étendu,
  // même sur le tout premier rendu où isExtendedChord vient de passer à
  // true (avant que l'effet ci-dessus n'ait eu la main pour remettre
  // "inversion" à 0) — cette dérivation, calculée pendant le rendu, évite
  // tout affichage intermédiaire incorrect (un accord étendu montré
  // renversé, même une seule frame).
  const effectiveInversion = isExtendedChord ? 0 : inversion;

  // Nombre de renversements possibles = nombre de notes de l'accord reçu
  // (3 pour une triade, jusqu'à 7 pour un accord de 13e : fondamental, puis
  // un renversement par note restante).
  const totalInversions = notes.length;

  // Notes du renversement demandé, avant vérification qu'il tient sur le
  // clavier affiché. invertChord garantit que le résultat reste trié du
  // grave à l'aigu quelle que soit la taille de l'accord (voir son
  // commentaire pour le correctif nécessaire aux accords enrichis, dont
  // l'étendue peut dépasser une octave).
  const invertedNotes = invertChord(notes, effectiveInversion);

  // Un renversement fait remonter la (les) note(s) grave(s) par-dessus les
  // autres : ça peut pousser la note la plus aiguë au-dessus de la dernière
  // touche du clavier (ex: 2e renversement de La mineur → ["E4","A4","C5"],
  // C5 dépasse B4). fitNotesToRange fait alors redescendre TOUT l'accord
  // d'une octave pour qu'il tienne entre keyboardLowMidi et keyboardHighMidi
  // (calculés plus haut pour CET accord), sans changer les notes ni le
  // renversement — displayedNotes est donc ce qu'il faut afficher (et sur
  // quoi calculer fonctions/basse), invertedNotes n'étant qu'une étape
  // intermédiaire.
  const displayedNotes = fitNotesToRange(invertedNotes, keyboardLowMidi, keyboardHighMidi);

  // Détecte un éventuel écart "main gauche / main droite" dans l'accord
  // affiché (voir HAND_SPLIT_THRESHOLD_MIDI) : le plus grand écart entre
  // deux notes ADJACENTES une fois triées par hauteur, et sa position MIDI
  // (au milieu de cet écart). Sert à la fois à :
  // - verrouiller la navigation entre renversements : elle n'a pas de sens
  //   pour un voicing à arrangement fixe (la fondamentale doit rester seule
  //   dans le grave — un renversement la ferait remonter au milieu du
  //   reste, cassant justement la séparation voulue) ;
  // - positionner le séparateur visuel entre les deux zones (rendu plus
  //   bas, juste avant la barre de renversements).
  const sortedDisplayedMidis = displayedNotes
    .map((note) => Note.midi(note))
    .filter((midi): midi is number => midi !== null)
    .sort((a, b) => a - b);

  let handSplitMidi: number | null = null;
  for (let i = 1; i < sortedDisplayedMidis.length; i++) {
    const gap = sortedDisplayedMidis[i] - sortedDisplayedMidis[i - 1];
    if (gap >= HAND_SPLIT_THRESHOLD_MIDI) {
      handSplitMidi = sortedDisplayedMidis[i - 1] + gap / 2;
      break; // le 1er (donc le plus grave) grand écart suffit : un voicing basse+groupe n'en a qu'un.
    }
  }

  // Les contrôles de renversement (flèches + indicateur X/N) ne s'affichent
  // que si TOUTES CES conditions tiennent : showInversionControls pas
  // explicitement désactivé par l'appelant (voir son commentaire dans
  // PianoChordProps) ET accord pas étendu (triade/7e seulement, voir
  // isExtendedChord) ET pas de séparation main gauche/main droite détectée
  // (voir handSplitMidi) — les renversements n'ont de sens musical dans
  // AUCUN de ces cas.
  const inversionControlsVisible = showInversionControls && !isExtendedChord && handSplitMidi === null;

  // Position en pixels du séparateur, calquée sur la 1ère touche blanche
  // dont la hauteur dépasse handSplitMidi (son bord gauche = la frontière
  // entre les deux zones). null si aucun grand écart détecté (position
  // théorique normale) ou si la frontière tombe avant la 1ère touche.
  let handSplitLeft: number | null = null;
  if (handSplitMidi !== null) {
    const boundaryIndex = allWhiteKeys.findIndex(
      ({ note, octave }) => (Note.midi(`${note}${octave}`) ?? Infinity) >= (handSplitMidi as number),
    );
    if (boundaryIndex > 0) {
      handSplitLeft = boundaryIndex * whiteKeyWidth;
    }
  }

  // La fondamentale de l'accord ne change JAMAIS avec les renversements (Sol
  // reste la fondamentale d'un Sol majeur même quand Si ou Ré est à la
  // basse) : on la prend donc sur les notes fondamentales reçues (notes[0]),
  // jamais sur displayedNotes (dont la 1ère note change selon le renversement
  // et l'ajustement d'octave).
  const root = notes[0];

  // Une seule fois par rendu : la fonction (R, 3, 5...) de chaque note
  // affichée (indexée par MIDI), et la hauteur MIDI de la basse (la note la
  // plus grave affichée — elle change donc quand on navigue ou quand
  // fitNotesToRange redescend l'accord).
  const noteFunctions = getChordNoteFunctions(displayedNotes, root);
  const bassMidi = getBassMidi(displayedNotes);

  // STATE DE L'ARPÈGE : joue-t-il actuellement ? (togglé par le bouton plus
  // bas, ou démarré directement si autoPlayArpeggio est vrai — voir son
  // commentaire dans PianoChordProps) et quelle note (MIDI) est allumée en
  // ce moment, le cas échéant — null veut dire "rien d'allumé", que ce soit
  // parce que l'arpège est arrêté, ou parce qu'on est dans le court "blanc"
  // entre deux notes (voir le séquenceur ci-dessous).
  const [isArpeggioPlaying, setIsArpeggioPlaying] = useState(autoPlayArpeggio ?? false);
  const [arpeggioActiveMidi, setArpeggioActiveMidi] = useState<number | null>(null);

  // Séquence MIDI de l'arpège (voir buildArpeggioSequence) et sa version
  // texte (arpeggioSequenceKey), utilisée UNIQUEMENT comme dépendance
  // stable pour l'effet ci-dessous.
  //
  // Pourquoi une clé texte plutôt que "notes" ou "arpeggioSequence"
  // directement : "notes" est un NOUVEAU tableau à chaque rendu de
  // l'appelant (degreeToExtendedNotes/bassAndClusterVoicing en recréent un
  // à chaque appel, même à contenu identique), et arpeggioSequence
  // ci-dessous en est un nouveau aussi (recalculé chaque rendu). Si l'effet
  // dépendait de l'un de ces deux tableaux, la comparaison de dépendances de
  // React (qui compare par RÉFÉRENCE) le verrait "changer" à CHAQUE rendu et
  // relancerait l'arpège depuis le début en boucle, au lieu de le laisser
  // tourner en continu. Une chaîne de caractères, elle, se compare par
  // VALEUR : elle ne change que si le CONTENU de la séquence change
  // vraiment (ex : sélection d'un autre accord).
  const arpeggioSequence = buildArpeggioSequence(notes);
  const arpeggioSequenceKey = arpeggioSequence.join(',');

  // SÉQUENCEUR DE L'ARPÈGE : programme le passage d'une note à l'autre dans
  // le temps avec des setTimeout ENCHAÎNÉS (chaque étape programme
  // elle-même la suivante), plutôt qu'un setInterval à période fixe — chaque
  // étape a en réalité DEUX durées différentes à respecter (allumée, puis
  // éteinte), ce qu'un setInterval à période unique ne permet pas
  // directement.
  //
  // Cycle pour CHAQUE note de la séquence (fondamentale, tierce, quinte,
  // fondamentale + octave, dans cet ordre, en boucle) :
  //   1. On l'allume (setArpeggioActiveMidi(midi)) — c'est ICI qu'il
  //      faudra déclencher le son de cette note plus tard.
  //   2. Après ARPEGGIO_NOTE_ON_MS, on l'éteint (setArpeggioActiveMidi(null)) :
  //      c'est le court "blanc" qui sépare visuellement chaque note.
  //   3. Après encore ARPEGGIO_NOTE_GAP_MS, on passe à la note suivante
  //      (index + 1, modulo la longueur de la séquence pour boucler
  //      indéfiniment) et on recommence au point 1.
  //
  // NETTOYAGE DES TIMERS : l'effet renvoie une fonction de nettoyage qui
  // annule le timer ACTUELLEMENT programmé (clearTimeout(timeoutId) —
  // "timeoutId" est une variable "let" réassignée à chaque nouvelle
  // programmation dans lightUpStep, donc le nettoyage annule toujours le
  // bon timer, quelle que soit l'étape en cours au moment où il se
  // déclenche). React appelle cette fonction automatiquement dans deux cas,
  // ce qui couvre à la fois "l'arrêt" et "le démontage" demandés : au
  // démontage du composant (on change d'accord, on quitte l'écran...), ET
  // juste avant CHAQUE ré-exécution de l'effet (donc dès que
  // isArpeggioPlaying passe à false, ou que l'accord change) — sans ce
  // nettoyage, arrêter puis relancer l'arpège ferait tourner plusieurs
  // boucles de timers en parallèle (fuite + comportement erratique).
  useEffect(() => {
    if (!isArpeggioPlaying || arpeggioSequence.length === 0) {
      setArpeggioActiveMidi(null);
      return;
    }

    let stepIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const lightUpStep = () => {
      setArpeggioActiveMidi(arpeggioSequence[stepIndex]);

      // TODO: jouer le son de chaque note ici

      timeoutId = setTimeout(() => {
        setArpeggioActiveMidi(null);

        timeoutId = setTimeout(() => {
          stepIndex = (stepIndex + 1) % arpeggioSequence.length;
          lightUpStep();
        }, ARPEGGIO_NOTE_GAP_MS);
      }, ARPEGGIO_NOTE_ON_MS);
    };

    lightUpStep();

    return () => clearTimeout(timeoutId);
    // "notes" et "arpeggioSequence" sont volontairement ABSENTS de ce
    // tableau de dépendances : arpeggioSequenceKey les représente déjà par
    // valeur (voir son commentaire plus haut pour le pourquoi).
  }, [isArpeggioPlaying, arpeggioSequenceKey]);

  // Notes à mettre en valeur sur le clavier : SOIT tout l'accord affiché
  // normalement (displayedNotes), SOIT — pendant l'arpège — la seule note
  // actuellement allumée (arpeggioActiveMidi), ou aucune pendant le court
  // "blanc" entre deux notes.
  //
  // Comparé par POSITION MIDI (Note.midi), pas par nom de note : Note.midi
  // encode à la fois la hauteur (do, do#, ré...) ET l'octave dans un seul
  // nombre entier (ex: Note.midi('C4') === 60, Note.midi('C3') === 48), donc
  // une touche du clavier ne matche que si elle tombe EXACTEMENT sur la même
  // octave qu'une note de l'accord — comparer par simple nom/chroma (qui
  // ignore l'octave) allumerait à tort la même note sur CHAQUE octave
  // affichée. Le matching reste "enharmonique" (Note.midi('Db4') ===
  // Note.midi('C#4')), Note.midi normalisant les deux à la même valeur.
  const highlightedMidiSet = isArpeggioPlaying
    ? new Set(arpeggioActiveMidi !== null ? [arpeggioActiveMidi] : [])
    : new Set(
        displayedNotes.map((note) => Note.midi(note)).filter((midi): midi is number => midi !== null),
      );

  // Navigation : on boucle aux extrémités (dernier renversement → 1er et
  // inversement) plutôt que de bloquer les boutons. Choix fait parce qu'une
  // triade n'a que 3 renversements : les renversements sont cycliques par
  // nature (après le dernier, on "retombe" logiquement sur le fondamental
  // une octave plus haut), et boucler évite d'avoir à griser un bouton.
  const goToPreviousInversion = () => {
    setInversion((current) => (current - 1 + totalInversions) % totalInversions);
  };

  const goToNextInversion = () => {
    setInversion((current) => (current + 1) % totalInversions);
  };

  // BOUTON "ÉCOUTER" — joue l'accord PLAQUÉ (toutes les notes en même temps,
  // voir jouerAccord dans src/lib/piano.ts) tel qu'il est RÉELLEMENT affiché
  // en ce moment : "displayedNotes" est déjà la liste finale calculée plus
  // haut pour le dessin du clavier (renversement courant + ajustement
  // d'octave via fitNotesToRange inclus) — on la réutilise TELLE QUELLE, pas
  // de recalcul séparé, pour garantir que ce qu'on entend correspond
  // exactement à ce qui est montré. jouerAccord() gère elle-même la
  // polyphonie et la libération des ressources (voir ses commentaires) :
  // ce composant n'a rien de plus à faire que l'appeler.
  const handleListenPress = () => {
    jouerAccord(displayedNotes).catch((error) => {
      // Pas d'affichage d'erreur dédié ici (bouton simple, pas d'état de
      // chargement/erreur porté par PianoChord) — au moins visible en
      // console pour le débogage si la lecture échoue.
      console.warn('jouerAccord a échoué :', error);
    });

    // QUÊTE DU JOUR 'accords_ecoutes' — comptée sur l'INTENTION d'écouter
    // (le tap lui-même), pas sur le succès réel de la lecture audio : pas
    // chaînée après jouerAccord() ci-dessus, pour ne jamais dépendre d'un
    // éventuel échec audio (voir son .catch, purement journalisé). "void" :
    // no-op silencieux si aucune quête 'accords_ecoutes' n'a été tirée
    // aujourd'hui, comme partout ailleurs où avancerQuete est appelé.
    void avancerQuete('accords_ecoutes', 1);
  };

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
    <View style={{ width: keyboardWidth }}>
      {/* Liseré rouge tout en haut du clavier (comme le feutre rouge d'un
          vrai piano) : un bloc statique posé AU-DESSUS de .keyboard, pas à
          l'intérieur — .keyboard (et sa largeur adaptative, et le
          positionnement des touches noires en position: 'absolute'/top: 0,
          calculé relativement à CE conteneur) reste ainsi rigoureusement
          inchangé. Ce wrapper n'a pas de gap : le liseré touche directement
          le haut des touches, sans espace visible entre les deux. */}
      <View style={[styles.pianoStrip, { width: keyboardWidth }]} />
    <View style={[styles.keyboard, { width: keyboardWidth }]}>
      {allWhiteKeys.map(({ note, octave, keyIndex }) => {
        // On reconstitue la note complète de CETTE touche (ex: "C" + 3 →
        // "C3") pour pouvoir la comparer à l'accord affiché à l'octave près.
        const noteWithOctave = `${note}${octave}`;
        // Note.midi ne renvoie null que pour une note invalide ; comme
        // noteWithOctave vient toujours de WHITE_NOTES + un octave calculé,
        // c'est forcément valide — le "?? -1" ne sert qu'à satisfaire
        // TypeScript (Note.midi renvoie `number | null`).
        const keyMidi = Note.midi(noteWithOctave) ?? -1;
        // highlightedMidiSet remplace displayedNotes ici pour que l'arpège
        // puisse n'allumer QU'UNE touche à la fois (voir son commentaire) —
        // en dehors de l'arpège, il contient exactement les mêmes notes que
        // displayedNotes, donc rien ne change pour l'affichage habituel.
        const highlighted = highlightedMidiSet.has(keyMidi);
        // Pas de couleur "basse" spéciale pendant l'arpège : chaque note
        // s'allume simplement tour à tour, la pastille de fonction suffit à
        // indiquer son rôle (R/3/5) sans ajouter une distinction de couleur
        // supplémentaire qui ne coïnciderait pas forcément avec la bonne note.
        const isBass = highlighted && keyMidi === bassMidi && !isArpeggioPlaying;
        // "&& highlighted" : sans l'arpège, une note de noteFunctions est
        // toujours highlighted aussi (les deux viennent de displayedNotes),
        // cette condition ne change donc rien à l'affichage habituel. Avec
        // l'arpège, elle évite d'afficher les pastilles R/3/5/7/9... de
        // TOUT l'accord alors qu'une seule touche est réellement allumée.
        const noteFunction = highlighted ? noteFunctions.get(keyMidi) : undefined;
        // Libellé altéré (ex: "♯11"), s'il y en a un pour CETTE note
        // précise (voir functionLabelOverrides dans PianoChordProps) —
        // sinon le libellé calculé normalement. Cherché par chroma (pas par
        // MIDI) : voir le commentaire de la prop pour le pourquoi.
        const functionLabel = noteFunction
          ? (functionLabelOverrides?.get(Note.chroma(note)) ?? noteFunction.label)
          : undefined;

        return (
          <View
            key={`white-${keyIndex}`}
            style={[
              styles.whiteKey,
              { width: whiteKeyWidth },
              highlighted && styles.whiteKeyHighlighted,
              isBass && styles.whiteKeyBass,
            ]}
          >
            {/* Nom de la touche : en position absolute, ancré en bas et
                étiré sur toute la largeur (left:0/right:0) pour pouvoir
                centrer le texte avec textAlign. */}
            <Text style={styles.whiteKeyName}>{note}</Text>

            {/* Pastille de fonction : seulement si la touche fait partie de
                l'accord reçu. Elle aussi en position absolute, ancrée en bas
                (juste au-dessus du nom de touche — voir le commentaire de
                FUNCTION_BADGE_BOTTOM plus haut pour le pourquoi), avec un
                "left" fixe qui la centre horizontalement sur la touche. */}
            {noteFunction && (
              <View
                style={[
                  styles.functionBadge,
                  { left: whiteKeyBadgeLeft },
                  { backgroundColor: FUNCTION_BADGE_BACKGROUND[noteFunction.category] },
                ]}
              >
                <Text
                  style={[
                    styles.functionBadgeLabel,
                    { color: FUNCTION_BADGE_TEXT[noteFunction.category] },
                  ]}
                >
                  {functionLabel}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      {/* Les touches noires sont posées PAR-DESSUS les touches blanches.
          On sort donc du flux normal (qui les empilerait côte à côte comme
          les blanches) avec position: 'absolute' : chaque touche noire est
          alors positionnée uniquement via sa distance "left" au conteneur
          .keyboard (qui doit rester en position relative, son comportement
          par défaut, pour servir de repère). "left" est calculé pour centrer
          la touche noire sur la frontière entre deux touches blanches. */}
      {allBlackKeys.map(({ note, octave, afterWhiteIndex }) => {
        // Même principe que pour les touches blanches : reconstituer la
        // note complète (ex: "C#" + 3 → "C#3") pour un matching à l'octave
        // près.
        const noteWithOctave = `${note}${octave}`;
        const keyMidi = Note.midi(noteWithOctave) ?? -1;
        // Même logique que pour les touches blanches (voir leurs
        // commentaires) : highlightedMidiSet et le verrouillage de la
        // couleur "basse"/des pastilles pendant l'arpège.
        const highlighted = highlightedMidiSet.has(keyMidi);
        const isBass = highlighted && keyMidi === bassMidi && !isArpeggioPlaying;
        const noteFunction = highlighted ? noteFunctions.get(keyMidi) : undefined;
        // Voir le commentaire équivalent côté touches blanches.
        const functionLabel = noteFunction
          ? (functionLabelOverrides?.get(Note.chroma(note)) ?? noteFunction.label)
          : undefined;
        const left =
          (afterWhiteIndex + 1) * whiteKeyWidth - blackKeyWidth / 2;

        return (
          <View
            key={`black-${afterWhiteIndex}`}
            style={[
              styles.blackKey,
              {
                left,
                width: blackKeyWidth,
                height: BLACK_KEY_HEIGHT,
              },
              highlighted && styles.blackKeyHighlighted,
              isBass && styles.blackKeyBass,
            ]}
          >
            {/* Même principe que sur les touches blanches (pastille ancrée
                en bas, au-dessus du nom), avec un texte clair (au lieu de
                sombre) puisque le fond est noir. La touche noire ne fait
                que BLACK_KEY_HEIGHT (72) de haut, donc la pastille (bottom:
                FUNCTION_BADGE_BOTTOM = 24, haute de 18) reste bien à
                l'intérieur : pas besoin d'un décalage différent ici. */}
            <Text style={styles.blackKeyName}>{note}</Text>

            {noteFunction && (
              <View
                style={[
                  styles.functionBadge,
                  { left: blackKeyBadgeLeft },
                  { backgroundColor: FUNCTION_BADGE_BACKGROUND[noteFunction.category] },
                ]}
              >
                <Text
                  style={[
                    styles.functionBadgeLabel,
                    { color: FUNCTION_BADGE_TEXT[noteFunction.category] },
                  ]}
                >
                  {functionLabel}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      {/* Séparateur "main gauche / main droite" : une simple ligne verticale
          posée par-dessus le clavier (position: 'absolute', comme les
          touches noires), seulement quand un grand écart a été détecté (voir
          handSplitLeft plus haut). pointerEvents="none" pour ne jamais
          intercepter les taps destinés aux touches en dessous. */}
      {handSplitLeft !== null && (
        <View
          pointerEvents="none"
          style={[styles.handSplitDivider, { left: handSplitLeft }]}
        />
      )}
    </View>
    </View>

      {/* Bouton "Écouter" : joue l'accord plaqué EXACTEMENT tel qu'affiché
          (voir handleListenPress). Toujours affiché, quel que soit l'appelant
          (écran résultat impro, carrousel de Crée ta progression, panneaux
          voicing/accompagnement) — un seul point d'intégration ici plutôt que
          de dupliquer ce bouton dans chaque écran. */}
      <Pressable style={styles.listenButton} onPress={handleListenPress}>
        <Text style={styles.listenButtonLabel}>🔊 Écouter</Text>
      </Pressable>

      {/* Navigation entre renversements, sous le clavier : bouton précédent,
          indicateur "X/N" (renversement courant / nombre total), bouton
          suivant. Masquée pour un accord étendu (9e/11e/13e) ou pour un
          voicing à arrangement fixe — voir inversionControlsVisible. */}
      {inversionControlsVisible && (
        <View style={styles.inversionRow}>
          <Pressable style={styles.inversionButton} onPress={goToPreviousInversion}>
            <Text style={styles.inversionButtonLabel}>{'<'}</Text>
          </Pressable>

          <Text style={styles.inversionIndicator}>
            {inversion + 1}/{totalInversions}
          </Text>

          <Pressable style={styles.inversionButton} onPress={goToNextInversion}>
            <Text style={styles.inversionButtonLabel}>{'>'}</Text>
          </Pressable>
        </View>
      )}

      {/* Bouton Arpège : lance/arrête l'accompagnement visuel (aucun son
          pour l'instant, voir le TODO dans le séquenceur plus haut).
          Toujours disponible, quel que soit le niveau d'enrichissement ou
          le renversement affiché — l'arpège porte sur LA TRIADE de
          l'accord (voir buildArpeggioSequence), pas sur ce qui est
          actuellement montré à l'écran. Son libellé reflète l'état courant,
          comme le bouton Voicing dans improResult.tsx : "Arpège 4 notes"
          pour le lancer, "Arrêter l'arpège" une fois lancé. Masqué si
          showArpeggioButton === false (voir son commentaire dans
          PianoChordProps) : le séquenceur/l'animation continuent de
          fonctionner normalement dans ce cas (piloté par autoPlayArpeggio),
          seul ce bouton manuel disparaît. */}
      {showArpeggioButton && (
        <Pressable
          style={[styles.arpeggioButton, isArpeggioPlaying && styles.arpeggioButtonSelected]}
          onPress={() => setIsArpeggioPlaying((current) => !current)}
        >
          <Text style={styles.arpeggioButtonLabel}>
            {isArpeggioPlaying ? "Arrêter l'arpège" : 'Arpège 4 notes'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// NB thème : il n'y a pas de token dédié "touche blanche" / "touche noire"
// dans theme.colors, donc on utilise du blanc/noir en dur pour les touches
// neutres, et theme.colors.primary + theme.colors.border pour tout ce qui
// vient vraiment du thème (mise en valeur et contours). Voir plus haut pour
// la réutilisation (signalée) de colors.exercice / colors.backGroundExercice
// pour les pastilles de fonction.
const styles = StyleSheet.create({
  // Englobe le clavier et la barre de navigation des renversements en
  // dessous, centrés horizontalement l'un par rapport à l'autre (alignItems
  // ici ne centre que CES enfants, pas .container lui-même). .container n'a
  // pas de largeur fixe : il est censé s'étirer sur toute la largeur que son
  // PARENT lui accorde, c'est justement CETTE largeur qu'onLayout mesure
  // (voir handleContainerLayout) pour calculer une taille de clavier qui ne
  // déborde jamais. Pour que la mesure soit juste, l'appelant (le parent
  // direct de <PianoChord>) doit laisser ce conteneur s'étirer normalement —
  // ne pas lui appliquer un alignItems: 'center' (qui le ferait se
  // recroqueviller sur son propre contenu au lieu de s'étirer, faussant la
  // mesure).
  container: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  // Liseré décoratif tout en haut du clavier, comme le feutre rouge d'un
  // vrai piano. Épaisseur fine : pas de token "épaisseur de trait" dans le
  // thème, on reprend donc theme.spacing.xs (4) — la valeur du thème la plus
  // proche de l'épaisseur demandée (3-4px) — plutôt qu'un nombre en dur.
  // Couleur : nouveau token theme.colors.pianoStrip (voir colors.ts), le
  // thème n'ayant plus de rouge existant à réutiliser (colors.exercice n'est
  // plus rouge). Pas d'arrondi ici : seul le BAS des touches blanches
  // s'arrondit (voir whiteKey plus bas), le liseré reste un simple rectangle
  // droit sur toute la largeur.
  pianoStrip: {
    height: theme.spacing.xs,
    backgroundColor: theme.colors.pianoStrip,
  },
  keyboard: {
    // Largeur volontairement absente ici : elle est responsive (calculée
    // dans le composant via useWindowDimensions) et passée en style inline,
    // à côté de ce style fixe.
    height: KEYBOARD_HEIGHT,
    flexDirection: 'row',
    // position par défaut ('relative'), nécessaire pour que les touches
    // noires en position: 'absolute' se positionnent par rapport à ce
    // conteneur et non par rapport à tout l'écran.
  },
  // Ligne verticale séparant main gauche (basse isolée) et main droite (le
  // reste de l'accord groupé) — voir handSplitLeft dans le composant. Pas de
  // token dédié "séparateur" dans le thème : on réutilise textMuted (gris
  // neutre), assez visible sur fond blanc ET noir sans rivaliser avec les
  // couleurs déjà utilisées pour la mise en valeur des touches/pastilles
  // (primary, exercice, backGroundExercice). zIndex au-dessus des touches
  // noires (2) pour rester visible même là où une touche noire passerait
  // juste sous la frontière.
  handSplitDivider: {
    position: 'absolute',
    top: 0,
    height: KEYBOARD_HEIGHT,
    width: 2,
    backgroundColor: theme.colors.textMuted,
    zIndex: 3,
  },
  whiteKey: {
    height: KEYBOARD_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    // Bas arrondi seulement (le haut reste droit : les touches partent du
    // liseré, voir pianoStrip plus haut). radius.sm (pas md) : reste subtil,
    // et une valeur plus grande rapprocherait la zone arrondie du nom de
    // touche (bottom: theme.spacing.xs, voir whiteKeyName) au point de
    // risquer de l'entamer visuellement — vérifié que radius.sm (4) laisse
    // largement la place à un nom de touche centré (1-2 caractères) sans y
    // toucher. Les touches noires (qui ne couvrent que le HAUT des blanches,
    // voir BLACK_KEY_HEIGHT) ne descendent jamais jusqu'à cette zone : rien
    // à ajuster de leur côté pour rester cohérent.
    borderBottomLeftRadius: theme.radius.sm,
    borderBottomRightRadius: theme.radius.sm,
    // zIndex : rend explicite (sans rien changer visuellement) que les
    // touches blanches doivent rester EN DESSOUS des touches noires. Avant,
    // cet ordre venait uniquement du fait que les touches noires sont
    // rendues après dans le JSX ; un zIndex plus bas ici + plus haut sur
    // blackKey (ci-dessous) fixe cet ordre explicitement, même si le JSX
    // changeait un jour.
    zIndex: 1,
  },
  whiteKeyHighlighted: {
    backgroundColor: theme.colors.primary,
  },
  // Couleur de la BASSE (la note la plus grave de l'accord), distincte de
  // primary pour qu'elle se repère d'un coup d'œil parmi les touches
  // allumées. Le thème n'a pas de couleur dédiée à la basse : on réutilise
  // colors.exercice (rouge), déjà réutilisé ailleurs dans ce fichier pour la
  // pastille "tierce" — un token dédié (ex: colors.bass) serait plus propre.
  // Ce rouge est choisi plutôt que colors.backGroundExercice (jaune) car il
  // garde un bon contraste avec le texte déjà en dur sur les touches (nom en
  // blanc sur les noires, en sombre sur les blanches).
  whiteKeyBass: {
    backgroundColor: theme.colors.exercice,
  },
  whiteKeyName: {
    position: 'absolute',
    bottom: theme.spacing.xs,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: KEY_NAME_FONT_SIZE,
    fontWeight: theme.text.weight.medium,
    color: theme.colors.text,
  },
  blackKey: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#000000',
    borderRadius: 2,
    // zIndex plus élevé que whiteKey : les touches noires doivent rester
    // visuellement AU-DESSUS des touches blanches. Important : zIndex ne
    // compare que des éléments qui partagent le même parent direct (ici,
    // .keyboard) — c'est pour ça que ça ne dit rien de l'ordre entre une
    // touche noire et la pastille d'UNE AUTRE touche blanche (sa "nièce"
    // dans l'arbre, pas sa sœur). Voir le commentaire sur functionBadge
    // ci-dessous pour ce cas précis.
    zIndex: 2,
  },
  blackKeyHighlighted: {
    backgroundColor: theme.colors.primary,
  },
  // Même couleur de basse que whiteKeyBass, pour rester cohérent visuellement
  // quelle que soit la touche (blanche ou noire) qui porte la basse.
  blackKeyBass: {
    backgroundColor: theme.colors.exercice,
  },
  blackKeyName: {
    position: 'absolute',
    bottom: theme.spacing.xs,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: KEY_NAME_FONT_SIZE,
    fontWeight: theme.text.weight.medium,
    color: '#FFFFFF',
  },
  functionBadge: {
    position: 'absolute',
    bottom: FUNCTION_BADGE_BOTTOM,
    width: FUNCTION_BADGE_SIZE,
    height: FUNCTION_BADGE_SIZE,
    borderRadius: FUNCTION_BADGE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    // zIndex : la pastille est un ENFANT de la touche (blanche ou noire),
    // donc ce zIndex ne la compare qu'à son unique frère/sœur dans le JSX,
    // le nom de touche (styles.whiteKeyName / blackKeyName, zIndex implicite
    // 0) — il garantit juste que la pastille reste lisible par-dessus le nom
    // si jamais ils se touchaient. Il ne fait PAS "passer la pastille
    // au-dessus des touches noires" : une touche noire est une "tante" de la
    // pastille (enfant du <View> .keyboard, pas de la touche blanche), et
    // zIndex ne compare jamais des éléments qui n'ont pas le même parent
    // direct. Le vrai correctif contre le recouvrement par les touches
    // noires est le repositionnement en bas (voir FUNCTION_BADGE_BOTTOM) :
    // la pastille sort complètement de la zone que les noires recouvrent.
    zIndex: 1,
  },
  functionBadgeLabel: {
    fontSize: FUNCTION_BADGE_FONT_SIZE,
    fontWeight: theme.text.weight.bold,
  },
  inversionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  inversionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  inversionButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  inversionIndicator: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.medium,
    color: theme.colors.textMuted,
  },
  // Même famille visuelle que inversionButton, mais son propre style : c'est
  // un interrupteur (actif/inactif), pas un bouton de navigation au même
  // titre que < / >.
  arpeggioButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  // Fond plein en couleur d'accent (primary) pendant la lecture : même
  // convention que les autres états "actif" de l'app (ex: degreeChipSelected
  // dans improResult.tsx).
  arpeggioButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  arpeggioButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Même famille visuelle que inversionButton/arpeggioButton (pill grise,
  // contour primary) : ce bouton rejoint la même rangée de contrôles, pas de
  // raison de le traiter différemment.
  listenButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  listenButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
});

export default PianoChord;

// Exemple d'utilisation (Sol majeur à l'état fondamental — G3 sera affiché
// comme la basse, en rouge) :
//
// <PianoChord notes={["G3", "B3", "D4"]} />
