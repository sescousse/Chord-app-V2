// Liste de TOUTES les quêtes possibles — une seule source de vérité, vivant
// dans le code (pas dans Supabase : seul le TIRAGE quotidien par utilisateur
// est stocké en base, voir la table "quetes_utilisateur" et src/lib/quetes.ts).
// Même principe que SUCCES (dataset/succes.ts) : ajouter une quête = ajouter
// une entrée ici, rien d'autre à toucher pour qu'elle entre dans le tirage.

// Genre de mesure que représente une quête — dit QUELLE action de l'app doit
// faire avancer sa progression. Branché : voir avancerQuete (context/
// QuetesContext.tsx) et ses appelants (LessonCourseScreen.tsx,
// improResult.tsx, creation.tsx, UserProfileScreen.tsx, PianoChord.tsx).
export type QueteType =
  | 'xp_jour'
  | 'lecons_jour'
  | 'exercices_jour'
  | 'progressions_jour'
  | 'suivis_jour'
  | 'accords_ecoutes';

export interface Quete {
  // Identifiant STABLE (ne jamais changer un id existant : c'est lui qui est
  // stocké dans quetes_utilisateur.quete_id côté Supabase — le renommer
  // casserait le lien avec les quêtes déjà tirées pour des utilisateurs, et
  // ferait planter la fusion avec cette liste, voir lib/quetes.ts).
  id: string;
  enonce: string;
  type: QueteType;
  objectif: number;
  // Récompense en XP donnée UNE SEULE FOIS quand la quête passe à "complete"
  // (voir avancerQuete, QuetesContext.tsx) —10 par défaut, un peu plus pour
  // les objectifs plus exigeants de chaque paire. PAS de monnaie/coffre réel
  // à cette étape (placeholder visuel uniquement, voir QuetesScreen.tsx).
  // TODO: récompense en monnaie/coffre quand la boutique existera.
  recompense_xp: number;
}

export const QUETES: Quete[] = [
  { id: 'xp_20', enonce: 'Gagne 20 XP', type: 'xp_jour', objectif: 20, recompense_xp: 10 },
  { id: 'xp_50', enonce: 'Gagne 50 XP', type: 'xp_jour', objectif: 50, recompense_xp: 15 },
  { id: 'lecons_1', enonce: 'Fais 1 leçon', type: 'lecons_jour', objectif: 1, recompense_xp: 10 },
  { id: 'lecons_3', enonce: 'Fais 3 leçons', type: 'lecons_jour', objectif: 3, recompense_xp: 15 },
  { id: 'exercices_1', enonce: 'Termine 1 exercice', type: 'exercices_jour', objectif: 1, recompense_xp: 10 },
  { id: 'exercices_3', enonce: 'Termine 3 exercices', type: 'exercices_jour', objectif: 3, recompense_xp: 15 },
  { id: 'progressions_1', enonce: 'Crée 1 progression', type: 'progressions_jour', objectif: 1, recompense_xp: 15 },
  { id: 'suivis_1', enonce: 'Suis 1 personne', type: 'suivis_jour', objectif: 1, recompense_xp: 10 },
  { id: 'accords_5', enonce: 'Écoute 5 accords', type: 'accords_ecoutes', objectif: 5, recompense_xp: 10 },
];
