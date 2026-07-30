import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Interval, Note } from 'tonal';

import { theme } from '../theme';

// Composant CLIQUABLE (contrairement à PianoChord, qui ne fait qu'afficher un
// accord) : chaque touche est un Pressable, qui allume brièvement la touche
// pressée et mémorise les 2 dernières notes jouées pour en afficher
// l'intervalle. Pas de pastille de fonction ni de logique d'accord ici — on
// reprend juste de PianoChord le DESSIN du clavier (touches blanches en
// rangée, noires en position absolue, pas de noire entre E-F/B-C).
interface InteractivePianoProps {
  // Nombre d'octaves affichées. 1 par défaut : suffisant pour les exercices
  // d'intervalle de la leçon 1.1 (jusqu'à une septième majeure d'écart, ex.
  // C4 à B4), et plus simple à afficher lisiblement sur un petit écran.
  octaves?: number;
}

const DEFAULT_OCTAVES = 2;

// Octave de départ : C4 (le "do central"), un repère standard plutôt qu'un
// choix arbitraire.
const BASE_OCTAVE = 4;

// Durée d'allumage d'une touche après un appui (voir handlePressKey plus
// bas). 250ms : assez long pour être bien visible, assez court pour ne pas
// gêner un enchaînement rapide de 2 touches.
const ACTIVE_KEY_DURATION_MS = 250;

const KEYBOARD_HEIGHT = 120;
// Largeur fixe par touche blanche (pas de redimensionnement responsive ici,
// contrairement à PianoChord — plus simple, et suffisant pour 1-2 octaves).
// 44 : taille de cible tactile minimale recommandée (Apple HIG / Material).
const WHITE_KEY_WIDTH = 44;
const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.6;
const BLACK_KEY_HEIGHT = KEYBOARD_HEIGHT * 0.6;
const KEY_NAME_FONT_SIZE = 11;

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Motif des touches noires pour UNE octave : pas de touche entre E-F ni
// entre B-C (afterWhiteIndex = l'indice, dans WHITE_NOTES, de la touche
// blanche juste avant).
const BLACK_KEY_PATTERN: { note: string; afterWhiteIndex: number }[] = [
  { note: 'C#', afterWhiteIndex: 0 },
  { note: 'D#', afterWhiteIndex: 1 },
  { note: 'F#', afterWhiteIndex: 3 },
  { note: 'G#', afterWhiteIndex: 4 },
  { note: 'A#', afterWhiteIndex: 5 },
];

// Noms d'intervalles simples (1 = unisson à 8 = octave), en français,
// indexés par degré puis par qualité Tonal (P = juste, M = majeur, m =
// mineur, A = augmenté, d = diminué). Utilisé par formatIntervalFrench
// ci-dessous. En minuscules pour s'insérer directement dans une phrase
// ("Tu as joué : une quinte juste").
const INTERVAL_NAMES: Record<number, Partial<Record<string, string>>> = {
  1: { P: 'unisson' },
  2: { m: 'seconde mineure', M: 'seconde majeure' },
  3: { m: 'tierce mineure', M: 'tierce majeure' },
  4: { P: 'quarte juste', A: 'quarte augmentée', d: 'quarte diminuée' },
  5: { P: 'quinte juste', A: 'quinte augmentée', d: 'quinte diminuée' },
  6: { m: 'sixte mineure', M: 'sixte majeure' },
  7: { m: 'septième mineure', M: 'septième majeure' },
  8: { P: 'octave juste' },
};

// Ramène un degré d'intervalle "composé" (au-delà de l'octave, ex: 10 pour
// une dixième) à son équivalent simple ENTRE 1 (unisson) ET 8 (octave)
// inclus. Contrairement à un calcul de "fonction d'accord" (voir
// PianoChord.toSimpleDegree, qui ramène tout dans 1..7 et confond volontairement
// unisson et octave), on garde ici 8 à part : l'octave est un intervalle à
// part entière qu'on veut pouvoir nommer ("octave juste"), pas juste "la
// même note".
function reduceToSimpleDegree(num: number): number {
  let simple = num;
  while (simple > 8) {
    simple -= 7;
  }
  return simple;
}

