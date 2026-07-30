import { Chord, Note, Scale } from 'tonal';

import { ALTERATION_RULES, type AlterableDegree, type AlterationRule, type ChordQuality } from './alterationRules';

// Gammes actuellement gérées pour convertir un degré en accord concret.
// (Le type Gamme du dataset des progressions en prévoit d'autres pour plus
// tard, mais seules "majeur"/"mineur" sont câblées ici.)
export type ScaleChoice = 'majeur' | 'mineur';

// Traduit notre nom de gamme interne vers le nom que Tonal.js attend
// (Scale.get reconnaît "major" et "minor", ce dernier désignant la gamme
// mineure naturelle, c'est-à-dire l'aeolien).
export const TONAL_SCALE_NAME: Record<ScaleChoice, string> = {
  majeur: 'major',
  mineur: 'minor',
};

// Position (0 à 6) de chaque degré romain dans la gamme, indépendamment de la casse.
export const ROMAN_TO_INDEX: Record<string, number> = {
  i: 0,
  ii: 1,
  iii: 2,
  iv: 3,
  v: 4,
  vi: 5,
  vii: 6,
};

// Calcule l'accord concret (ex: "F", "Am", "Bdim") correspondant à un degré,
// dans une gamme et une tonalité données.
//
// 1) Scale.get(`${tonic} ${scaleName}`).notes : Tonal construit la gamme
//    demandée (majeure ou mineure naturelle) à partir de la tonique et
//    renvoie ses 7 notes, dans l'ordre.
// 2) On repère l'index du degré (I → 0, ii → 1, ...) pour piocher la bonne
//    note dans ce tableau : c'est la fondamentale de l'accord.
// 3) La casse du chiffre romain (majuscule/minuscule) et le "°" nous disent
//    si l'accord est majeur, mineur ou diminué.
// 4) Chord.get(`${root}${suffix}`) fait construire l'accord par Tonal et
//    nous renvoie, entre autres, son "symbol" : le nom concret et lisible
//    de l'accord (ex: "Am", "Bdim").
export function degreeToChord(degree: string, scale: ScaleChoice, tonic: string): string {
  const scaleNotes = Scale.get(`${tonic} ${TONAL_SCALE_NAME[scale]}`).notes;

  const romanPart = degree.replace('°', '');
  const index = ROMAN_TO_INDEX[romanPart.toLowerCase()];
  const root = scaleNotes[index];

  const isDiminished = degree.includes('°');
  const isUppercase = romanPart === romanPart.toUpperCase();
  const suffix = isDiminished ? 'dim' : isUppercase ? '' : 'm';

  return Chord.get(`${root}${suffix}`).symbol;
}

// Qualité de 7e diatonique attendue à chaque degré (index 0 à 6) de chaque
// gamme — le POINT MUSICAL CLÉ de l'enrichissement, réutilisé ci-dessous
// comme BASE pour nommer aussi les niveaux 9/11/13 (voir buildExtendedChord)
// ET comme "TYPE d'accord" que lisent les règles d'altération (voir
// findAlterationRule et alterationRules.ts pour le format d'une règle).
//
// La 7e "correcte" ne dépend pas seulement de la nature de la triade
// (majeure/mineure/diminuée) : elle dépend de la POSITION du degré dans la
// gamme. Exemple en gamme majeure : I et IV sont tous les deux des triades
// majeures, mais seul le Vème degré (la dominante) prend une 7e "de
// dominante" (ex: "G7") — I et IV prennent une 7e MAJEURE (ex: "Cmaj7",
// "Fmaj7"). Une 7e "mécanique" (ex : toujours empiler la même tierce
// au-dessus de la triade, ou toujours prendre "maj7") donnerait donc de
// mauvais accords sur certains degrés. On encode à la place, en dur, le
// résultat de l'harmonisation standard de chaque gamme :
// - Gamme MAJEURE       : I→maj7, ii→m7, iii→m7, IV→maj7, V→7 (dominante),
//                          vi→m7, vii→m7b5 (demi-diminué).
// - Gamme MINEURE (nat.): i→m7, ii→m7b5, III→maj7, iv→m7, v→m7, VI→maj7,
//                          VII→7 (dominante).
// Ces suffixes ("maj7", "m7", "7", "m7b5") sont ceux que Tonal.js
// (Chord.get) reconnaît directement. Indexé par ROMAN_TO_INDEX, donc
// indépendant de la casse du chiffre romain reçu en entrée (contrairement à
// degreeToChord ci-dessus, qui s'en sert pour la triade).
const DIATONIC_SEVENTH_SUFFIX: Record<ScaleChoice, ChordQuality[]> = {
  majeur: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'],
  mineur: ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'],
};

