import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Interval, Note } from 'tonal';

import { theme } from '../theme';
import { fitNotesToRange, invertChord } from '../dataset/chordUtils';

// Props du composant : l'accord à afficher. On type ça avec une interface
// plutôt qu'un "any" pour que TypeScript nous protège si on passe autre
// chose qu'un tableau de chaînes.
//
// CHANGEMENT à cette étape : chaque note doit maintenant préciser son OCTAVE
// (notation Tonal, ex: "G3", "B3", "D4") au lieu d'un simple nom de note
// ("G", "B", "D"). Choix fait ici, le plus simple des deux proposés : garder
// "notes: string[]" tel quel plutôt qu'ajouter une prop séparée "octave de
// départ". Le clavier affiche 2 octaves précises (la 1ère commence à
// BASE_OCTAVE = 3, la 2e à 4, voir plus bas) ; sans octave dans la prop, le
// composant ne peut pas savoir SUR LAQUELLE des deux allumer une note donnée
// — c'est justement le bug de cette étape. C'est donc à l'appelant (ex:
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
}

// Nombre d'octaves affichées. Tout le reste ci-dessous (largeur du clavier,
// liste des touches blanches et noires) est calculé à partir de cette seule
// constante : pour changer le nombre d'octaves, il suffit de la modifier.
const OCTAVES = 2;

// Octave de la 1ère touche "C" affichée (donc de toute la 1ère octave) ;
// chaque octave suivante ajoute 1 (la 2e octave commence à BASE_OCTAVE + 1,
// donc 4). C'est ce qui permet de savoir exactement à quelle note-avec-octave
// (ex: "C3", "C#3", "D3"...) correspond chaque touche dessinée.
const BASE_OCTAVE = 3;

// Bornes MIDI du clavier affiché (C3 à B4 avec BASE_OCTAVE = 3 et OCTAVES =
// 2) : la 1ère touche (C de la 1ère octave) et la dernière (B de la dernière
// octave). Utilisées par fitNotesToRange pour savoir jusqu'où un accord peut
// monter avant de déborder par le haut (voir son appel plus bas). Calculées
// à partir de BASE_OCTAVE/OCTAVES plutôt qu'écrites en dur, pour rester
// justes si ces constantes changent. Note.midi ne renvoie null que pour une
// note invalide ; ces deux notes sont toujours valides, le "?? " ne sert
// qu'à satisfaire TypeScript (Note.midi renvoie `number | null`).
const KEYBOARD_LOW_MIDI = Note.midi(`C${BASE_OCTAVE}`) ?? 0;
const KEYBOARD_HIGH_MIDI = Note.midi(`B${BASE_OCTAVE + OCTAVES - 1}`) ?? 127;

// Hauteur du clavier : fixe, elle ne dépend ni du nombre d'octaves ni de la
// largeur de l'écran.
const KEYBOARD_HEIGHT = 120;

// Largeur d'UNE octave (7 touches blanches) quand l'écran est assez large :
// c'est la largeur "confortable" par défaut. La largeur RÉELLE, elle, est
// calculée dans le composant à partir de useWindowDimensions (voir plus
// bas) : ces deux constantes ne servent qu'à la BORNER, pour que le clavier
// reste jouable sur un petit écran (MIN) sans devenir démesuré sur un grand
// écran/tablette (MAX).
const MIN_OCTAVE_WIDTH = 130;
const MAX_OCTAVE_WIDTH = 280;

// Marge horizontale à réserver autour du clavier avant de calculer sa
// largeur (paddings des conteneurs qui l'entourent dans creation.tsx).
// useWindowDimensions ne connaît que la taille de l'écran, pas celle du
// conteneur parent exact : c'est une estimation simple plutôt qu'une mesure
// précise (qui demanderait onLayout, hors sujet ici).
const RESPONSIVE_HORIZONTAL_MARGIN = theme.spacing.lg * 2;

