// Fonctions de SUIVI unilatéral (table Supabase "suivis" : id, suiveur,
// suivi, date_suivi — RLS : lecture ouverte aux connectés, insert/delete
// limités à auth.uid() = suiveur). Module dédié, réutilisable par n'importe
// quel écran (pas de dépendance à un contexte React) : chaque fonction gère
// sa propre requête Supabase et renvoie un résultat simple à afficher.

import { supabase } from './supabase';

// Résout l'id de l'utilisateur CONNECTÉ pour les fonctions ci-dessous, qui
// n'exposent volontairement qu'un seul paramètre (idCible) — le "suiveur"
// est toujours l'utilisateur courant, jamais un id passé à la main.
// getSession() relit la session déjà en mémoire/AsyncStorage (voir
// AuthContext.tsx), sans aller-retour réseau — suffisant ici, le RLS
// revérifie de toute façon QUI fait réellement la requête côté serveur.
async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

type WriteResult = { error: string | null };

// SUIVRE — insère une ligne (suiveur = moi, suivi = idCible). Le RLS
// ("insert limité à auth.uid() = suiveur") empêcherait de toute façon
// d'insérer une ligne au nom de quelqu'un d'autre ; getCurrentUserId()
// ci-dessus n'est donc pas ce qui sécurise l'opération, juste ce qui
// renseigne la colonne "suiveur" avec la bonne valeur.
export async function suivre(idCible: string): Promise<WriteResult> {
  const suiveurId = await getCurrentUserId();
  if (!suiveurId) {
    return { error: 'Aucun utilisateur connecté.' };
  }

  const { error } = await supabase.from('suivis').insert({ suiveur: suiveurId, suivi: idCible });

  return { error: error ? error.message : null };
}

// NE PLUS SUIVRE — supprime la ligne (suiveur = moi, suivi = idCible). Les
// 2 .eq() ENSEMBLE ciblent CETTE ligne précise (pas "un suivi de idCible" en
// général, ce qui supprimerait par erreur le lien de quelqu'un d'autre si le
// RLS ne l'empêchait pas déjà).
export async function nePlusSuivre(idCible: string): Promise<WriteResult> {
  const suiveurId = await getCurrentUserId();
  if (!suiveurId) {
    return { error: 'Aucun utilisateur connecté.' };
  }

  const { error } = await supabase
    .from('suivis')
    .delete()
    .eq('suiveur', suiveurId)
    .eq('suivi', idCible);

  return { error: error ? error.message : null };
}

type FollowStatusResult = { isFollowing: boolean; error: string | null };

// EST SUIVI — indique si JE suis déjà idCible.
//
// { count: 'exact', head: true } : demande UNIQUEMENT le nombre de lignes
// correspondantes, pas leur contenu ("head" = pas de corps de réponse à
// transférer, on n'a besoin que du total). Ici, ce total vaut forcément 0
// (pas suivi) ou 1 (suivi) — (suiveur, suivi) ne peut apparaître qu'une
// seule fois, sinon la table permettrait de "suivre" 2 fois la même personne.
export async function estSuivi(idCible: string): Promise<FollowStatusResult> {
  const suiveurId = await getCurrentUserId();
  if (!suiveurId) {
    return { isFollowing: false, error: 'Aucun utilisateur connecté.' };
  }

  const { count, error } = await supabase
    .from('suivis')
    .select('*', { count: 'exact', head: true })
    .eq('suiveur', suiveurId)
    .eq('suivi', idCible);

  if (error) {
    return { isFollowing: false, error: error.message };
  }
  return { isFollowing: (count ?? 0) > 0, error: null };
}

type CountResult = { count: number; error: string | null };

// COMPTER ABONNÉS — nombre de lignes où "suivi" = idUtilisateur : chaque
// ligne représente UNE personne qui suit idUtilisateur, c'est la définition
// d'un abonné. Même technique de comptage que estSuivi() ci-dessus (count
// exact, head: true — jamais besoin des lignes elles-mêmes, juste leur nombre).
export async function compterAbonnes(idUtilisateur: string): Promise<CountResult> {
  const { count, error } = await supabase
    .from('suivis')
    .select('*', { count: 'exact', head: true })
    .eq('suivi', idUtilisateur);

  if (error) {
    return { count: 0, error: error.message };
  }
  return { count: count ?? 0, error: null };
}