// Niveaux d'enrichissement gérés, en escalier : 0 = triade seule, puis
// 7/9/11/13 ajoutent respectivement la 7e, 9e, 11e, 13e SANS jamais retirer
// les notes des niveaux précédents (9 implique 7, qui implique la triade,
// etc.) — c'est la définition même d'un escalier diatonique.
export type ExtensionLevel = 0 | 7 | 9 | 11 | 13;

// Nombre de notes empilées par niveau : la triade en a 3 (R, 3, 5), et
// chaque niveau suivant en ajoute UNE seule, celle qui lui donne son nom.
// Au niveau 13, les 7 notes couvrent la gamme entière réordonnée en
// tierces à partir du degré (voir stackedDiatonicNotes).
const NOTE_COUNT_BY_LEVEL: Record<ExtensionLevel, number> = {
  0: 3,
  7: 4,
  9: 5,
  11: 6,
  13: 7,
};

// LE POINT MUSICAL CLÉ des extensions (9e/11e/13e) : construire les notes en
// EMPILANT DES TIERCES DIATONIQUES directement dans les notes de la gamme,
// plutôt que via un nom d'accord Tonal tout fait (ex: Chord.get('C11')).
//
// Pourquoi pas Chord.get pour les notes : les symboles "11"/"13" de Tonal
// suivent la convention jazz réelle, qui OMET certaines notes par souci de
// clarté harmonique (un accord "11" dominant omet la tierce, un "13" omet
// la 11e — vérifié : Chord.get('C11').notes ne contient pas de tierce). Or
// la demande ici est un escalier PUR où chaque niveau ajoute STRICTEMENT
// une note à l'accord précédent, sans jamais en retirer.
//
// La construction : à partir de l'index du degré dans la gamme (rootIndex),
// on prend UNE NOTE SUR DEUX dans les 7 notes de la gamme (cyclique, modulo
// 7) : rootIndex (racine), rootIndex+2 (tierce), +4 (quinte), +6 (7e), +8
// →+1 mod 7 (9e), +10→+3 mod 7 (11e), +12→+5 mod 7 (13e). Comme 2 et 7 sont
// premiers entre eux, ces 7 indices (pour level=13) couvrent l'intégralité
// des 7 notes de la gamme, chacune exactement une fois : la 9e/11e/13e sont
// donc TOUJOURRS des notes de la gamme (jamais de note étrangère), quel que
// soit le degré et sa qualité (y compris vii°/ii°, pour lesquels Tonal n'a
// d'ailleurs aucun symbole "11"/"13" tout fait dans son dictionnaire).
function stackedDiatonicNotes(scaleNotes: string[], rootIndex: number, level: ExtensionLevel): string[] {
  const count = NOTE_COUNT_BY_LEVEL[level];
  return Array.from({ length: count }, (_, i) => scaleNotes[(rootIndex + 2 * i) % 7]);
}

// Cherche, parmi ALTERATION_RULES (voir alterationRules.ts pour le format
// complet d'une règle), la 1ère règle dont le TYPE d'accord et le niveau
// correspondent : appliesToQuality === quality, ET level >= minLevel (donc
// une règle à minLevel 11 s'applique aussi bien au niveau 11e qu'au niveau
// 13e). C'est TOUTE la logique de "lecture" de la table — ajouter une règle
// plus tard (ex: ♭9 sur dominante) ne demande donc aucun changement ici,
// juste une nouvelle entrée dans ALTERATION_RULES.
function findAlterationRule(quality: ChordQuality, level: ExtensionLevel): AlterationRule | null {
  return (
    ALTERATION_RULES.find((rule) => rule.appliesToQuality === quality && level >= rule.minLevel) ?? null
  );
}

