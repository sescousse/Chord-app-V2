// Données du cours de théorie — Unité 1 (Les intervalles).
//
// ⚠️ CONTENU PROVISOIRE : tous les "text" ci-dessous sont des TODO à
// remplacer par le contenu pédagogique réel (voir chaque "TODO:"). Rien
// n'est inventé comme contenu final, seule la STRUCTURE (titres de leçon,
// titres de bloc, ordre) reprend fidèlement ce qui a été demandé.

// Un bloc de contenu à l'intérieur d'une leçon (ex: "💡 Le déclic").
// "icon" est un emoji affiché devant "heading".
export type LessonBlock = {
  icon: string;
  heading: string;
  text: string;
};

export type Lesson = {
  id: string;
  title: string;
  blocks: LessonBlock[];
  // Version "slides" de la leçon (une notion par page, façon Duolingo),
  // affichée par LessonCourseScreen. Optionnel : seule LESSON_1_1 est
  // convertie à ce format pour l'instant. Les leçons qui n'ont pas encore de
  // "pages" retombent sur leurs "blocks" (un LessonBlock est déjà
  // structurellement un CoursePage — même "icon/heading/text" — donc
  // affichable tel quel, une page par bloc).
  pages?: CoursePage[];
};

// Composant interactif optionnel qu'une page peut demander (voir
// CoursePage.interactive et LessonCourseScreen, qui l'affiche SOUS le texte
// de la page). Union plutôt qu'un simple "string" : pour en ajouter un autre
// plus tard (ex: 'metronome'), il suffit d'étendre cette union — TypeScript
// signale alors tout endroit qui doit gérer le nouveau cas. Pour l'instant,
// seul 'piano' existe (InteractivePiano, un clavier cliquable).
export type CourseInteractive = 'piano';

// Une page de "slide" : une seule notion (icône + titre + texte court),
// affichée seule à l'écran par LessonCourseScreen. "icon" est optionnel (une
// page peut n'avoir que du texte). "interactive" est optionnel aussi : une
// page sans ce champ s'affiche comme avant (texte seul) ; LessonCourseScreen
// n'affiche le composant correspondant que si ce champ est présent.
export type CoursePage = {
  icon?: string;
  heading: string;
  text: string;
  interactive?: CourseInteractive;
};

// Une étape du parcours : soit une leçon normale, soit le Boss de l'unité.
// Le Boss réutilise aussi "lesson" (avec un seul bloc, son texte de défi) :
// ça évite d'ajouter un champ séparé pour un texte qui, structurellement,
// est déjà exactement ce qu'un LessonBlock représente (icône + titre +
// texte). CourseParcoursScreen affiche ce bloc dans une alerte pour le Boss,
// au lieu de naviguer vers LessonCourseScreen comme pour les leçons normales.
export type Step = {
  id: string;
  kind: 'lesson' | 'boss';
  title: string;
  lesson?: Lesson;
  // Verrouillage VISUEL uniquement (pas de vraie logique de déblocage pour
  // l'instant : aucune étape ne se déverrouille jamais toute seule). Valeur
  // statique posée à la main sur chaque Step de UNIT_2 (voir plus bas).
  // Absent (undefined) équivaut à false : les étapes de UNIT_1, qui ne
  // définissent pas ce champ, restent cliquables comme avant.
  locked?: boolean;
};

// Titre de l'unité, utilisé comme en-tête de page par CourseParcoursScreen.
export const UNIT_1_TITLE = 'Unité 1 — Les intervalles';

// Idem pour l'Unité 2, affichée à la suite de l'Unité 1 (verrouillée pour
// l'instant — voir UNIT_2 plus bas).
export const UNIT_2_TITLE = 'Unité 2 — Les accords : empiler les couleurs';

