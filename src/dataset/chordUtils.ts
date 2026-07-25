import { Chord, Note } from 'tonal';

// Construit les notes d'un accord (état fondamental) avec une octave
// correcte pour chacune, pour un affichage clavier (PianoChord) qui monte
// toujours de gauche à droite.
//
// Chord.get(chordName).notes renvoie les notes de l'accord SANS octave, dans
// l'ordre de l'accord (ex: "G" → ["G", "B", "D"]), mais rien ne garantit
// qu'en les collant toutes à la même octave elles montent réellement : "D"
// est plus bas que "G" dans l'octave (do, ré, mi... ré vient avant sol), donc
// "G3", "B3", "D3" redescendrait au lieu de monter.
//
// Logique de montée d'octave : on part de la fondamentale à baseOctave, puis
// pour chaque note suivante on compare son chroma (position 0-11 dans
// l'octave, via Note.chroma) à celui de la note precédente.
// - Si le chroma de la note actuelle est PLUS GRAND que celui de la
//   précédente, elle est naturellement plus haute : on la garde à la même
//   octave.
// - Sinon (chroma égal ou plus petit), c'est qu'elle "boucle" en dessous de
//   la précédente sur le cercle des notes (comme "D" après "B") : on passe à
//   l'octave suivante pour qu'elle sonne bien au-dessus, et on continue à
//   partir de cette nouvelle octave pour les notes restantes.
export function chordNotesWithOctaves(chordName: string, baseOctave: number): string[] {
  const chordNoteNames = Chord.get(chordName).notes;

  let currentOctave = baseOctave;
  let previousChroma: number | null = null;

  return chordNoteNames.map((noteName) => {
    const chroma = Note.chroma(noteName);

    if (previousChroma !== null && chroma <= previousChroma) {
      currentOctave += 1;
    }
    previousChroma = chroma;

    return `${noteName}${currentOctave}`;
  });
}

// Renvoie les notes d'un accord réarrangées pour un renversement donné.
//
// Un renversement, c'est : faire "remonter" la (ou les) note(s) la plus
// grave par-dessus les autres, une octave plus haut, sans changer les notes
// qui composent l'accord — juste leur ordre et leur octave. Exemple pour Sol
// majeur ["G3","B3","D4"] :
// - inversion 0 (fondamental)      → ["G3","B3","D4"] (Sol à la basse)
// - inversion 1 (1er renversement) → ["B3","D4","G4"] (Si à la basse, Sol remonté d'une octave)
// - inversion 2 (2e renversement)  → ["D4","G4","B4"] (Ré à la basse)
//
// On suppose que "fundamentalNotes" est déjà trié du grave à l'aigu (c'est ce
// que renvoie chordNotesWithOctaves) : la note la plus grave est donc
// toujours en tête de tableau. Pour obtenir le renversement demandé, on
// répète "inversion" fois la même opération élémentaire : prendre la note en
// tête de tableau, la monter d'une octave (Note.get sépare le nom de la note
// — "pc", ex: "G" — de son numéro d'octave — "oct", ex: 3 — ce qui permet de
// reconstruire juste "G4"), puis la replacer en fin de tableau. Répéter cette
// opération "inversion" fois est exactement la définition d'un renversement
// à ce degré : le nombre de renversements possibles est donc égal au nombre
// de notes de l'accord (3 pour une triade ; répéter l'opération 3 fois sur
// une triade redonne le même ordre, juste une octave plus haut).
export function invertChord(fundamentalNotes: string[], inversion: number): string[] {
  let notes = [...fundamentalNotes];

  for (let i = 0; i < inversion; i++) {
    const [lowestNote, ...rest] = notes;
    const { pc, oct } = Note.get(lowestNote);
    // "oct" est optionnel dans le type de Tonal (une note sans octave n'en a
    // pas), mais ici la note vient toujours de chordNotesWithOctaves, qui en
    // ajoute une systématiquement : le "?? 0" ne sert qu'à satisfaire
    // TypeScript, ce cas ne se produit pas en pratique.
    const raisedNote = `${pc}${(oct ?? 0) + 1}`;
    notes = [...rest, raisedNote];
  }

  return notes;
}

// Transpose TOUTES les notes reçues d'une octave, dans la direction donnée
// (+1 pour monter, -1 pour descendre) : jamais une note isolée. Note.get
// sépare le nom de note ("pc", ex: "C") de son octave ("oct", ex: 5) ; on
// reconstruit juste la note avec oct + direction, exactement comme le fait
// déjà invertChord pour une seule note à la fois.
function transposeNotesByOctave(notes: string[], direction: 1 | -1): string[] {
  return notes.map((note) => {
    const { pc, oct } = Note.get(note);
    // Même remarque que dans invertChord : "oct" est optionnel dans le type
    // Tonal, mais les notes reçues par fitNotesToRange viennent toujours de
    // chordNotesWithOctaves / invertChord, qui en ajoutent une systématiquement.
    return `${pc}${(oct ?? 0) + direction}`;
  });
}

// Convertit un tableau de notes (avec octave) en leurs positions MIDI,
// en ignorant les notes mal orthographiées (Note.midi renvoie alors null).
function getMidiValues(notes: string[]): number[] {
  return notes.map((note) => Note.midi(note)).filter((midi): midi is number => midi !== null);
}

// Ramène un accord dans les bornes MIDI [lowMidi, highMidi] en transposant
// TOUTES ses notes ensemble, octave par octave (jamais une note isolée), pour
// qu'il reste musicalement identique : mêmes notes, même renversement, même
// basse relative — seule son octave globale change.
//
// Cas prioritaire, celui qui se produit avec les renversements actuels : une
// note remontée par invertChord peut dépasser la borne haute du clavier (ex:
// 2e renversement de La mineur → ["E4","A4","C5"], C5 dépasse B4, la dernière
// touche affichée). Condition de débordement : la note la plus AIGUË (le max
// des positions MIDI) dépasse highMidi. Tant que c'est le cas, on fait
// descendre tout l'accord d'une octave (-12 en MIDI, via transposeNotesByOctave
// avec direction -1) et on recalcule les positions MIDI, jusqu'à ce que
// l'accord entier tienne sous highMidi.
//
// Cas symétrique, optionnel (ne se produit pas avec les renversements actuels,
// mais gère le cas général) : si la note la plus GRAVE (le min des positions
// MIDI) reste sous lowMidi, on remonte tout l'accord d'une octave — mais
// seulement si ça ne ferait pas redépasser highMidi de l'autre côté (accord
// trop large pour tenir entre les deux bornes), pour éviter une boucle qui
// alternerait indéfiniment entre "trop haut" et "trop bas".
export function fitNotesToRange(notes: string[], lowMidi: number, highMidi: number): string[] {
  let result = notes;
  let midis = getMidiValues(result);

  while (midis.length > 0 && Math.max(...midis) > highMidi) {
    result = transposeNotesByOctave(result, -1);
    midis = getMidiValues(result);
  }

  while (
    midis.length > 0 &&
    Math.min(...midis) < lowMidi &&
    Math.max(...midis) + 12 <= highMidi
  ) {
    result = transposeNotesByOctave(result, 1);
    midis = getMidiValues(result);
  }

  return result;
}