// Position (index) d'un degré d'extension dans le tableau produit par
// stackedDiatonicNotes (ordre R-3-5-7-9-11-13, indices 0 à 6) : sert à
// savoir QUELLE note altérer quand une règle s'applique (voir
// buildExtendedChord ci-dessous).
const DEGREE_TO_STACK_INDEX: Record<AlterableDegree, number> = {
  9: 4,
  11: 5,
  13: 6,
};

// Intervalle "naturel" attendu, en demi-tons par rapport à la fondamentale
// (modulo 12, donc indépendant de l'octave), pour un degré d'extension NON
// altéré : 9e → 2 (seconde majeure), 11e → 5 (quarte JUSTE), 13e → 9
// (sixte majeure).
//
// GARDE-FOU MUSICAL : sert à vérifier, avant d'appliquer une règle, que la
// note diatonique BRUTE à ce degré est bien à cette position "naturelle" —
// sinon on ne l'altère PAS. Pourquoi ce garde-fou est nécessaire : la 7e
// note de la gamme majeure est déjà un TRITON (11e AUGMENTÉE, pas juste)
// au-dessus du IVème degré (ex: en Do majeur, Si est un triton au-dessus de
// Fa) — le IVème degré est un accord "maj7" tout comme le Ier, mais sa 11e
// diatonique est DÉJÀ altérée par construction (c'est d'ailleurs la raison
// théorique pour laquelle le IVème degré "sonne" naturellement lydien).
// Sans ce garde-fou, la règle ♯11 s'appliquerait AUSSI au IVème degré et
// hausserait une note déjà augmentée d'un demi-ton de plus (double dièse),
// ce qui est faux musicalement — seul le Ier degré (majeur) / IIIème degré
// (mineur naturel) ont une 11e VRAIMENT juste qui a besoin d'être haussée.
const NATURAL_SEMITONES_BY_DEGREE: Record<AlterableDegree, number> = {
  9: 2,
  11: 5,
  13: 9,
};

// Hausse ou baisse d'un demi-ton une note DE LA GAMME (sans octave), en
// préservant son nom de lettre (ex: "F" haussé → "F#", jamais son
// équivalent enharmonique "Gb") : c'est exactement la définition d'une
// altération (♯/♭) par rapport à la note diatonique brute. Utilise
// l'intervalle d'unisson augmenté/diminué de Tonal (1A = +1 demi-ton, -1A =
// -1 demi-ton) plutôt qu'un calcul MIDI manuel, pour que Tonal choisisse
// lui-même la bonne orthographe (vérifié : F→F#, mais aussi Bb→B, jamais
// Bb→Cb ni autre respelling surprenant).
function alterPitchClass(pitchClass: string, semitoneShift: 1 | -1): string {
  return Note.transpose(pitchClass, semitoneShift === 1 ? '1A' : '-1A');
}

// Résultat complet du calcul d'un accord enrichi : son nom affiché, ses
// notes (avec octave, prêtes pour PianoChord), et — si une règle
// d'altération s'est appliquée — la règle elle-même (pour afficher son
// explication pédagogique) et le CHROMA (0-11) de la note qu'elle a
// modifiée. Le chroma plutôt qu'un index ou un MIDI : un renversement ou un
// voicing (bassAndClusterVoicing) réordonnent les notes et changent leurs
// octaves, mais ne changent JAMAIS le chroma d'une note — c'est donc le
// seul identifiant qui reste valide pour retrouver "quelle touche est
// altérée" après ces transformations (voir functionLabelOverrides dans
// PianoChord.tsx, qui l'utilise pour ça).
export type ExtendedChordResult = {
  chordName: string;
  notes: string[];
  appliedRule: AlterationRule | null;
  alteredChroma: number | null;
};

