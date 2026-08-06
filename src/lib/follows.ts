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