// Tonal encode la qualité d'un intervalle avec parfois plus d'un caractère
// (ex: "AA" = doublement augmenté) : on ne regarde que le 1er caractère,
// largement suffisant pour les qualités qu'on nomme (P/M/m/A/d). Le "??"
// (qualité ou degré non couverts par INTERVAL_NAMES, ex: une seconde
// augmentée) retombe sur un libellé générique plutôt que planter.
function formatIntervalFrench(num: number, quality: string): string {
  const qualityKey = quality[0] ?? 'P';
  return INTERVAL_NAMES[num]?.[qualityKey] ?? `intervalle ${num}${quality}`;
}

// "Unisson" est masculin ("un unisson"), tous les autres intervalles
// (seconde, tierce, quarte, quinte, sixte, septième, octave) sont féminins
// ("une quinte", "une octave") : seule règle d'accord nécessaire ici.
function articleFor(intervalName: string): string {
  return intervalName === 'unisson' ? 'un' : 'une';
}

// Calcule le nom (français) de l'intervalle entre 2 notes-avec-octave (ex:
// "C4", "G4"), dans n'importe quel ordre de jeu.
//
// On trie d'abord les 2 notes du grave vers l'aigu avant d'appeler
// Interval.distance(from, to) : cette fonction Tonal calcule l'intervalle
// ASCENDANT de "from" vers "to". Sans ce tri, jouer les 2 mêmes touches dans
// l'ordre inverse (aigu puis grave) donnerait l'intervalle "renversé" (ex:
// une quarte au lieu d'une quinte) alors que musicalement, l'écart entre 2
// notes ne dépend pas de l'ordre dans lequel on les a jouées.
//
// Interval.get(...) décompose ensuite le résultat (ex: "5P") en { num, q } :
// num est le degré (1, 2, 3...), q sa qualité ('P', 'M', 'm', 'A', 'd').
// reduceToSimpleDegree ramène un degré composé (au-delà de l'octave, si les 2
// notes sont sur 2 octaves différentes) à son équivalent simple.
function describeInterval(noteA: string, noteB: string): string | null {
  const midiA = Note.midi(noteA);
  const midiB = Note.midi(noteB);
  if (midiA === null || midiB === null) return null;

  const [lowNote, highNote] = midiA <= midiB ? [noteA, noteB] : [noteB, noteA];

  const interval = Interval.get(Interval.distance(lowNote, highNote));
  if (interval.empty) return null;

  const simpleNum = reduceToSimpleDegree(interval.num);
  return formatIntervalFrench(simpleNum, interval.q);
}

