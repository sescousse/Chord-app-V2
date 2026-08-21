// PREMIER analyseur harmonique — PUR (aucune UI, aucun audio, testable tel
// quel) : convertit une suite d'accords tapés à la main + une tonalité en
// leur DEGRÉ (chiffre romain) dans cette tonalité, leur QUALITÉ en clair
// (FR), et un statut DIATONIQUE/ALTÉRÉ (qualité jouée vs attendue pour ce
// degré — gamme majeure uniquement, voir DIATONIC_QUALITY_MAJOR). Périmètre
// STRICT : pas de détection de cadence, pas d'emprunt nommé, pas de
// dominante secondaire nommée (étapes séparées, volontairement hors de ce
// fichier — "altéré" ne dit jamais pourquoi).
import { Chord, Note, Scale } from 'tonal';

// 3 issues possibles pour un accord saisi — distinguées explicitement (pas
// un simple "non reconnu" générique) pour que l'écran de test puisse
// afficher un message clair et différent dans chaque cas :
// - 'reconnu' : tonal a parsé l'accord ET sa fondamentale appartient à la
//   gamme choisie → degré calculé.
// - 'nonReconnu' : tonal n'a pas su parser la saisie (notation invalide,
//   vide, charabia).
// - 'horsTonalite' : l'accord EST reconnu par tonal (accordCompris est donc
//   rempli), mais sa fondamentale n'appartient PAS à la gamme choisie — pas
//   de degré possible dans CETTE tonalité.
export type StatutAnalyseAccord = 'reconnu' | 'nonReconnu' | 'horsTonalite';

// Statut diatonique — un RAFFINEMENT qui ne s'applique que quand statut ===
// 'reconnu' (null sinon, voir plus bas) :
// - 'diatonique' : qualité de base (Major/Minor/Diminished/Augmented, sans
//   tenir compte des extensions type 7e) conforme à l'attendu pour ce degré.
// - 'altere' : fondamentale DANS la gamme, mais qualité différente de
//   l'attendu (ex: "D7" en Do majeur — ii attendu mineur, ici majeur). Ne dit
//   PAS pourquoi (pas de "dominante secondaire"/"emprunt" — étape future).
// - 'qualiteIndeterminee' : tonal ne peut pas trancher Major/Minor pour cet
//   accord (ex: accords suspendus, quality "Unknown") — comparaison
//   honnêtement impossible plutôt qu'un verdict inventé.
// - 'gammeNonPriseEnCharge' : tonalité MINEURE — voir le commentaire détaillé
//   au-dessus de DIATONIC_QUALITY_MAJOR pour le pourquoi (pas de table
//   mineure pour cette brique).
export type StatutDiatonique = 'diatonique' | 'altere' | 'qualiteIndeterminee' | 'gammeNonPriseEnCharge';

export type ResultatAnalyseAccord = {
  // Texte tel que tapé par l'utilisateur, TEL QUEL — sert de repère à
  // l'affichage, jamais modifié ici.
  saisie: string;
  // Nom NORMALISÉ par tonal (ex: "Dm7" reste "Dm7", mais une saisie plus
  // permissive serait nettoyée) — null si nonReconnu (rien à normaliser).
  accordCompris: string | null;
  // Chiffre romain (ex: "ii", "V", "vii°") — null si nonReconnu ou
  // horsTonalite (aucun degré à afficher dans ces 2 cas).
  degre: string | null;
  statut: StatutAnalyseAccord;
  // Libellé français lisible (ex: "Ré mineur 7") — null si statut !==
  // 'reconnu' (rien à décrire : la saisie n'a pas produit d'accord exploitable).
  qualiteEnClair: string | null;
  // null si statut !== 'reconnu' (le diatonisme n'a de sens que pour un
  // accord dont la fondamentale ET la qualité ont pu être déterminées).
  statutDiatonique: StatutDiatonique | null;
};