// Les 7 touches blanches d'UNE octave, dans l'ordre visuel de gauche à droite.
const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Répète WHITE_NOTES OCTAVES fois pour obtenir la liste complète des touches
// blanches à afficher (ex : pour OCTAVES = 2, C D E F G A B C D E F G A B).
// Comme les touches blanches sont simplement empilées dans l'ordre du
// tableau par flexDirection: 'row', pas besoin de recalculer leur position :
// "keyIndex" (0 à 13 pour 2 octaves) ne sert qu'à fabriquer une clé React
// unique, puisque le même nom de note ("C", "D"...) revient à chaque octave.
// "octave" (BASE_OCTAVE pour la 1ère répétition, BASE_OCTAVE + 1 pour la 2e,
// ...) est ce qui permet de reconstituer la note complète de la touche
// (ex: "C" + 3 → "C3") pour le matching avec l'accord reçu.
const ALL_WHITE_KEYS: { note: string; octave: number; keyIndex: number }[] = Array.from(
  { length: OCTAVES },
  (_, octaveIndex) =>
    WHITE_NOTES.map((note, indexInOctave) => ({
      note,
      octave: BASE_OCTAVE + octaveIndex,
      keyIndex: octaveIndex * WHITE_NOTES.length + indexInOctave,
    })),
).flat();

// Les touches noires ne sont pas régulièrement espacées : il n'y en a pas
// entre E-F ni entre B-C. BLACK_KEY_PATTERN décrit ce motif pour UNE octave
// (afterWhiteIndex de 0 à 6, l'indice de la touche blanche juste avant).
// ALL_BLACK_KEYS répète ce motif OCTAVES fois en décalant afterWhiteIndex de
// WHITE_NOTES.length (7) à chaque octave, pour obtenir des indices absolus
// (0 à 13 pour 2 octaves) cohérents avec ALL_WHITE_KEYS.
const BLACK_KEY_PATTERN: { note: string; afterWhiteIndex: number }[] = [
  { note: 'C#', afterWhiteIndex: 0 },
  { note: 'D#', afterWhiteIndex: 1 },
  { note: 'F#', afterWhiteIndex: 3 },
  { note: 'G#', afterWhiteIndex: 4 },
  { note: 'A#', afterWhiteIndex: 5 },
];

const ALL_BLACK_KEYS: { note: string; octave: number; afterWhiteIndex: number }[] = Array.from(
  { length: OCTAVES },
  (_, octaveIndex) =>
    BLACK_KEY_PATTERN.map(({ note, afterWhiteIndex }) => ({
      note,
      octave: BASE_OCTAVE + octaveIndex,
      afterWhiteIndex: octaveIndex * WHITE_NOTES.length + afterWhiteIndex,
    })),
).flat();

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

// Pour savoir si une touche précise (note + octave, ex: "G3") fait partie de
// l'accord reçu, on compare leur position MIDI absolue avec Note.midi.
// Note.midi encode à la fois la hauteur (do, do#, ré...) ET l'octave dans un
// seul nombre entier (ex: Note.midi('C4') === 60, Note.midi('C3') === 48) :
// deux notes ne matchent que si elles tombent EXACTEMENT sur la même touche,
// à la même octave.
//
// C'est le cœur du correctif de cette étape : avant, on comparait avec
// Note.chroma, qui ignore l'octave — une note de l'accord (ex: "G") allumait
// donc ses 2 occurrences sur les 2 octaves du clavier. Note.midi corrige ça
// en exigeant la bonne octave, tout en gardant le matching "enharmonique"
// (Note.midi('Db4') === Note.midi('C#4'), comme avant avec le chroma).
function isNoteInChord(keyNoteWithOctave: string, chordNotes: string[]): boolean {
  const keyMidi = Note.midi(keyNoteWithOctave);
  return chordNotes.some((chordNote) => Note.midi(chordNote) === keyMidi);
}

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