// Construit un accord enrichi complet (nom + notes + éventuelle altération)
// pour un degré/gamme/tonalité/niveau donnés.
//
// COMMENT UNE RÈGLE D'ALTÉRATION EST LUE ET APPLIQUÉE :
// 1) On calcule la QUALITÉ de l'accord (maj7/m7/7/m7b5, via
//    DIATONIC_SEVENTH_SUFFIX) et on cherche une règle correspondante avec
//    findAlterationRule(quality, level).
// 2) Si une règle existe, on repère SA position dans le tableau de notes
//    empilées (DEGREE_TO_STACK_INDEX[rule.extensionDegree]) et on vérifie
//    que la note diatonique BRUTE à cette position est bien à son intervalle
//    "naturel" attendu (NATURAL_SEMITONES_BY_DEGREE) — sinon elle est déjà
//    altérée par la construction même de la gamme (voir son commentaire),
//    et on n'applique PAS la règle par-dessus.
// 3) Si le garde-fou passe, on remplace CETTE SEULE note par sa version
//    altérée (alterPitchClass) — toutes les autres notes restent
//    diatoniques brutes, inchangées.
// 4) Le NOM utilise alors le suffixe idiomatique de la règle
//    (rule.chordNameSuffix, ex: "maj7♯11") à la place du numéral habituel
//    de cette app (ex: "maj11") : c'est la notation standard pour ce type
//    d'accord, quel que soit le niveau exact (11e ou 13e) qui a déclenché
//    la règle.
// 5) Si aucune règle ne correspond, ou que le garde-fou du point 2 échoue,
//    rien ne change : mêmes notes diatoniques brutes et même nom que le
//    comportement d'avant l'introduction des règles d'altération.
export function buildExtendedChord(
  degree: string,
  scale: ScaleChoice,
  tonic: string,
  level: ExtensionLevel,
  baseOctave: number,
): ExtendedChordResult {
  const scaleNotes = Scale.get(`${tonic} ${TONAL_SCALE_NAME[scale]}`).notes;
  const romanPart = degree.replace('°', '');
  const rootIndex = ROMAN_TO_INDEX[romanPart.toLowerCase()];

  if (level === 0) {
    // Triade seule : aucune règle d'altération ne porte sur un niveau aussi
    // bas (toutes ciblent des extensions 9e+) — comportement inchangé.
    return {
      chordName: degreeToChord(degree, scale, tonic),
      notes: notesWithOctaves(stackedDiatonicNotes(scaleNotes, rootIndex, 0), baseOctave),
      appliedRule: null,
      alteredChroma: null,
    };
  }

  const root = scaleNotes[rootIndex];
  const quality = DIATONIC_SEVENTH_SUFFIX[scale][rootIndex];
  const pitchClasses = stackedDiatonicNotes(scaleNotes, rootIndex, level);
  const rule = findAlterationRule(quality, level);

  let appliedRule: AlterationRule | null = null;
  let alteredChroma: number | null = null;

  if (rule) {
    const stackIndex = DEGREE_TO_STACK_INDEX[rule.extensionDegree];
    // Robustesse pour de futures règles : stackIndex pourrait dépasser la
    // longueur du tableau si une règle ciblait un degré au-delà du niveau
    // demandé (findAlterationRule l'empêche déjà pour CETTE règle via
    // minLevel, mais mieux vaut ne pas dépendre uniquement de ça).
    if (stackIndex < pitchClasses.length) {
      const rawNote = pitchClasses[stackIndex];
      const semitonesFromRoot = (Note.chroma(rawNote) - Note.chroma(root) + 12) % 12;
      // GARDE-FOU (voir le commentaire complet sur NATURAL_SEMITONES_BY_DEGREE) :
      // on n'altère que si la note diatonique BRUTE est bien à sa position
      // "naturelle" — sinon elle est déjà altérée par la construction même
      // de la gamme (ex: la 11e du IVème degré en gamme majeure), et
      // appliquer la règle par-dessus la dénaturerait (double dièse).
      if (semitonesFromRoot === NATURAL_SEMITONES_BY_DEGREE[rule.extensionDegree]) {
        const altered = alterPitchClass(rawNote, rule.semitoneShift);
        alteredChroma = Note.chroma(altered);
        pitchClasses[stackIndex] = altered;
        appliedRule = rule;
      }
    }
  }

  const baseSuffix = level === 7 ? quality : quality.replace('7', String(level));
  const chordName = appliedRule ? `${root}${appliedRule.chordNameSuffix}` : `${root}${baseSuffix}`;

  return {
    chordName,
    notes: notesWithOctaves(pitchClasses, baseOctave),
    appliedRule,
    alteredChroma,
  };
}