// Les 7 degrés de base, dans l'ordre — l'INDEX (0 à 6) d'une note dans la
// gamme (voir Scale.get plus bas) pointe directement dans ce tableau.
const ROMAN_BASE_BY_INDEX = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// Construit le chiffre romain final à partir du degré de base ET de la
// QUALITÉ de l'accord (tonal : "Major" | "Minor" | "Augmented" |
// "Diminished" | "Unknown", vérifié dans node_modules/@tonaljs/chord-type) —
// c'est CETTE valeur qui décide majuscule/minuscule, pas la gamme :
// - Major (inclut les accords de dominante, ex: "G7" → quality "Major",
//   vérifié) → majuscule seule (ex: "V").
// - Minor → minuscule seule (ex: "ii").
// - Diminished → minuscule + "°" (ex: "vii°") — même convention que
//   ROMAN_TO_INDEX/degreeToChord dans chordUtils.ts (l'app gère déjà ce
//   symbole dans l'AUTRE sens, degré → accord ; on le reprend ici tel quel).
// - Augmented → majuscule + "+" (ex: "III+") — notation standard, symétrique
//   du "°" diminué (une triade augmentée s'empile depuis une tierce
//   MAJEURE, d'où la majuscule).
// - Unknown (ex: accords suspendus "sus2"/"sus4", sans tierce définissant
//   majeur/mineur — vérifié : Chord.get('Csus4').quality === 'Unknown') →
//   minuscule + "?" : le DEGRÉ (la position dans la gamme) reste correct et
//   affiché, mais la casse ne peut pas être honnêtement affirmée sans
//   tierce — le "?" le signale plutôt que de choisir arbitrairement.
// "quality: string" plutôt que le type précis de tonal (ChordQuality,
// défini dans @tonaljs/chord-type — pas une dépendance directe de ce projet,
// seulement transitive via "tonal") : la valeur reçue ici est de toute façon
// déjà correctement typée à l'appel (chord.quality, voir plus bas), et le
// "default" ci-dessous absorbe aussi bien "Unknown" qu'une éventuelle future
// valeur ajoutée par tonal — pas de "any", juste un type volontairement
// moins contraignant que l'union exacte.
function romanNumeralForDegree(baseIndex: number, quality: string): string {
  const base = ROMAN_BASE_BY_INDEX[baseIndex];

  switch (quality) {
    case 'Major':
      return base;
    case 'Augmented':
      return `${base}+`;
    case 'Minor':
      return base.toLowerCase();
    case 'Diminished':
      return `${base.toLowerCase()}°`;
    default:
      return `${base.toLowerCase()}?`;
  }
}