// COMPTER ABONNEMENTS — nombre de lignes où "suiveur" = idUtilisateur :
// chaque ligne représente UN compte que idUtilisateur suit, c'est la
// définition d'un abonnement.
export async function compterAbonnements(idUtilisateur: string): Promise<CountResult> {
  const { count, error } = await supabase
    .from('suivis')
    .select('*', { count: 'exact', head: true })
    .eq('suiveur', idUtilisateur);

  if (error) {
    return { count: 0, error: error.message };
  }
  return { count: count ?? 0, error: null };
}

// --- DÉTECTION D'AMITIÉ MUTUELLE --------------------------------------------

// Type de relation avec un autre utilisateur : "ami" (suivi réciproque),
// "suivi" (à sens unique, je le suis mais il ne me suit pas), ou null
// (aucune relation particulière — pas de badge à afficher).
export type TypeRelation = 'ami' | 'suivi' | null;

// Mes relations de suivi dans LES DEUX SENS, sous forme de Set (recherche
// O(1) par id) — voir chargerRelations()/determinerTypeRelation() ci-dessous.
export type RelationsUtilisateur = {
  // Ids que JE suis (mes abonnements).
  jeSuis: Set<string>;
  // Ids qui ME suivent (mes abonnés).
  meSuivent: Set<string>;
};

type RelationsResult = { relations: RelationsUtilisateur | null; error: string | null };

// CHARGE mes relations complètes en SEULEMENT 2 REQUÊTES (pas une par
// utilisateur affiché ailleurs, ex: chaque bulle de SocialScreen.tsx) :
// 1) toutes les lignes où JE suis "suiveur" (qui je suis)
// 2) toutes les lignes où JE suis "suivi" (qui me suit)
// Les deux partent en parallèle (Promise.all). Le type de relation avec
// N'IMPORTE QUEL utilisateur se déduit ENSUITE localement (voir
// determinerTypeRelation), sans requête réseau supplémentaire — c'est ce qui
// rend l'affichage d'une LISTE d'utilisateurs (potentiellement nombreuse)
// efficace : le coût réseau reste constant (2 requêtes), pas proportionnel
// au nombre d'utilisateurs affichés.
export async function chargerRelations(): Promise<RelationsResult> {
  const monId = await getCurrentUserId();
  if (!monId) {
    return { relations: null, error: 'Aucun utilisateur connecté.' };
  }

  const [jeSuisResult, meSuiventResult] = await Promise.all([
    supabase.from('suivis').select('suivi').eq('suiveur', monId),
    supabase.from('suivis').select('suiveur').eq('suivi', monId),
  ]);

  if (jeSuisResult.error) {
    return { relations: null, error: jeSuisResult.error.message };
  }
  if (meSuiventResult.error) {
    return { relations: null, error: meSuiventResult.error.message };
  }

  // Cast explicite (pas de schéma "Database" généré depuis Supabase, même
  // raison qu'ailleurs dans l'app, ex: ProfileContext.tsx) — jamais de "any".
  const jeSuisRows = jeSuisResult.data as { suivi: string }[];
  const meSuiventRows = meSuiventResult.data as { suiveur: string }[];

  return {
    relations: {
      jeSuis: new Set(jeSuisRows.map((row) => row.suivi)),
      meSuivent: new Set(meSuiventRows.map((row) => row.suiveur)),
    },
    error: null,
  };
}

// DÉTERMINE le type de relation avec idCible à partir des Sets déjà chargés
// par chargerRelations() — purement local (Set.has(), pas de requête) :
// - "ami" : je le suis ET il me suit (présent dans les 2 Sets à la fois) →
//   suivi réciproque.
// - "suivi" : je le suis, mais il ne me suit pas en retour.
// - null : je ne le suis pas — aucune relation à signaler (que lui me suive
//   ou non n'a pas de badge dédié dans ce périmètre).
export function determinerTypeRelation(
  idCible: string,
  relations: RelationsUtilisateur,
): TypeRelation {
  const jeLeSuis = relations.jeSuis.has(idCible);
  const ilMeSuit = relations.meSuivent.has(idCible);

  if (jeLeSuis && ilMeSuit) return 'ami';
  if (jeLeSuis) return 'suivi';
  return null;
}