// Marqueur de degré spécial pour la dominante secondaire du Vème degré
// (V/V) — voir buildSecondaryDominantOfV juste en dessous. Ce n'est PAS un
// vrai chiffre romain diatonique (aucune entrée dans ROMAN_TO_INDEX) :
// degreeToChord/buildExtendedChord ne peuvent donc pas le résoudre, un
// appelant (voir ExpandedChordPanel dans improResult.tsx) doit le détecter
// explicitement et appeler buildSecondaryDominantOfV à la place. Il vaut
// aussi la notation musicale standard de cet accord ("V/V"), donc affichable
// tel quel comme libellé de degré, sans traduction supplémentaire.
export const SECONDARY_DOMINANT_OF_V_DEGREE = 'V/V';

// Construit la dominante secondaire du Vème degré (V/V) de la tonalité de
// référence donnée.
//
// POINT THÉORIQUE CLÉ : une dominante secondaire d'un degré X est LE V7 DE
// X — l'accord de dominante 7 qu'on obtiendrait si X devenait, le temps
// d'un accord, sa PROPRE tonique. Ici X = le Vème degré : on part donc de sa
// fondamentale (5e note de la gamme de la tonalité de référence, index
// ROMAN_TO_INDEX['v'] = 4), on monte d'une quinte juste pour trouver LA
// fondamentale du V/V (exactement comme on trouverait le V d'une vraie
// tonique), puis on construit l'accord de dominante 7 sur cette fondamentale.
// Exemple en Do majeur : V = Sol → sa dominante (V/V) est construite une
// quinte au-dessus de Sol, donc Ré → l'accord est Ré7 (Ré-Fa♯-La-Do).
//
// Note.transpose (avec l'intervalle nommé "5P", quinte juste) plutôt qu'un
// calcul MIDI : garantit une orthographe CORRECTE de la fondamentale et,
// via Chord.get, de l'accord entier (Fa♯ dans Ré7, jamais son enharmonique
// Solb) — même mécanique que alterPitchClass plus haut dans ce fichier, qui
// transpose par intervalle nommé pour la même raison.
//
// Pas de "niveau d'enrichissement" ici (contrairement à buildExtendedChord) :
// une dominante secondaire est TOUJOURS une 7e de dominante, c'est ce qui la
// définit — et elle est de toute façon EMPRUNTÉE (chromatique, hors de la
// gamme de la tonalité de référence), donc les extensions diatoniques
// 9e/11e/13e de buildExtendedChord (qui empilent des tierces DANS la gamme)
// n'ont pas de sens direct pour elle. appliedRule/alteredChroma restent donc
// toujours null : ExtendedChordResult est réutilisé tel quel (même forme
// que buildExtendedChord) pour que l'appelant n'ait qu'un seul type de
// résultat à gérer, mais aucune règle d'altération ne s'applique jamais ici.
export function buildSecondaryDominantOfV(
  scale: ScaleChoice,
  tonic: string,
  baseOctave: number,
): ExtendedChordResult {
  const scaleNotes = Scale.get(`${tonic} ${TONAL_SCALE_NAME[scale]}`).notes;
  const vRoot = scaleNotes[ROMAN_TO_INDEX.v];
  const secondaryDominantRoot = Note.transpose(vRoot, '5P');
  const secondaryDominantChordName = `${secondaryDominantRoot}7`;

  return {
    chordName: Chord.get(secondaryDominantChordName).symbol,
    notes: chordNotesWithOctaves(secondaryDominantChordName, baseOctave),
    appliedRule: null,
    alteredChroma: null,
  };
}

