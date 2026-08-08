// Montants d'XP attribués aux actions de base de l'app — un seul endroit à
// modifier pour ajuster l'un ou l'autre. Montants provisoires, à différencier
// par exercice/leçon plus tard (barème fixe pour cette première version, pas
// encore de pondération par difficulté/longueur).
export const XP_EXERCICE = 30; // fin d'un exercice — voir improResult.tsx
export const XP_COURS = 20; // fin d'une leçon de cours — voir LessonCourseScreen.tsx
export const XP_PROGRESSION = 30; // "Enregistrer" une progression créée — voir creation.tsx

// Durée d'affichage du petit feedback "+N XP" (improResult.tsx,
// LessonCourseScreen.tsx et creation.tsx) avant qu'il disparaisse tout seul.
export const XP_FEEDBACK_DURATION_MS = 1500;