const LESSON_1_1: Lesson = {
  id: 'lesson-1-1',
  title: 'Deux notes, une émotion',
  // "blocks" garde la structure d'origine (une entrée par notion, comme les
  // autres leçons) ; "pages" ci-dessous est la version réellement affichée
  // par LessonCourseScreen, avec les textes courts définitifs.
  blocks: [
    {
      icon: '💡',
      heading: 'Le déclic',
      text: 'TODO: texte réel de la leçon 1.1, bloc "Le déclic".',
    },
    {
      icon: '👂',
      heading: 'On entend',
      text: 'TODO: texte réel de la leçon 1.1, bloc "On entend".',
    },
    {
      icon: '🧩',
      heading: 'On comprend',
      text: 'TODO: texte réel de la leçon 1.1, bloc "On comprend".',
    },
    {
      icon: '🎯',
      heading: 'À toi de jouer',
      text: 'TODO: texte réel de la leçon 1.1, bloc "À toi de jouer".',
    },
  ],
  pages: [
    {
      icon: '💡',
      heading: 'Le déclic',
      text: 'Deux notes suffisent pour créer une émotion. Joue deux touches très proches : ça gratte, ça inquiète. Joue-les éloignées : ça respire. La musique commence ici.',
      // Clavier cliquable sous le texte, pour que l'utilisateur teste
      // lui-même la notion d'intervalle sur cette page (voir InteractivePiano
      // et LessonCourseScreen).
      interactive: 'piano',
    },
    {
      icon: '👂',
      heading: 'On entend',
      text: "L'app joue deux notes collées (un demi-ton), puis deux notes espacées (une quinte). Question : « laquelle te met mal à l'aise ? »",
    },
    {
      icon: '🧩',
      heading: 'On comprend',
      text: "Un intervalle, c'est la distance entre deux notes. On la mesure en demi-tons (la plus petite distance au piano : deux touches voisines). Plus les notes sont proches, plus il y a de tension ; plus elles sont espacées, plus c'est ouvert et stable.",
    },
    {
      icon: '🎯',
      heading: 'À toi de jouer',
      text: "Joue n'importe quelle note, puis sa voisine immédiate (1 demi-ton). Puis la même note + une touche 7 demi-tons plus haut. Réussite : tu joues les deux intervalles et tu dis lequel est « tendu ».",
    },
  ],
};

const LESSON_1_2: Lesson = {
  id: 'lesson-1-2',
  title: 'La galerie des intervalles',
  blocks: [
    {
      icon: '🧩',
      heading: 'On comprend',
      // TODO: la table des intervalles doit être saisie ici, en texte
      // lisible (ex: une ligne par intervalle : nom, nombre de demi-tons,
      // exemple). Le reste du bloc reprend une mise en page en texte brut,
      // pas de tableau JSX séparé — voir la consigne d'origine.
      text: 'TODO: texte réel de la leçon 1.2, bloc "On comprend" (y compris la table des intervalles en texte lisible).',
    },
    {
      icon: '🧠',
      heading: 'Pour aller plus loin',
      text: 'TODO: texte réel de la leçon 1.2, bloc "Pour aller plus loin".',
    },
    {
      icon: '🎯',
      heading: 'À toi de jouer',
      text: 'TODO: texte réel de la leçon 1.2, bloc "À toi de jouer".',
    },
  ],
};

const LESSON_1_3: Lesson = {
  id: 'lesson-1-3',
  title: 'Improviser avec deux notes',
  blocks: [
    {
      icon: '💡',
      heading: 'Le déclic',
      text: 'TODO: texte réel de la leçon 1.3, bloc "Le déclic".',
    },
    {
      icon: '🎯',
      heading: 'À toi de jouer',
      text: 'TODO: texte réel de la leçon 1.3, bloc "À toi de jouer".',
    },
  ],
};

// Le Boss n'a qu'un seul bloc : son court texte de défi.
const BOSS_UNIT_1: Lesson = {
  id: 'boss-unit-1',
  title: 'Boss de l’Unité 1',
  blocks: [
    {
      icon: '⭐',
      heading: 'Défi',
      text: 'TODO: court texte de défi réel du Boss de l’Unité 1.',
    },
  ],
};

// Le parcours de l'Unité 1 : les 3 leçons puis le Boss, dans l'ordre
// d'affichage. Ajouter une étape = ajouter une entrée ici (dans l'ordre
// voulu) ; CourseParcoursScreen se contente de .map() ce tableau.
export const UNIT_1: Step[] = [
  { id: LESSON_1_1.id, kind: 'lesson', title: LESSON_1_1.title, lesson: LESSON_1_1 },
  { id: LESSON_1_2.id, kind: 'lesson', title: LESSON_1_2.title, lesson: LESSON_1_2 },
  { id: LESSON_1_3.id, kind: 'lesson', title: LESSON_1_3.title, lesson: LESSON_1_3 },
  { id: BOSS_UNIT_1.id, kind: 'boss', title: BOSS_UNIT_1.title, lesson: BOSS_UNIT_1 },
];

