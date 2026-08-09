// Liste des quêtes MENSUELLES possibles — même principe que dataset/quetes.ts
// (une seule source de vérité dans le code, pas en base : seule la ligne PAR
// UTILISATEUR ET PAR MOIS vit dans "quete_mois_utilisateur", voir
// lib/quetesMois.ts).
//
// UNE SEULE quête pour l'instant ('accomplir_30_quetes') : pas de tirage
// aléatoire mensuel à cette étape (voir chargerOuCreerQueteMois,
// lib/quetesMois.ts, qui prend directement QUETES_MOIS[0]) — ce reste
// malgré tout un TABLEAU (pas un objet unique) pour pouvoir en ajouter
// plusieurs plus tard sans revoir la forme des données, seulement le
// tirage lui-même (comme QUETES pour les quêtes du jour).
export interface QueteMois {
  // Identifiant STABLE (ne jamais changer un id existant) : stocké dans
  // quete_mois_utilisateur.quete_id côté Supabase, même raison que
  // Quete.id dans dataset/quetes.ts.
  id: string;
  enonce: string;
  objectif: number;
  // Récompense en XP donnée UNE SEULE FOIS quand la quête passe à
  // "complete" (voir avancerQueteMois, QuetesContext.tsx). PAS de
  // monnaie/coffre réel à cette étape (placeholder visuel uniquement, comme
  // les quêtes du jour) — TODO: récompense en monnaie/coffre quand la
  // boutique existera.
  recompense_xp: number;
}

export const QUETES_MOIS: QueteMois[] = [
  {
    id: 'accomplir_30_quetes',
    enonce: 'Accomplis 30 quêtes',
    objectif: 30,
    recompense_xp: 100,
  },
];