// Transforme une liste de notes SANS octave, déjà dans l'ordre de l'accord
// (fondamentale, tierce, quinte, 7e, 9e...), en la même liste AVEC octave,
// en montant d'octave chaque fois que nécessaire pour que le résultat monte
// réellement de gauche à droite. Extrait de chordNotesWithOctaves (voir son
// commentaire pour le détail de la logique) pour être RÉUTILISÉ tel quel
// par degreeToExtendedNotes ci-dessus, dont les notes viennent directement
// de la gamme plutôt que de Chord.get.
function notesWithOctaves(pitchClasses: string[], baseOctave: number): string[] {
  let currentOctave = baseOctave;
  let previousChroma: number | null = null;

  return pitchClasses.map((noteName) => {
    const chroma = Note.chroma(noteName);

    if (previousChroma !== null && chroma <= previousChroma) {
      currentOctave += 1;
    }
    previousChroma = chroma;

    return `${noteName}${currentOctave}`;
  });
}

// Construit un voicing "basse + accord groupé" à partir des notes
// fondamentales d'un accord (même entrée que PianoChord attend, ex: sortie
// de degreeToExtendedNotes) : la FONDAMENTALE seule dans le grave (main
// gauche), le RESTE des notes de l'accord (3e, 5e, 7e, 9e...) regroupé le
// plus étroitement possible dans une octave au-dessus (main droite). Ne
// retire ni n'ajoute aucune note — c'est une RÉORGANISATION, pas un autre
// choix d'accord (périmètre strict : un seul type de voicing).
//
// RÉPARTITION grave/aigu (le point clé) :
// - La fondamentale (fundamentalNotes[0]) reste TELLE QUELLE, à son octave
//   d'origine (le grave) : c'est la basse, jouée par la main gauche, elle
//   ne bouge pas.
// - Les autres notes sont réordonnées par hauteur RELATIVE À LA
//   FONDAMENTALE — ((chroma de la note - chroma de la racine + 12) % 12),
//   qui vaut toujours entre 1 et 11 — plutôt que dans leur ordre "empilé en
//   tierces" d'origine (root, 3, 5, 7, 9, 11, 13). Cette différence est
//   essentielle : l'ordre empilé fait des sauts d'une tierce à chaque note
//   (ex: 3→5→7→9 : mi→sol→si→ré), ce qui étale l'accord sur près de 2
//   octaves une fois monté en octaves croissantes (chordNotesWithOctaves).
//   L'ordre "par hauteur relative à la racine", lui, place les notes dans
//   l'ordre où elles apparaissent RÉELLEMENT en montant depuis la
//   fondamentale (ex pour Cmaj9 : ré, mi, sol, si — pas mi, sol, si, ré) :
//   une fois montées en octaves croissantes à partir de clusterBaseOctave,
//   elles se retrouvent donc regroupées le plus étroitement possible (au
//   plus une octave d'écart pour un accord de 13e, contre près de 2 en
//   position empilée) — exactement l'effet "main droite compacte" recherché.
// - Cette main droite démarre une octave au-dessus de la fondamentale
//   (rootOctave + 1) : assez haut pour rester clairement séparée
//   visuellement (et pour la lecture au piano) de la basse, sans monter
//   plus que nécessaire.
export function bassAndClusterVoicing(fundamentalNotes: string[]): string[] {
  const [root, ...rest] = fundamentalNotes;
  const rootChroma = Note.chroma(root);
  // "oct" est optionnel dans le type Tonal, mais root vient toujours d'un
  // accord déjà construit avec octave (degreeToExtendedNotes/
  // chordNotesWithOctaves) : le "?? 0" ne sert qu'à satisfaire TypeScript.
  const rootOctave = Note.get(root).oct ?? 0;

  const restPitchClasses = rest
    .map((note) => Note.get(note).pc)
    .sort((a, b) => {
      const relativeA = (Note.chroma(a) - rootChroma + 12) % 12;
      const relativeB = (Note.chroma(b) - rootChroma + 12) % 12;
      return relativeA - relativeB;
    });

  return [root, ...notesWithOctaves(restPitchClasses, rootOctave + 1)];
}

