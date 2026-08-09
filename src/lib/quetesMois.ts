// QUÊTE DU MOIS — table Supabase "quete_mois_utilisateur" (id, utilisateur
// uuid ref auth.users on delete cascade, mois text "YYYY-MM", quete_id text,
// progression integer default 0, complete bool default false, unique
// (utilisateur, mois, quete_id) — RLS : lecture/écriture limitées à
// auth.uid() = utilisateur, voir le SQL fourni à part). Même principe que
// lib/quetes.ts (module dédié aux requêtes Supabase, pas un contexte React) :
// QuetesContext.tsx est le seul appelant, il tient l'état React et orchestre
// la récompense.

import { supabase } from './supabase';
import { formatDateLocale } from './streak';
import { QUETES_MOIS, type QueteMois } from '../dataset/quetesMois';

// Mois calendaire LOCAL, "YYYY-MM" — dérivé de formatDateLocale (même
// évitement du piège fuseau/UTC que pour les quêtes du jour, voir son
// commentaire dans lib/streak.ts) : on garde seulement les 7 premiers
// caractères de "YYYY-MM-DD" ("YYYY-MM"), pas de nouvelle logique de date à
// écrire ni à retester séparément.
function formatMoisLocale(date: Date): string {
  return formatDateLocale(date).slice(0, 7);
}

interface QueteMoisRow {
  id: string;
  utilisateur: string;
  mois: string;
  quete_id: string;
  progression: number;
  complete: boolean;
}

// La quête du mois, prête à être affichée : donnée STATIQUE (dataset/
// quetesMois.ts) fusionnée avec l'état PROPRE à l'utilisateur (progression,
// complete — Supabase). "rowId" cible précisément la ligne à mettre à jour,
// même rôle que QueteDuJour.rowId dans lib/quetes.ts.
export type QueteMoisAffichee = QueteMois & {
  rowId: string;
  progression: number;
  complete: boolean;
};

// Associe une ligne Supabase à sa quête statique via quete_id — null si
// aucune correspondance (ne peut arriver que si la quête a été retirée du
// dataset après avoir déjà été créée pour quelqu'un), même garde-fou que
// fusionnerAvecDataset dans lib/quetes.ts.
function fusionnerQueteMoisAvecDataset(row: QueteMoisRow): QueteMoisAffichee | null {
  const quete = QUETES_MOIS.find((item) => item.id === row.quete_id);
  if (!quete) return null;
  return { ...quete, rowId: row.id, progression: row.progression, complete: row.complete };
}

type QueteMoisResult = { quete: QueteMoisAffichee | null; error: string | null };