// --- Unité 2 — Les accords : empiler les couleurs -------------------------
//
// Contrairement aux leçons TODO de l'Unité 1 (1.2, 1.3, son Boss), le
// contenu ci-dessous est le texte RÉEL fourni pour l'Unité 2 : pas de champ
// "pages" séparé ici (contrairement à LESSON_1_1, où "pages" coexiste avec
// des "blocks" TODO qu'on ne voulait pas toucher) — "blocks" contient
// directement le contenu définitif, un bloc par page (LessonCourseScreen
// affiche déjà chaque bloc comme une page via son repli "lesson.pages ??
// lesson.blocks", voir son commentaire).
//
// Les pages "On entend"/"À toi de jouer" mentionnant que "l'app joue" un son
// ou propose un "quiz" gardent ce texte tel quel (même choix que pour la
// page "On entend" de LESSON_1_1) : c'est une consigne écrite, il n'y a
// aucune fonctionnalité audio/quiz/détection branchée derrière.
const LESSON_2_1: Lesson = {
  id: 'lesson-2-1',
  title: 'La triade : trois notes qui font un monde',
  blocks: [
    {
      icon: '👂',
      heading: 'On entend',
      text: "L'app joue un accord majeur puis le même en mineur. « Lequel sourit ? »",
    },
    {
      icon: '🧩',
      heading: 'On comprend',
      text: 'Une triade = 3 notes empilées en tierces. On part d\'une note (la fondamentale), on monte d\'une tierce, puis encore d\'une tierce.\n\nMajeur (joyeux) : tierce majeure + tierce mineure → Do–Mi–Sol\nMineur (triste) : tierce mineure + tierce majeure → Do–Mi♭–Sol\n\nLa seule note qui change entre les deux, c\'est la tierce (le milieu). C\'est elle qui décide de l\'humeur. Repère puissant : la tierce est le « visage » de l\'accord.',
    },
    {
      icon: '🎯',
      heading: 'À toi de jouer',
      text: "Joue Do–Mi–Sol, puis abaisse juste le Mi d'un demi-ton (Mi♭). Tu fais passer l'accord de la joie à la mélancolie en bougeant un seul doigt. Compétence : Harmonie.",
    },
  ],
};

const LESSON_2_2: Lesson = {
  id: 'lesson-2-2',
  title: 'Les deux triades « épicées »',
  blocks: [
    {
      icon: '🧩',
      heading: 'On comprend',
      text: 'Deux autres triades, plus rares mais utiles pour la tension :\n\nDiminué (anxieux, instable) : deux tierces mineures → Do–Mi♭–Sol♭. Il contient un triton.\nAugmenté (mystérieux, suspendu) : deux tierces majeures → Do–Mi–Sol♯.',
    },
    {
      icon: '🧠',
      heading: 'Pour aller plus loin',
      text: "L'accord diminué est symétrique (mêmes intervalles partout), ce qui le rend « flottant » : l'oreille ne sait pas où est la maison. C'est exactement pour ça qu'on l'utilise comme accord de passage ou de tension — il veut bouger ailleurs. Même logique pour l'augmenté. Pas besoin de les maîtriser maintenant ; sache juste qu'ils servent à créer de l'attente.",
    },
    {
      icon: '🎯',
      heading: 'À toi de jouer',
      text: "Quiz — l'app joue les 4 triades, associe chacune à une émotion. Compétence : Oreille + Harmonie.",
    },
  ],
};

const LESSON_2_3: Lesson = {
  id: 'lesson-2-3',
  title: 'Les renversements : la même couleur, autrement',
  blocks: [
    {
      icon: '💡',
      heading: 'Le déclic',
      text: "Tu n'es pas obligé de toujours jouer Do–Mi–Sol dans cet ordre. Tu peux « rouler » les notes.",
    },
    {
      icon: '🧩',
      heading: 'On comprend',
      text: "Un renversement, c'est le même accord avec une autre note en bas. Do–Mi–Sol devient Mi–Sol–Do (1er renversement) ou Sol–Do–Mi (2e). Même accord, mais la main bouge moins entre deux accords (conduite des voix) et le son est plus fluide.",
    },
    {
      icon: '🎯',
      heading: 'À toi de jouer',
      text: 'Enchaîne Do et Sol majeur en position fermée, puis recommence en utilisant des renversements pour que ta main bouge le moins possible. Compétence : Harmonie + Main gauche.',
    },
  ],
};

