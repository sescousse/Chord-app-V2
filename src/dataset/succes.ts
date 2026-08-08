// Liste de TOUS les succès de l'app — une seule source de vérité, ajoutée
// dans le code (pas dans Supabase : seul leur DÉBLOCAGE par utilisateur vit
// en base, voir la table "succes_debloques"). Ajouter un succès = ajouter
// une entrée ici ; le brancher (appeler debloquerSucces(son id) au bon
// moment quelque part dans l'app) reste un geste séparé — un succès listé
// ici mais jamais branché reste simplement toujours verrouillé, sans casser
// quoi que ce soit (voir ProfileScreen.tsx, qui affiche TOUTE cette liste).
export interface Succes {
  // Identifiant STABLE (ne jamais changer un id existant : c'est lui qui
  // est stocké dans succes_debloques.succes_id côté Supabase — le renommer
  // "déverrouillerait" un nouveau succès vide pour tout le monde et
  // rendrait les anciens déblocages orphelins).
  id: string;
  titre: string;
  description: string;
  // Récompense en XP, PROPRE à chaque succès (pas une constante globale
  // comme XP_COURS/XP_EXERCICE dans xpRewards.ts) : chaque succès peut avoir
  // un montant différent.
  recompense_xp: number;
  // TODO: illustration du badge — emoji en attendant (même convention que
  // partout ailleurs dans l'app pour ce même besoin : @expo/vector-icons
  // n'est utilisé que pour la barre d'onglets, tout le reste retombe sur
  // des emoji).
  icone: string;
}

export const SUCCES: Succes[] = [
  // --- BRANCHÉS (voir la consigne) ---------------------------------------
  {
    id: 'premiere_lecon',
    titre: 'Première leçon',
    description: 'Termine ta première leçon de cours.',
    recompense_xp: 50,
    icone: '🎉',
  },
  {
    id: 'compositeur_ne',
    titre: 'Compositeur né',
    description: 'Enregistre ta première progression dans "Crée ta progression".',
    recompense_xp: 50,
    icone: '🎼',
  },

  {
    id: '7_jours',
    titre: '7 jours de suite',
    description: "Sois actif 7 jours d'affilée.",
    recompense_xp: 100,
    icone: '🔥',
  },
  {
    id: '30_jours',
    titre: '30 jours de suite',
    description: "Sois actif 30 jours d'affilée.",
    recompense_xp: 300,
    icone: '🏆',
  },
  {
    id: 'improvisateur_novice',
    titre: 'Improvisateur novice',
    description: "Termine ton premier exercice d'improvisation libre.",
    recompense_xp: 50,
    icone: '🎹',
  },

  // --- PRÉVU, PAS ENCORE BRANCHÉ ------------------------------------------
  // "Maître de la théorie" dépend de savoir si l'utilisateur a terminé TOUT
  // le parcours de cours — ça suppose un système de progression des cours
  // (quelles leçons sont lues/terminées) qui n'existe pas encore. Reste
  // défini (verrouillé pour tout le monde) en attendant.
  {
    id: 'maitre_theorie',
    titre: 'Maître de la théorie',
    description: 'Termine tout le parcours de théorie.',
    recompense_xp: 200,
    icone: '📚',
  },
];