// Construit un voicing "drop 2" à partir des notes fondamentales (empilées)
// d'un accord : reprend l'accord tel quel et fait descendre sa 2e note EN
// PARTANT DU HAUT d'une octave, sans changer aucune autre note — un voicing
// "ouvert" standard (piano/guitare jazz), qui écarte l'accord sans jamais en
// changer les notes (même principe que bassAndClusterVoicing ci-dessus :
// une RÉORGANISATION, pas un autre choix d'accord).
//
// Exemple sur Cmaj7 empilé ["C3","E3","G3","B3"] (Si en haut) : la 2e note
// en partant du haut est Sol (juste sous le Si) → on la descend d'une
// octave (G3 → G2). Résultat, une fois retrié du grave à l'aigu : ["G2",
// "C3", "E3", "B3"] — Sol grave et isolé, Do-Mi-Si regroupés au-dessus.
//
// "notes" doit déjà être trié du grave à l'aigu (comme
// chordNotesWithOctaves/degreeToExtendedNotes le garantissent) : la 2e note
// depuis le haut est donc l'avant-dernière du tableau reçu (notes.length -
// 2). Retrié par MIDI après la descente (comme invertChord) car la note
// descendue devient la plus grave, plus la dernière du tableau.
export function dropTwoVoicing(notes: string[]): string[] {
  // Un voicing "drop 2" suppose au moins 2 notes distinctes à réorganiser ;
  // en dessous, il n'y a rien à faire descendre.
  if (notes.length < 2) return notes;

  const dropIndex = notes.length - 2;
  const { pc, oct } = Note.get(notes[dropIndex]);
  // Même remarque que dans invertChord/bassAndClusterVoicing : "oct" est
  // optionnel dans le type Tonal, mais toujours présent en pratique ici.
  const loweredNote = `${pc}${(oct ?? 0) - 1}`;

  const otherNotes = notes.filter((_, index) => index !== dropIndex);
  return [loweredNote, ...otherNotes].sort((a, b) => (Note.midi(a) ?? 0) - (Note.midi(b) ?? 0));
}

