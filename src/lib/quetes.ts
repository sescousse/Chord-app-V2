// QUÊTES DU JOUR — table Supabase "quetes_utilisateur" (id, utilisateur uuid
// ref auth.users on delete cascade, date_jour date, quete_id text,
// progression integer default 0, complete bool default false, unique
// (utilisateur, date_jour, quete_id) — RLS : lecture/écriture limitées à
// auth.uid() = utilisateur, voir le SQL fourni à part). Module dédié pour les
// requêtes Supabase (pas un contexte React, voir lib/follows.ts pour ce même
// principe) : c'est QuetesContext.tsx (le seul appelant) qui tient l'état
// React et orchestre la récompense — ce fichier ne fait que lire/écrire la
// table et fusionner avec le dataset.

import { supabase } from './supabase';
import { formatDateLocale } from './streak';
import { QUETES, type Quete, type QueteType } from '../dataset/quetes';

// Forme d'une ligne de "quetes_utilisateur" telle que renvoyée par Supabase.
interface QueteUtilisateurRow {
  id: string;
  utilisateur: string;
  date_jour: string;
  quete_id: string;
  progression: number;
  complete: boolean;
}

// Une quête du jour, prête à être affichée : la donnée STATIQUE (énoncé,
// objectif, récompense — depuis dataset/quetes.ts) fusionnée avec l'état
// PROPRE à l'utilisateur (progression, complete — depuis Supabase). "rowId"
// (l'id de LA LIGNE Supabase, pas celui de la quête dans le dataset) est ce
// qui permet à avancerQuetesEnBase de cibler précisément quelle ligne
// mettre à jour, sans avoir à la re-rechercher par (utilisateur, date_jour,
// quete_id).
export type QueteDuJour = Quete & {
  rowId: string;
  progression: number;
  complete: boolean;
};

// Combien de quêtes tirées par jour.
const NOMBRE_QUETES_PAR_JOUR = 3;

