import { Note } from 'tonal';

// Une note d'un accord, désignée par sa FONCTION plutôt que par un nom de
// note en dur : c'est ce qui rend un accompagnement TRANSPOSABLE à
// n'importe quel accord (voir resolveStepNotes plus bas, qui convertit une
// fonction en note réelle pour UN accord précis — ici toujours Do majeur en
// exemple, mais la table ne le sait pas). "root_octave"/"third_octave" sont
// respectivement la fondamentale et la tierce une octave plus haut : pas des
// fonctions d'accord à proprement parler, mais des raccourcis pratiques pour
// ces 2 cas courants (arpège montant classique, arpège ouvert) plutôt que de
// forcer chaque appelant à recalculer lui-même "note + 1 octave".
export type ChordFunction = 'root' | 'third' | 'fifth' | 'root_octave' | 'third_octave';

// Un pas de la séquence : les fonctions à allumer SIMULTANÉMENT (une seule
// pour une note isolée façon arpège, plusieurs pour un accord plaqué façon
// "Valse"), et sa durée d'affichage en ms avant de passer au pas suivant.
export type AccompanimentStep = {
  functions: ChordFunction[];
  durationMs: number;
};

// Un accompagnement complet : nom, explication COURTE et GÉNÉRALE (jamais
// une note ou un accord précis en dur — le principe doit s'appliquer à
// n'importe quel accord, l'exemple sur Do majeur n'étant qu'une
// illustration), et sa séquence de pas.
export type Accompaniment = {
  id: string;
  name: string;
  explanation: string;
  steps: AccompanimentStep[];
};

// Durée par défaut d'un pas (ms) pour les accompagnements ci-dessous : assez
// longue pour rester perceptible note par note (même ordre de grandeur que
// ARPEGGIO_NOTE_ON_MS dans PianoChord.tsx), sans "blanc" entre les pas
// (contrairement à l'arpège de PianoChord, qui insère un court silence) — un
// remontage complet du clavier à chaque pas (voir AccompanimentModal dans
// improResult.tsx) suffit à les distinguer visuellement.
const DEFAULT_STEP_DURATION_MS = 450;

// Table des accompagnements disponibles dans la modale "Découvrir un
// accompagnement" (voir AccompanimentModal dans improResult.tsx). AJOUTER UN
// ACCOMPAGNEMENT = ajouter une entrée ici : la modale se contente de .map()
// ce tableau pour ses onglets et pour lire la séquence sélectionnée, aucun
// autre changement de code n'est nécessaire.
export const ACCOMPANIMENTS: Accompaniment[] = [
  {
    id: 'ascending-arpeggio',
    name: 'Arpège montant',
    explanation:
      "L'arpège consiste à jouer les notes de l'accord une par une, de la plus grave à la plus aiguë, plutôt que toutes ensemble. Applique ce principe à n'importe quel accord : joue sa fondamentale, puis sa tierce, sa quinte, et reviens à la fondamentale une octave plus haut. Idéal pour un accompagnement doux et fluide.",
    steps: [
      { functions: ['root'], durationMs: DEFAULT_STEP_DURATION_MS },
      { functions: ['third'], durationMs: DEFAULT_STEP_DURATION_MS },
      { functions: ['fifth'], durationMs: DEFAULT_STEP_DURATION_MS },
      { functions: ['root_octave'], durationMs: DEFAULT_STEP_DURATION_MS },
    ],
  },
  {
    id: 'waltz',
    name: 'Valse',
    explanation:
      'La valse répartit l\'accord sur un rythme à 3 temps : la fondamentale seule et grave sur le 1er temps (le "boum"), puis l\'accord complet plaqué sur les 2 temps suivants (les "tchac-tchac"). Applique ce principe à n\'importe quel accord pour un accompagnement dansant, à 3 temps.',
    steps: [
      { functions: ['root'], durationMs: DEFAULT_STEP_DURATION_MS },
      { functions: ['root', 'third', 'fifth'], durationMs: DEFAULT_STEP_DURATION_MS },
      { functions: ['root', 'third', 'fifth'], durationMs: DEFAULT_STEP_DURATION_MS },
    ],
  },
  {
    id: 'open-arpeggio',
    name: 'Arpège ouvert',
    explanation:
      "Une variante de l'arpège qui élargit l'ambitus : fondamentale, quinte, fondamentale à l'octave, puis tierce à l'octave supérieure. Applique ce principe à n'importe quel accord pour un accompagnement plus large et moins prévisible qu'un simple arpège montant.",
    steps: [
      { functions: ['root'], durationMs: DEFAULT_STEP_DURATION_MS },
      { functions: ['fifth'], durationMs: DEFAULT_STEP_DURATION_MS },
      { functions: ['root_octave'], durationMs: DEFAULT_STEP_DURATION_MS },
      { functions: ['third_octave'], durationMs: DEFAULT_STEP_DURATION_MS },
    ],
  },
];

// Les 3 notes (avec octave) de LA triade sur laquelle résoudre des fonctions
// (ex: { root: "C3", third: "E3", fifth: "G3" } pour Do majeur) : fournie par
// l'appelant, jamais en dur ici, pour que la résolution reste transposable.
export type TriadNotes = {
  root: string;
  third: string;
  fifth: string;
};

// Résout UNE fonction en note concrète pour la triade donnée. Note.transpose
// avec l'intervalle "8P" (octave juste) monte "root"/"third" d'une octave
// pour root_octave/third_octave, sans se soucier de leur orthographe
// (dièse/bémol conservée) — plus fiable qu'un calcul MIDI manuel.
function resolveFunction(chordFunction: ChordFunction, triad: TriadNotes): string {
  switch (chordFunction) {
    case 'root':
      return triad.root;
    case 'third':
      return triad.third;
    case 'fifth':
      return triad.fifth;
    case 'root_octave':
      return Note.transpose(triad.root, '8P');
    case 'third_octave':
      return Note.transpose(triad.third, '8P');
  }
}

// Résout TOUTES les fonctions d'UN pas en notes concrètes, pour la triade
// donnée — le tableau obtenu (1 à 3 notes) est directement ce qu'il faut
// passer en prop "notes" à PianoChord pour afficher ce pas.
export function resolveStepNotes(step: AccompanimentStep, triad: TriadNotes): string[] {
  return step.functions.map((chordFunction) => resolveFunction(chordFunction, triad));
}