const LESSON_2_4: Lesson = {
  id: 'lesson-2-4',
  title: 'Les accords de septième (la porte du jazz)',
  blocks: [
    {
      icon: '👂',
      heading: 'On entend',
      text: "L'app joue Do majeur, puis Do maj7 (Do–Mi–Sol–Si). « Lequel sonne plus riche, plus doux ? »",
    },
    {
      icon: '🧩',
      heading: 'On comprend',
      // Table d'origine reprise en texte lisible (une ligne par accord :
      // nom, recette depuis Do, ambiance), plutôt qu'un tableau JSX séparé —
      // même choix que celui déjà noté pour la table d'intervalles de
      // LESSON_1_2.
      text: 'On ajoute une 4e note, une tierce au-dessus. On obtient 5 familles essentielles :\n\nMajeur 7 (maj7) : Do–Mi–Sol–Si — doux, rêveur, « café jazz »\nMineur 7 (m7) : Do–Mi♭–Sol–Si♭ — cool, posé, soul\nDominante 7 (7) : Do–Mi–Sol–Si♭ — tendu, « ça veut bouger »\nMineur 7 ♭5 (m7♭5) : Do–Mi♭–Sol♭–Si♭ — sombre, mélancolique\nDiminué 7 (dim7) : Do–Mi♭–Sol♭–La — très tendu, dramatique',
    },
    {
      icon: '🧠',
      heading: 'Pour aller plus loin',
      text: "L'accord de dominante 7 est le plus important de toute la musique tonale. Pourquoi ? Parce qu'il contient un triton (te rappelles-tu de l'Unité 1 ?) entre sa tierce et sa septième. Ce triton « gratte » et veut se résoudre — il pousse vers un autre accord. C'est ce moteur de tension → résolution qui fait avancer presque toutes les chansons. On l'explore en Unité 4.",
    },
    {
      icon: '🎯',
      heading: 'À toi de jouer',
      text: 'Joue les 5 accords de septième depuis Do, lentement. Puis improvise une ambiance « café » en alternant Do maj7 et La m7. Compétence : Harmonie + Expression.',
    },
  ],
};

// Le Boss n'a qu'un seul bloc : son court texte de défi (même format que
// BOSS_UNIT_1 — icône reprise du texte d'origine fourni, "🏆", plutôt que
// "⭐" comme pour le Boss de l'Unité 1).
const BOSS_UNIT_2: Lesson = {
  id: 'boss-unit-2',
  title: 'Boss de l’Unité 2',
  blocks: [
    {
      icon: '🏆',
      heading: 'Défi',
      text: 'Reconnais 4 accords sur 5 à l\'oreille (maj7 / m7 / 7 / dim). Construis n\'importe quel accord majeur et mineur à partir d\'une note imposée. Improvise 30 s sur Do maj7 ↔ La m7. Récompense : 70 XP + skin « touches dorées ».',
    },
  ],
};

// Le parcours de l'Unité 2 : mêmes 4 leçons + Boss que l'Unité 1
// (structurellement), mais TOUTES verrouillées (locked: true) — verrouillage
// purement visuel, voir le commentaire sur Step.locked. Aucune étape ne se
// déverrouille : c'est une valeur statique, pas le résultat d'une
// progression réelle.
export const UNIT_2: Step[] = [
  { id: LESSON_2_1.id, kind: 'lesson', title: LESSON_2_1.title, lesson: LESSON_2_1, locked: true },
  { id: LESSON_2_2.id, kind: 'lesson', title: LESSON_2_2.title, lesson: LESSON_2_2, locked: true },
  { id: LESSON_2_3.id, kind: 'lesson', title: LESSON_2_3.title, lesson: LESSON_2_3, locked: true },
  { id: LESSON_2_4.id, kind: 'lesson', title: LESSON_2_4.title, lesson: LESSON_2_4, locked: true },
  { id: BOSS_UNIT_2.id, kind: 'boss', title: BOSS_UNIT_2.title, lesson: BOSS_UNIT_2, locked: true },
];