// TIRAGE AU HASARD — Fisher-Yates partiel sur une COPIE de la liste (jamais
// l'original) : mélange puis garde les "nombre" premiers éléments, donc
// jamais deux fois la même quête dans un même tirage. Fonction PURE (aucun
// Supabase ici) : testable seule, indépendamment du chargement réseau plus bas.
export function tirerQuetesAuHasard(quetes: Quete[], nombre: number): Quete[] {
  const copie = [...quetes];
  for (let i = copie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie.slice(0, nombre);
}

// Associe chaque ligne Supabase à sa quête statique (dataset/quetes.ts) via
// quete_id. Une ligne dont l'id ne correspond à AUCUNE quête du dataset est
// silencieusement écartée (ne peut arriver que si une quête a été retirée du
// dataset après avoir déjà été tirée pour quelqu'un) plutôt que de planter
// l'affichage pour une seule ligne orpheline.
function fusionnerAvecDataset(rows: QueteUtilisateurRow[]): QueteDuJour[] {
  return rows
    .map((row) => {
      const quete = QUETES.find((item) => item.id === row.quete_id);
      if (!quete) return null;
      return { ...quete, rowId: row.id, progression: row.progression, complete: row.complete };
    })
    .filter((item): item is QueteDuJour => item !== null);
}

type QuetesDuJourResult = { quetes: QueteDuJour[] | null; error: string | null };

// CHARGE LES QUÊTES DU JOUR de "userId", en les TIRANT si besoin :
//
// 1) SELECT des lignes déjà enregistrées pour la date locale d'AUJOURD'HUI
//    (voir formatDateLocale, lib/streak.ts — même piège UTC à éviter qu'un
//    "jour" côté streak : comparer des dates locales, jamais un horodatage).
//    Si des lignes existent déjà, elles sont FIGÉES pour la journée : on les
//    affiche telles quelles, jamais un nouveau tirage tant qu'on est le même
//    jour, même si l'écran est rouvert plusieurs fois.
//
// 2) Aucune ligne pour aujourd'hui (nouveau jour, ou tout premier lancement)
//    → tirage de NOMBRE_QUETES_PAR_JOUR quêtes au hasard parmi le dataset
//    complet, INSERT immédiat en base (progression: 0, complete: false) pour
//    les figer, puis affichage. Le lendemain, une nouvelle date_jour locale
//    fait à nouveau échouer l'étape 1 ci-dessus (aucune ligne pour LA
//    NOUVELLE date) → nouveau tirage automatique, sans purge des anciennes
//    lignes (elles restent en base comme historique, non lues par cet écran).
//
// LIMITE CONNUE (même famille que addXp dans ProfileContext.tsx) : ce n'est
// PAS atomique côté serveur — si le même utilisateur ouvrait l'app sur 2
// appareils exactement au même instant un jour encore vierge, les 2
// pourraient chacun ne rien trouver à l'étape 1 et tirer/insérer LEUR propre
// lot de 3 quêtes (jusqu'à 6 lignes ce jour-là au lieu de 3). Cas très rare,
// sans conséquence grave (pas de perte de données) ; une vraie garantie
// nécessiterait une fonction SQL (RPC) faisant tirage+insert atomiquement
// côté serveur — hors périmètre de cette étape.
export async function chargerOuTirerQuetesDuJour(userId: string): Promise<QuetesDuJourResult> {
  const aujourdHui = formatDateLocale(new Date());

  const { data: existantes, error: selectError } = await supabase
    .from('quetes_utilisateur')
    .select('*')
    .eq('utilisateur', userId)
    .eq('date_jour', aujourdHui)
    .order('quete_id', { ascending: true });

  if (selectError) {
    return { quetes: null, error: selectError.message };
  }

  const lignesExistantes = existantes as QueteUtilisateurRow[];
  if (lignesExistantes.length > 0) {
    return { quetes: fusionnerAvecDataset(lignesExistantes), error: null };
  }

  const tirage = tirerQuetesAuHasard(QUETES, NOMBRE_QUETES_PAR_JOUR);

  const { data: inserees, error: insertError } = await supabase
    .from('quetes_utilisateur')
    .insert(
      tirage.map((quete) => ({
        utilisateur: userId,
        date_jour: aujourdHui,
        quete_id: quete.id,
        progression: 0,
        complete: false,
      })),
    )
    .select();

  if (insertError) {
    return { quetes: null, error: insertError.message };
  }

  return { quetes: fusionnerAvecDataset(inserees as QueteUtilisateurRow[]), error: null };
}

type QueteAvancementResult = {
  // Quêtes dont la progression a réellement changé (nouvelle progression/
  // complete déjà écrites en base) — à la fois ce qu'il faut fusionner dans
  // l'état React affiché ET ce qui dit à l'appelant lesquelles viennent de
  // passer à "complete" (pour la récompense, voir QuetesContext.tsx).
  // Tableau VIDE (pas une erreur) si aucune quête active de ce type
  // aujourd'hui — cas normal, la plupart des types n'ont pas été tirés.
  quetesMisesAJour: QueteDuJour[];
  error: string | null;
};

// FAIT AVANCER, EN BASE, les quêtes du jour déjà chargées (quetesDuJour) qui
// sont du "type" demandé — appelée par QuetesContext.avancerQuete, qui tient
// l'état React et la récompense ; ce module-ci ne fait que le calcul +
// l'écriture Supabase.
//
// SOURCE DES QUÊTES "ACTIVES" : la liste déjà EN MÉMOIRE (quetesDuJour,
// chargée une fois par chargerOuTirerQuetesDuJour), PAS une nouvelle lecture
// Supabase — ces 3 quêtes sont figées pour la journée (voir plus haut), donc
// ce qui est déjà chargé reste la vérité pour toute la session. Limite
// connue : si cette fonction est appelée AVANT la fin du tout premier
// chargement du jour (quetesDuJour encore vide), aucune quête ne progresse
// pour cet appel — cas transitoire très bref au lancement de l'app, jamais
// après.
//
// ANTI-DOUBLON : seules les quêtes de ce type PAS ENCORE "complete" sont
// concernées (.filter ci-dessous) — une quête déjà complète ne progresse
// plus JAMAIS, quel que soit le nombre de fois où son type est ré-avancé, et
// ne peut donc jamais redonner sa récompense XP une 2e fois (voir
// QuetesContext.tsx, qui ne redonne addXp QUE pour les quêtes renvoyées ici).
export async function avancerQuetesEnBase(
  quetesDuJour: QueteDuJour[],
  type: QueteType,
  montant: number,
): Promise<QueteAvancementResult> {
  const quetesActives = quetesDuJour.filter((quete) => quete.type === type && !quete.complete);
  if (quetesActives.length === 0) {
    return { quetesMisesAJour: [], error: null };
  }

  const quetesMisesAJour: QueteDuJour[] = [];

  // Séquentiel (pas Promise.all) : simple et suffisant pour au plus 2-3
  // quêtes du même type tirées le même jour (voir NOMBRE_QUETES_PAR_JOUR) —
  // pas la peine de paralléliser quelques UPDATE ciblés par id.
  for (const quete of quetesActives) {
    // PLAFONNÉE à l'objectif : "montant" peut dépasser ce qu'il reste à
    // faire (ex: gagner 30 XP d'un coup sur une quête "Gagne 20 XP" déjà à
    // 10/20) — la progression ne dépasse jamais l'objectif affiché.
    const nouvelleProgression = Math.min(quete.objectif, quete.progression + montant);
    const nouvelleComplete = nouvelleProgression >= quete.objectif;

    const { error } = await supabase
      .from('quetes_utilisateur')
      .update({ progression: nouvelleProgression, complete: nouvelleComplete })
      .eq('id', quete.rowId);

    if (error) {
      // Erreur en cours de route : on renvoie ce qui a DÉJÀ été écrit avec
      // succès (quetesMisesAJour jusqu'ici) plutôt que de tout perdre —
      // l'appelant fusionne quand même ce résultat partiel dans l'affichage.
      return { quetesMisesAJour, error: error.message };
    }

    quetesMisesAJour.push({ ...quete, progression: nouvelleProgression, complete: nouvelleComplete });
  }

  return { quetesMisesAJour, error: null };
}
