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
};

// Une étape du parcours : soit une leçon normale, soit le Boss de l'unité.
// Le Boss réutilise aussi "lesson" (avec un seul bloc, son texte de défi) :
// ça évite d'ajouter un champ séparé pour un texte qui, structurellement,
// est déjà exactement ce qu'un LessonBlock représente (icône + titre +
// texte). CourseParcoursScreen affiche ce bloc dans une alerte pour le Boss,
// au lieu de naviguer vers LessonScreen comme pour les leçons normales.
export type Step = {
  id: string;
  kind: 'lesson' | 'boss';
  title: string;
  lesson?: Lesson;
};

// Titre de l'unité, utilisé comme en-tête de page par CourseParcoursScreen.
export const UNIT_1_TITLE = 'Unité 1 — Les intervalles';

const LESSON_1_1: Lesson = {
  id: 'lesson-1-1',
  title: 'Deux notes, une émotion',
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