// Construit les notes d'un accord (état fondamental) avec une octave
// correcte pour chacune, pour un affichage clavier (PianoChord) qui monte
// toujours de gauche à droite.
//
// Chord.get(chordName).notes renvoie les notes de l'accord SANS octave, dans
// l'ordre de l'accord (ex: "G" → ["G", "B", "D"]), mais rien ne garantit
// qu'en les collant toutes à la même octave elles montent réellement : "D"
// est plus bas que "G" dans l'octave (do, ré, mi... ré vient avant sol), donc
// "G3", "B3", "D3" redescendrait au lieu de monter. notesWithOctaves
// ci-dessus fait cette montée d'octave ; ici on lui donne juste les notes
// de l'accord (via Chord.get) plutôt que des notes de gamme.
export function chordNotesWithOctaves(chordName: string, baseOctave: number): string[] {
  return notesWithOctaves(Chord.get(chordName).notes, baseOctave);
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
// que renvoie chordNotesWithOctaves/degreeToExtendedNotes) : la note la plus
// grave est donc toujours en tête de tableau AU DÉPART. Pour obtenir le
// renversement demandé, on répète "inversion" fois la même opération
// élémentaire : prendre la note en tête de tableau, la monter d'une octave
// (Note.get sépare le nom de la note — "pc", ex: "G" — de son numéro
// d'octave — "oct", ex: 3 — ce qui permet de reconstruire juste "G4"), puis
// la RÉINSÉRER À SA VRAIE PLACE, triée par hauteur (MIDI) — pas
// systématiquement en fin de tableau.
//
// Ce dernier point (le tri) est le correctif apporté avec les accords
// enrichis : pour une triade ou une 7e, l'ancien code se contentait
// d'ajouter la note remontée en FIN de tableau, ce qui revient au même que
// trier PARCE QUE l'étendue d'une triade/7e (au plus une dixième, ~11 demi-
// tons) est toujours plus petite qu'une octave (12 demi-tons) : remonter la
// note la plus grave d'une octave la fait donc TOUJOURS dépasser toutes les
// autres. Ce n'est plus vrai pour un accord de 9e/11e/13e, dont l'étendue
// peut dépasser une octave (jusqu'à une treizième, ~21 demi-tons) : la
// remonter d'UNE SEULE octave ne suffit pas toujours à dépasser la note la
// plus aiguë restante, et l'ajouter en fin de tableau sans trier cassait
// alors l'ordre croissant (des renversements erratiques, avec des notes
// affichées bien plus haut que prévu). Trier après chaque étape corrige ça
// pour toutes les tailles d'accord, sans rien changer pour les triades/7e
// (où trier ou ajouter en fin donnait déjà le même résultat).
export function invertChord(fundamentalNotes: string[], inversion: number): string[] {
  let notes = [...fundamentalNotes];

  for (let i = 0; i < inversion; i++) {
    const [lowestNote, ...rest] = notes;
    const { pc, oct } = Note.get(lowestNote);
    // "oct" est optionnel dans le type de Tonal (une note sans octave n'en a
    // pas), mais ici la note vient toujours de chordNotesWithOctaves /
    // degreeToExtendedNotes, qui en ajoutent une systématiquement : le "?? 0"
    // ne sert qu'à satisfaire TypeScript, ce cas ne se produit pas en pratique.
    const raisedNote = `${pc}${(oct ?? 0) + 1}`;
    notes = [...rest, raisedNote].sort((a, b) => (Note.midi(a) ?? 0) - (Note.midi(b) ?? 0));
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

// --- Affichage : noms de note lisibles -------------------------------------
//
// Traduit une lettre de note Tonal (A-G) vers son nom français (solfège) —
// utilisé pour afficher la tonalité choisie sur l'écran résultat de l'impro
// (voir TonalityModal dans improResult.tsx).
const FRENCH_NOTE_LETTERS: Record<string, string> = {
  C: 'Do',
  D: 'Ré',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

// Convertit un nom de note Tonal SANS octave (ex: "C#", "Bb", "D") en son nom
// français lisible (ex: "Do♯", "Si♭", "Ré"). Note.get sépare la lettre de
// base ("letter") de ses altérations ("acc", une chaîne de "#" et/ou "b") :
// plus fiable qu'un découpage manuel de la chaîne. Chaque caractère de "acc"
// est traduit individuellement en son symbole typographique (♯/♭) — une
// boucle plutôt qu'un simple remplacement, au cas où une note aurait 2
// altérations (double dièse/bémol), même si aucune tonique de cette app n'en
// a besoin aujourd'hui.
export function toFrenchNoteName(pitchClass: string): string {
  const { letter, acc } = Note.get(pitchClass);
  const accidentals = [...acc].map((char) => (char === '#' ? '♯' : '♭')).join('');
  return `${FRENCH_NOTE_LETTERS[letter] ?? letter}${accidentals}`;
}

// Choisit l'orthographe la plus lisible d'une tonique pour l'AFFICHAGE :
// préfère le bémol au dièse (ex: "Db" plutôt que "C#") pour les 5 touches
// noires — Note.enharmonic (Tonal) calcule l'équivalent enharmonique correct
// plutôt qu'une conversion tapée à la main. Les touches blanches n'ont pas
// d'ambiguïté, elles restent telles quelles. Cette fonction ne sert QU'À
// L'AFFICHAGE : le calcul musical (degreeToChord, buildExtendedChord...)
// continue de recevoir la tonique orthographiée en dièse (la convention déjà
// utilisée partout ailleurs dans l'app pour les touches noires, voir
// BLACK_KEY_PATTERN dans PianoChord.tsx).
export function toFlatPreferredSpelling(pitchClass: string): string {
  return pitchClass.includes('#') ? Note.enharmonic(pitchClass) : pitchClass;
}