// Traduction FR de la tonique — dupliquée volontairement plutôt
// qu'importée de chordUtils.ts (qui a une fonction équivalente,
// toFrenchNoteName) : ce fichier reste un module autonome, sans dépendance
// vers le reste de l'app (même logique déjà suivie par HarmonyTestScreen.tsx,
// voir son propre commentaire à ce sujet) — la duplication ici tient en
// quelques lignes, largement plus simple qu'un couplage inter-modules.
const FRENCH_NOTE_LETTERS: Record<string, string> = {
  C: 'Do',
  D: 'Ré',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

function toFrenchTonicLabel(pitchClass: string): string {
  const { letter, acc } = Note.get(pitchClass);
  const accidentals = [...acc].map((char) => (char === '#' ? '♯' : '♭')).join('');
  return `${FRENCH_NOTE_LETTERS[letter] ?? letter}${accidentals}`;
}

// tonal expose "type" (description anglaise longue, ex: "minor seventh",
// "dominant seventh") — traduit ici vers un libellé FR court. Couvre les
// qualités les plus courantes ; toute entrée absente retombe sur
// QUALITY_LABEL_FR (juste la qualité de base, sans extension) plutôt que de
// planter ou d'afficher du texte anglais brut.
const TYPE_LABEL_FR: Record<string, string> = {
  major: 'majeur',
  minor: 'mineur',
  augmented: 'augmenté',
  diminished: 'diminué',
  'major seventh': 'majeur 7',
  'minor seventh': 'mineur 7',
  'dominant seventh': 'dominante 7',
  'diminished seventh': 'diminué 7',
  'half-diminished': 'demi-diminué',
  'minor/major seventh': 'mineur/majeur 7',
  'augmented seventh': 'augmenté 7',
  sixth: '6',
  'minor sixth': 'mineur 6',
  'dominant ninth': 'dominante 9',
  'dominant thirteenth': 'dominante 13',
  'suspended fourth': 'suspendu 4',
  'suspended second': 'suspendu 2',
};

// Filet pour un "type" absent du dictionnaire ci-dessus : au moins la
// qualité de base (elle, toujours connue — Major/Minor/Diminished/Augmented/
// Unknown), plutôt que rien.
const QUALITY_LABEL_FR: Record<string, string> = {
  Major: 'majeur',
  Minor: 'mineur',
  Diminished: 'diminué',
  Augmented: 'augmenté',
  Unknown: 'qualité incertaine',
};

// "tonic"/"type"/"quality" viennent tous de Chord.get (voir son usage dans
// analyserAccord) — jamais appelée avec un accord vide/non reconnu.
function qualiteEnClair(tonic: string, type: string, quality: string): string {
  const tonicLabel = toFrenchTonicLabel(tonic);
  const qualiteLabel = TYPE_LABEL_FR[type] ?? QUALITY_LABEL_FR[quality] ?? QUALITY_LABEL_FR.Unknown;
  return `${tonicLabel} ${qualiteLabel}`;
}

// Qualité de BASE attendue à chaque degré (index 0-6) d'une gamme MAJEURE —
// même vocabulaire que chord.quality (Major/Minor/Diminished), comparé
// directement plus bas. Comme tonal range DÉJÀ un accord de 7e sous la MÊME
// quality que sa triade (vérifié : "G" et "G7" sont tous deux "Major", "Dm"
// et "Dm7" sont tous deux "Minor"), cette comparaison ignore AUTOMATIQUEMENT
// la présence/absence d'une 7e pour les accords NON-dominants (ii/ii7 restent
// tous deux "mineur attendu"). Les accords de dominante 7 (triade majeure +
// 7e mineure) NE passent PAS par cette table simple : ils ont leur propre
// règle dédiée (degré V uniquement) dans calculerStatutDiatonique, sinon
// "Major" les ferait passer à tort pour diatoniques sur N'IMPORTE quel degré
// majeur (I, IV) — c'est le bug que cette règle séparée corrige (ex: "C7" en
// Do majeur doit être altéré, pas diatonique).
const DIATONIC_QUALITY_MAJOR: string[] = ['Major', 'Minor', 'Minor', 'Major', 'Major', 'Minor', 'Diminished'];

// Pas de table pour le mineur dans cette brique : en mineur NATUREL le ve
// degré est mineur, mais en pratique une tonalité mineure utilise presque
// toujours un V/V7 MAJEUR (emprunté au mineur harmonique/mélodique) — une
// table naïve sur le mineur naturel signalerait ce cas extrêmement courant
// et correct comme "altéré", un faux résultat pire que pas de résultat.
// Choix explicite : mieux vaut "analyse non disponible" (statutDiatonique
// 'gammeNonPriseEnCharge') qu'un verdict faux.
function estTonaliteMajeure(tonalite: string): boolean {
  const dernierMot = tonalite.trim().split(/\s+/).pop();
  return dernierMot === 'major';
}

// Index du Ve degré dans DIATONIC_QUALITY_MAJOR/ROMAN_BASE_BY_INDEX (I=0 →
// V=4) — utilisé ci-dessous pour la règle spéciale dominante-7.
const DEGREE_INDEX_V = 4;

// "Dominante 7" = triade MAJEURE + 7e MINEURE (ex: C7, G7, C7b9, C13 — mais
// PAS Cmaj7, dont la 7e est majeure, ni Cm7, dont la triade est mineure).
// quality seule ("Major") ne suffit PAS à isoler ce cas : Cmaj7 est aussi
// "Major" mais n'a pas la 7e mineure caractéristique de la dominante — il
// faut regarder intervals directement. `.type` a été écarté : vide pour des
// dominantes altérées comme "C7b5"/"C7#5" (vérifié), donc pas fiable seul.
function estAccordDominante(quality: string, intervals: readonly string[]): boolean {
  return quality === 'Major' && intervals.includes('7m');
}

function calculerStatutDiatonique(
  degreeIndex: number,
  quality: string,
  intervals: readonly string[],
  tonalite: string,
): StatutDiatonique {
  if (!estTonaliteMajeure(tonalite)) {
    return 'gammeNonPriseEnCharge';
  }
  if (quality === 'Unknown') {
    return 'qualiteIndeterminee';
  }

  // Cas spécial dominante-7 : diatonique SEULEMENT sur le Ve degré (V7),
  // altéré partout ailleurs (ex: C7 sur I, D7 sur ii) — remplace l'ancienne
  // tolérance globale "toute dominante est diatonique", qui laissait
  // passer C7-sur-I à tort (bug corrigé ici). Ce cas est vérifié AVANT la
  // table générale : une dominante sur un degré normalement "majeur" (I ou
  // IV) ne doit pas hériter du verdict "diatonique" de ce degré.
  if (estAccordDominante(quality, intervals)) {
    return degreeIndex === DEGREE_INDEX_V ? 'diatonique' : 'altere';
  }

  return quality === DIATONIC_QUALITY_MAJOR[degreeIndex] ? 'diatonique' : 'altere';
}

// Analyse UN accord saisi dans la tonalité donnée (ex: "C major", "F minor"
// — format tonal direct : "{tonique} {major|minor}", accepté tel quel par
// Scale.get, voir son usage déjà établi dans chordUtils.ts). Ne lève JAMAIS
// d'exception : toute entrée invalide retombe sur statut 'nonReconnu' plutôt
// que de planter.
export function analyserAccord(saisie: string, tonalite: string): ResultatAnalyseAccord {
  const texte = saisie.trim();

  // Saisie vide (case limite explicitement demandée) : rien à parser, pas
  // la peine d'appeler tonal pour ça.
  if (texte === '') {
    return {
      saisie,
      accordCompris: null,
      degre: null,
      statut: 'nonReconnu',
      qualiteEnClair: null,
      statutDiatonique: null,
    };
  }

  // Chord.get NE LÈVE JAMAIS : une notation invalide renvoie un Chord "vide"
  // (empty: true, tonic: null) plutôt qu'une exception — c'est CE champ
  // qu'on vérifie, jamais de try/catch nécessaire ici (vérifié : voir le
  // script de test utilisé pour valider cette approche).
  const chord = Chord.get(texte);
  if (chord.empty || chord.tonic === null) {
    return {
      saisie,
      accordCompris: null,
      degre: null,
      statut: 'nonReconnu',
      qualiteEnClair: null,
      statutDiatonique: null,
    };
  }

  const scaleNotes = Scale.get(tonalite).notes;

  // Comparaison par CHROMA (position 0-11 dans l'octave, indépendante de
  // l'orthographe), PAS par égalité de texte : la fondamentale de l'accord
  // et la note de la gamme peuvent être la MÊME hauteur mais orthographiées
  // différemment (ex: "A#" contre "Bb", même chroma 10, vérifié) — une
  // comparaison de chaînes les manquerait à tort et déclarerait l'accord
  // "hors tonalité" alors qu'il ne l'est pas. Même technique déjà établie
  // dans PianoChord.tsx (Note.chroma) pour un problème identique.
  const chordChroma = Note.chroma(chord.tonic);
  const degreeIndex = scaleNotes.findIndex((note) => Note.chroma(note) === chordChroma);

  if (degreeIndex === -1) {
    // Fondamentale hors gamme : pas de degré, et pas de comparaison
    // diatonique possible (elle suppose une position dans la gamme) — la
    // qualité en clair, elle, reste affichable (l'écran de test garde
    // cependant "l'affichage actuel" pour ce statut, donc ce champ n'est
    // simplement pas consommé ici, sans qu'il soit faux de le calculer).
    return {
      saisie,
      accordCompris: chord.symbol,
      degre: null,
      statut: 'horsTonalite',
      qualiteEnClair: null,
      statutDiatonique: null,
    };
  }

  return {
    saisie,
    accordCompris: chord.symbol,
    degre: romanNumeralForDegree(degreeIndex, chord.quality),
    statut: 'reconnu',
    qualiteEnClair: qualiteEnClair(chord.tonic, chord.type, chord.quality),
    statutDiatonique: calculerStatutDiatonique(degreeIndex, chord.quality, chord.intervals, tonalite),
  };
}

// Analyse une SUITE d'accords d'un coup — simple .map() sur analyserAccord,
// exposée séparément pour que l'écran de test n'ait qu'un seul appel à
// faire sur toute la liste saisie.
export function analyserProgression(saisies: string[], tonalite: string): ResultatAnalyseAccord[] {
  return saisies.map((saisie) => analyserAccord(saisie, tonalite));
}

// Un accord diatonique GÉNÉRÉ à partir d'une gamme (direction INVERSE de
// analyserAccord : gamme → accords, pas accord → degré) — voir
// genererAccordsDiatoniques plus bas. Utilisé par l'exercice "Reproduis
// l'accord" (ReproduisAccordScreen.tsx) : "classesDeNotes" sert à la
// VALIDATION (comparaison par chroma sur le clavier virtuel), "symbole"/
// "qualiteEnClair" à l'AFFICHAGE.
export type AccordDiatoniqueGamme = {
  // Ex: "Dm", "G", "F#dim" — Chord.get(...).symbol, même convention que
  // accordCompris ailleurs dans ce fichier.
  symbole: string;
  // Ex: "Ré mineur", "Sol majeur" — réutilise qualiteEnClair (voir plus
  // haut) via un appel interne à analyserAccord sur le symbole généré,
  // plutôt que de dupliquer la traduction FR une 2e fois dans ce fichier.
  qualiteEnClair: string;
  // Les 3 notes de la triade, SANS octave (ex: ["D", "F", "A"]) — à réduire
  // en chroma par l'appelant pour comparer avec des touches jouées à
  // N'IMPORTE QUELLE octave (même technique déjà établie dans ce fichier,
  // voir Note.chroma dans analyserAccord).
  classesDeNotes: [string, string, string];
  // Qualité de BASE (déjà calculée en interne pour construire le symbole,
  // voir triadSuffixFromNotes/QUALITY_BY_SUFFIX plus bas) — exposée pour
  // permettre à un appelant de FILTRER par qualité (ex: l'exercice
  // "Reproduis l'accord", filtre "Majeurs/Mineurs/Diminués seulement")
  // sans avoir à re-dériver la théorie musicale une 2e fois.
  qualite: 'Major' | 'Minor' | 'Diminished' | 'Augmented';
};

// Détermine le suffixe d'une triade (''/'m'/'dim'/'aug') à partir des
// DEMI-TONS RÉELS entre ses 3 notes (root→third, root→fifth), PAS d'une
// table de qualité par degré : contrairement à DIATONIC_QUALITY_MAJOR
// (majeur seulement, voir son commentaire sur pourquoi le mineur n'a pas
// d'équivalent dans ce fichier), cette approche fonctionne pour N'IMPORTE
// QUELLE gamme à 7 notes (majeure ET mineure naturelle) sans avoir besoin
// d'une 2e table : la qualité vient directement des notes de LA gamme
// donnée, jamais d'une hypothèse sur son mode.
function triadSuffixFromNotes(root: string, third: string, fifth: string): string {
  const thirdSemitones = (Note.chroma(third) - Note.chroma(root) + 12) % 12;
  const fifthSemitones = (Note.chroma(fifth) - Note.chroma(root) + 12) % 12;

  if (fifthSemitones === 6) return 'dim';
  if (fifthSemitones === 8) return 'aug';
  return thirdSemitones === 3 ? 'm' : '';
}

// Miroir de triadSuffixFromNotes, en qualité tonal (Major/Minor/Diminished/
// Augmented) plutôt qu'en suffixe de symbole — même correspondance,
// exposée séparément pour AccordDiatoniqueGamme.qualite (voir plus bas).
const QUALITY_BY_SUFFIX: Record<string, AccordDiatoniqueGamme['qualite']> = {
  '': 'Major',
  m: 'Minor',
  dim: 'Diminished',
  aug: 'Augmented',
};

// Génère les 7 triades diatoniques (empilées en tierces SUR LES NOTES DE LA
// GAMME elle-même, voir triadSuffixFromNotes) de la tonalité donnée — dans
// l'ordre des degrés (I à VII). Jamais d'exception, même contrat que le
// reste du fichier : une tonalité malformée (non reconnue par Scale.get)
// renvoie un tableau vide plutôt que de planter — ne devrait pas arriver en
// pratique (les appelants construisent "tonalite" à partir d'une liste
// fermée de toniques/modes), mais reste dans l'esprit du fichier.
export function genererAccordsDiatoniques(tonalite: string): AccordDiatoniqueGamme[] {
  const scaleNotes = Scale.get(tonalite).notes;
  if (scaleNotes.length !== 7) {
    return [];
  }

  return scaleNotes.map((root, index) => {
    const third = scaleNotes[(index + 2) % 7];
    const fifth = scaleNotes[(index + 4) % 7];
    const suffix = triadSuffixFromNotes(root, third, fifth);
    const symbole = Chord.get(`${root}${suffix}`).symbol;
    const analyse = analyserAccord(symbole, tonalite);

    return {
      symbole,
      // "?? symbole" : filet théorique seulement — un accord fraîchement
      // généré à partir de CETTE MÊME tonalité est TOUJOURS 'reconnu' par
      // analyserAccord (même Scale.get, même chroma), qualiteEnClair n'y
      // est donc jamais null en pratique.
      qualiteEnClair: analyse.qualiteEnClair ?? symbole,
      classesDeNotes: [root, third, fifth],
      qualite: QUALITY_BY_SUFFIX[suffix],
    };
  });
}