export function PianoChord({ notes }: PianoChordProps) {
  // useWindowDimensions renvoie la largeur (et hauteur) actuelle de la
  // fenêtre/écran, ET redéclenche un rendu du composant à chaque changement
  // (rotation de l'appareil, redimensionnement de la fenêtre côté web) : ça
  // suffit à rendre le clavier responsive, sans rien mesurer soi-même.
  //
  // On en déduit la largeur d'UNE octave, bornée entre MIN_OCTAVE_WIDTH et
  // MAX_OCTAVE_WIDTH (voir leur commentaire) pour rester jouable sur petit
  // écran sans devenir démesuré sur grand écran. Tout ce qui dépend de cette
  // largeur (largeur du clavier, des touches blanches/noires, position des
  // pastilles) est donc calculé ICI, à chaque rendu, plutôt qu'en constante
  // fixe en haut du fichier comme avant. FUNCTION_BADGE_SIZE, KEY_NAME_FONT_SIZE
  // et KEYBOARD_HEIGHT, eux, restent des constantes fixes : seule la largeur
  // devient responsive, pas la taille du texte/des pastilles ni la hauteur.
  const { width: windowWidth } = useWindowDimensions();
  const availableWidth = windowWidth - RESPONSIVE_HORIZONTAL_MARGIN;
  const octaveWidth = Math.min(
    MAX_OCTAVE_WIDTH,
    Math.max(MIN_OCTAVE_WIDTH, availableWidth / OCTAVES),
  );
  const keyboardWidth = octaveWidth * OCTAVES;
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
  // creation.tsx ne change pas et ne sait même pas qu'un renversement est
  // affiché. C'est ce composant qui, à partir de ce même "notes", recalcule
  // à chaque rendu les notes du renversement courant (voir invertedNotes).
  const [inversion, setInversion] = useState(0);

  // Nombre de renversements possibles = nombre de notes de l'accord reçu
  // (3 pour une triade : fondamental, 1er, 2e renversement).
  const totalInversions = notes.length;

  // Notes du renversement demandé, avant vérification qu'il tient sur le
  // clavier affiché.
  const invertedNotes = invertChord(notes, inversion);

  // Un renversement fait remonter la (les) note(s) grave(s) par-dessus les
  // autres : ça peut pousser la note la plus aiguë au-dessus de la dernière
  // touche du clavier (ex: 2e renversement de La mineur → ["E4","A4","C5"],
  // C5 dépasse B4). fitNotesToRange fait alors redescendre TOUT l'accord
  // d'une octave pour qu'il tienne entre KEYBOARD_LOW_MIDI et
  // KEYBOARD_HIGH_MIDI, sans changer les notes ni le renversement — displayedNotes
  // est donc ce qu'il faut afficher (et sur quoi calculer fonctions/basse),
  // invertedNotes n'étant qu'une étape intermédiaire.
  const displayedNotes = fitNotesToRange(invertedNotes, KEYBOARD_LOW_MIDI, KEYBOARD_HIGH_MIDI);

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

  return (
    <View style={styles.container}>
    <View style={[styles.keyboard, { width: keyboardWidth }]}>
      {ALL_WHITE_KEYS.map(({ note, octave, keyIndex }) => {
        // On reconstitue la note complète de CETTE touche (ex: "C" + 3 →
        // "C3") pour pouvoir la comparer à l'accord affiché à l'octave près.
        const noteWithOctave = `${note}${octave}`;
        // Note.midi ne renvoie null que pour une note invalide ; comme
        // noteWithOctave vient toujours de WHITE_NOTES + un octave calculé,
        // c'est forcément valide — le "?? -1" ne sert qu'à satisfaire
        // TypeScript (Note.midi renvoie `number | null`).
        const keyMidi = Note.midi(noteWithOctave) ?? -1;
        const highlighted = isNoteInChord(noteWithOctave, displayedNotes);
        const isBass = highlighted && keyMidi === bassMidi;
        const noteFunction = noteFunctions.get(keyMidi);

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
                  {noteFunction.label}
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
      {ALL_BLACK_KEYS.map(({ note, octave, afterWhiteIndex }) => {
        // Même principe que pour les touches blanches : reconstituer la
        // note complète (ex: "C#" + 3 → "C#3") pour un matching à l'octave
        // près.
        const noteWithOctave = `${note}${octave}`;
        const keyMidi = Note.midi(noteWithOctave) ?? -1;
        const highlighted = isNoteInChord(noteWithOctave, displayedNotes);
        const isBass = highlighted && keyMidi === bassMidi;
        const noteFunction = noteFunctions.get(keyMidi);
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
                  {noteFunction.label}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>

      {/* Navigation entre renversements, sous le clavier : bouton précédent,
          indicateur "X/N" (renversement courant / nombre total), bouton
          suivant. */}
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
  // dessous, centrés horizontalement l'un par rapport à l'autre.
  container: {
    alignItems: 'center',
    gap: theme.spacing.sm,
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
  whiteKey: {
    height: KEYBOARD_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
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
});

export default PianoChord;

// Exemple d'utilisation (Sol majeur à l'état fondamental — G3 sera affiché
// comme la basse, en rouge) :
//
// <PianoChord notes={["G3", "B3", "D4"]} />