// CHARGE LA QUÊTE DU MOIS de "userId", en la CRÉANT si besoin :
//
// 1) SELECT de la ligne déjà enregistrée pour le MOIS CALENDAIRE LOCAL
//    courant (voir formatMoisLocale ci-dessus) — comparaison par MOIS, pas
//    par jour : tant qu'on reste dans le même mois calendaire, c'est
//    TOUJOURS la même ligne (et donc la même progression) qui est chargée,
//    quel que soit le nombre d'ouvertures de l'écran dans l'intervalle. Le
//    1er du mois suivant, formatMoisLocale() renvoie une valeur "YYYY-MM"
//    DIFFÉRENTE → cette étape ne trouve plus rien pour ce nouveau mois →
//    reset automatique via l'étape 2 ci-dessous, sans purge de l'ancienne
//    ligne (conservée en base comme historique, jamais relue par cet écran).
//    .maybeSingle() (pas .single()) : renvoie `null` (pas une erreur) quand
//    aucune ligne ne correspond encore — c'est précisément le cas "nouveau
//    mois" qui déclenche l'étape 2.
//
// 2) Aucune ligne pour ce mois → CRÉE la ligne avec la seule quête mensuelle
//    disponible pour l'instant (QUETES_MOIS[0] — voir son commentaire dans
//    dataset/quetesMois.ts : pas de tirage aléatoire tant qu'il n'y en a
//    qu'une), progression 0.
//
// LIMITE CONNUE (même famille que chargerOuTirerQuetesDuJour, lib/quetes.ts,
// et addXp dans ProfileContext.tsx) : pas atomique côté serveur — 2
// appareils ouvrant l'app EXACTEMENT au même instant un mois encore vierge
// pourraient chacun tenter leur propre INSERT ; la contrainte unique
// (utilisateur, mois, quete_id) empêcherait un doublon silencieux (le 2e
// INSERT échouerait), mais cette fonction ne retente pas automatiquement un
// SELECT après un tel échec — cas très rare, hors périmètre de cette étape.
export async function chargerOuCreerQueteMois(userId: string): Promise<QueteMoisResult> {
  const moisCourant = formatMoisLocale(new Date());

  const { data: existante, error: selectError } = await supabase
    .from('quete_mois_utilisateur')
    .select('*')
    .eq('utilisateur', userId)
    .eq('mois', moisCourant)
    .maybeSingle();

  if (selectError) {
    return { quete: null, error: selectError.message };
  }

  if (existante) {
    return { quete: fusionnerQueteMoisAvecDataset(existante as QueteMoisRow), error: null };
  }

  const queteMois = QUETES_MOIS[0];

  const { data: creee, error: insertError } = await supabase
    .from('quete_mois_utilisateur')
    .insert({
      utilisateur: userId,
      mois: moisCourant,
      quete_id: queteMois.id,
      progression: 0,
      complete: false,
    })
    .select()
    .single();

  if (insertError) {
    return { quete: null, error: insertError.message };
  }

  return { quete: fusionnerQueteMoisAvecDataset(creee as QueteMoisRow), error: null };
}

type QueteMoisAvancementResult = {
  // La quête du mois mise à jour (déjà écrite en base), ou null si elle
  // n'existait pas encore (chargement pas terminé) ou était déjà "complete"
  // (anti-doublon : ne progresse plus jamais, ne redonne donc jamais sa
  // récompense XP une 2e fois — voir QuetesContext.tsx).
  queteMiseAJour: QueteMoisAffichee | null;
  error: string | null;
};

// FAIT AVANCER, EN BASE, la quête du mois déjà chargée (queteMois) —
// appelée par QuetesContext.avancerQuete chaque fois qu'une quête du JOUR
// vient de passer à "complete" (voir son commentaire "QUÊTE DU MOIS" pour le
// branchement). "Chaque quête journalière complétée compte, jusqu'à 3/jour"
// n'a PAS de logique dédiée ici : c'est simplement le nombre de fois où
// cette fonction est appelée (une fois par quête du jour tout juste
// complétée) qui produit cette limite naturellement — au plus 3 quêtes du
// jour existent (voir NOMBRE_QUETES_PAR_JOUR, lib/quetes.ts), donc jamais
// plus de 3 appels par jour.
//
// ANTI-DOUBLON : ne touche RIEN si "queteMois" est null ou déjà "complete"
// — jamais de progression ni de récompense en double, même si des quêtes du
// jour continuent d'être complétées après que le 30e point est atteint.
export async function avancerQueteMoisEnBase(
  queteMois: QueteMoisAffichee | null,
  montant: number,
): Promise<QueteMoisAvancementResult> {
  if (!queteMois || queteMois.complete) {
    return { queteMiseAJour: null, error: null };
  }

  const nouvelleProgression = Math.min(queteMois.objectif, queteMois.progression + montant);
  const nouvelleComplete = nouvelleProgression >= queteMois.objectif;

  const { error } = await supabase
    .from('quete_mois_utilisateur')
    .update({ progression: nouvelleProgression, complete: nouvelleComplete })
    .eq('id', queteMois.rowId);

  if (error) {
    return { queteMiseAJour: null, error: error.message };
  }

  return {
    queteMiseAJour: { ...queteMois, progression: nouvelleProgression, complete: nouvelleComplete },
    error: null,
  };
}