export function InteractivePiano({ octaves = DEFAULT_OCTAVES }: InteractivePianoProps) {
  const whiteKeys = Array.from({ length: octaves }, (_, octaveIndex) =>
    WHITE_NOTES.map((note, indexInOctave) => ({
      note,
      octave: BASE_OCTAVE + octaveIndex,
      keyIndex: octaveIndex * WHITE_NOTES.length + indexInOctave,
    })),
  ).flat();

  const blackKeys = Array.from({ length: octaves }, (_, octaveIndex) =>
    BLACK_KEY_PATTERN.map(({ note, afterWhiteIndex }) => ({
      note,
      octave: BASE_OCTAVE + octaveIndex,
      afterWhiteIndex: octaveIndex * WHITE_NOTES.length + afterWhiteIndex,
    })),
  ).flat();

  // Touche actuellement "allumée" (note+octave, ex: "C4"), ou null si
  // aucune. C'est un state (et pas juste une variable) car il doit
  // déclencher un re-render pour changer la couleur de la touche ; le
  // setTimeout ci-dessous l'éteint (remet à null) après ACTIVE_KEY_DURATION_MS.
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Identifiant du minuteur en cours, pour pouvoir l'annuler (voir
  // handlePressKey) si une nouvelle touche est pressée avant que la
  // précédente se soit éteinte toute seule. Un ref (pas un state) car cette
  // valeur ne doit jamais déclencher de re-render à elle seule.
  const activeKeyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Annule le minuteur en attente si le composant est démonté pendant que
  // l'animation d'allumage est en cours (évite un setState sur un composant
  // déjà retiré).
  useEffect(() => {
    return () => {
      if (activeKeyTimeoutRef.current) {
        clearTimeout(activeKeyTimeoutRef.current);
      }
    };
  }, []);

  // Les 2 dernières notes jouées (la plus récente en dernier), pour calculer
  // l'intervalle entre elles. Fenêtre glissante de taille 2 : à chaque
  // nouvel appui, on ajoute la note et on ne garde que les 2 dernières
  // (slice(-2)) — donc dès la 3e touche jouée, c'est l'intervalle entre la
  // 2e et la 3e qui s'affiche, plus celui entre la 1re et la 2e.
  const [lastTwoNotes, setLastTwoNotes] = useState<string[]>([]);

  const handlePressKey = (noteWithOctave: string) => {
    // Feedback visuel : on annule d'abord un éventuel minuteur d'extinction
    // encore en attente (appui précédent pas encore éteint) — sinon il
    // pourrait éteindre CETTE nouvelle touche prématurément, à la place de
    // l'ancienne. Puis on allume la touche et on programme sa propre
    // extinction.
    if (activeKeyTimeoutRef.current) {
      clearTimeout(activeKeyTimeoutRef.current);
    }
    setActiveKey(noteWithOctave);
    activeKeyTimeoutRef.current = setTimeout(() => {
      setActiveKey(null);
      activeKeyTimeoutRef.current = null;
    }, ACTIVE_KEY_DURATION_MS);

    setLastTwoNotes((previous) => [...previous, noteWithOctave].slice(-2));
  };

  const intervalName =
    lastTwoNotes.length === 2 ? describeInterval(lastTwoNotes[0], lastTwoNotes[1]) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.keyboard, { width: WHITE_KEY_WIDTH * WHITE_NOTES.length * octaves }]}>
        {whiteKeys.map(({ note, octave, keyIndex }) => {
          const noteWithOctave = `${note}${octave}`;
          return (
            <Pressable
              key={`white-${keyIndex}`}
              style={[
                styles.whiteKey,
                { width: WHITE_KEY_WIDTH },
                activeKey === noteWithOctave && styles.keyActive,
              ]}
              onPress={() => handlePressKey(noteWithOctave)}
            >
              <Text style={styles.whiteKeyName}>{note}</Text>
            </Pressable>
          );
        })}

        {/* Touches noires posées PAR-DESSUS les blanches, en position
            absolute (comme dans PianoChord) : "left" centre chaque touche
            noire sur la frontière entre 2 touches blanches. */}
        {blackKeys.map(({ note, octave, afterWhiteIndex }) => {
          const noteWithOctave = `${note}${octave}`;
          const left = (afterWhiteIndex + 1) * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;

          return (
            <Pressable
              key={`black-${afterWhiteIndex}`}
              style={[
                styles.blackKey,
                { left, width: BLACK_KEY_WIDTH, height: BLACK_KEY_HEIGHT },
                activeKey === noteWithOctave && styles.keyActive,
              ]}
              onPress={() => handlePressKey(noteWithOctave)}
            >
              <Text style={styles.blackKeyName}>{note}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.intervalText}>
        {intervalName
          ? `Tu as joué : ${articleFor(intervalName)} ${intervalName}.`
          : 'Joue 2 notes pour voir leur intervalle.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  keyboard: {
    height: KEYBOARD_HEIGHT,
    flexDirection: 'row',
    // position par défaut ('relative'), nécessaire pour que les touches
    // noires (position: 'absolute') se positionnent par rapport à ce
    // conteneur et non par rapport à tout l'écran.
  },
  whiteKey: {
    height: KEYBOARD_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: theme.spacing.xs,
    zIndex: 1,
  },
  blackKey: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#000000',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: theme.spacing.xs,
    zIndex: 2,
  },
  // Couleur d'allumage commune aux touches blanches et noires (le feedback
  // d'appui demandé) : theme.colors.primary, comme indiqué dans la consigne.
  keyActive: {
    backgroundColor: theme.colors.primary,
  },
  whiteKeyName: {
    fontSize: KEY_NAME_FONT_SIZE,
    fontWeight: theme.text.weight.medium,
    color: theme.colors.text,
  },
  blackKeyName: {
    fontSize: KEY_NAME_FONT_SIZE,
    fontWeight: theme.text.weight.medium,
    color: '#FFFFFF',
  },
  // Pas de token "texte de résultat" dédié dans le thème : composé à partir
  // de text.size.md + colors.text, cohérent avec le texte de contenu du
  // reste de la leçon (voir LessonCourseScreen).
  intervalText: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.medium,
    color: theme.colors.text,
    textAlign: 'center',
  },
});

export default InteractivePiano;
