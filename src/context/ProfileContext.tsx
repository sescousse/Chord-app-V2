import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Forme d'une ligne de la table Supabase "profils", telle que lue par
// l'app — un champ par colonne, mêmes noms que le schéma SQL (pas de
// renommage côté client : les requêtes plus bas restent lisibles telles
// quelles par rapport à la table). "nom_utilisateur"/"abonnement"/"bio" sont
// nullable : le trigger qui crée la ligne à l'inscription ne les renseigne
// pas — "nom_utilisateur" est maintenant écrit séparément juste après
// l'inscription (voir SignUpScreen.tsx), mais reste nullable ici pour les
// comptes créés avant l'ajout de ce champ, ou si cet écriture a échoué.
export interface Profil {
  id: string;
  nom_utilisateur: string | null;
  date_inscription: string;
  xp: number;
  streak_actuelle: number;
  meilleure_streak: number;
  niveau: number;
  abonnement: string | null;
  bio: string | null;
}

// Les 3 états de LECTURE que tout écran consommateur doit gérer : tant que
// isLoading est vrai, ni "profil" ni "error" ne doivent être considérés
// comme définitifs. Une fois isLoading à false : soit "profil" est rempli
// (succès), soit "error" l'est (échec) — jamais les deux à la fois.
//
// refreshProfile/addXp sont les 2 seules ÉCRITURES exposées par ce contexte
// (périmètre strict de cette étape) : chacune renvoie sa propre erreur
// éventuelle à l'appelant (pas de state d'erreur "d'écriture" séparé ici) —
// c'est à l'écran qui déclenche l'action de décider comment l'afficher
// (Alert, texte inline...), exactement comme handleSignOut le fait déjà
// pour supabase.auth.signOut() dans ProfileScreen.tsx.
type ProfileContextValue = {
  profil: Profil | null;
  isLoading: boolean;
  error: string | null;
  // Recharge le profil de l'utilisateur courant depuis Supabase. Utile
  // après une écriture faite AILLEURS que dans ce contexte (ex: le nom
  // d'utilisateur écrit juste après l'inscription, dans SignUpScreen.tsx) —
  // pour que ce contexte reflète bien la nouvelle valeur sans attendre un
  // éventuel prochain changement de "user".
  refreshProfile: () => Promise<void>;
  // Ajoute "amount" à l'xp du profil courant (peut être négatif si besoin,
  // pas de contrainte dans ce sens). Voir le commentaire détaillé sur son
  // implémentation ci-dessous (pourquoi une lecture+écriture simple, pas
  // encore un RPC atomique).
  addXp: (amount: number) => Promise<{ error: string | null }>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

type ProfileProviderProps = {
  children: ReactNode;
};

// Fournisseur du profil Supabase de l'utilisateur COURANT — même principe
// que AuthProvider (voir AuthContext.tsx) : un seul Provider central, monté
// une fois tout en haut (voir App.tsx), que n'importe quel écran peut lire
// via useProfile() sans reformuler sa propre requête.
//
// Dépend de useAuth() : ce Provider doit donc être monté SOUS <AuthProvider>
// dans l'arbre (voir App.tsx) pour pouvoir savoir QUEL utilisateur charger.
export function ProfileProvider({ children }: ProfileProviderProps) {
  const { user } = useAuth();

  const [profil, setProfil] = useState<Profil | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Partagé entre le chargement automatique (useEffect plus bas) et les
  // rechargements manuels (refreshProfile, addXp) : évite d'appeler
  // setState après démontage du Provider, quel que soit le déclencheur.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // LECTURE DU PROFIL — SELECT sur la table "profils", filtré sur
  // id = utilisateur connecté. Fonction PARTAGÉE par le chargement
  // automatique ET refreshProfile() : un seul endroit qui sait lire un
  // profil, jamais dupliqué.
  //
  // Le RLS de la table ("un utilisateur ne lit/écrit que SON profil, via
  // auth.uid() = id") impose déjà cette restriction CÔTÉ SERVEUR : le
  // .eq('id', userId) ci-dessous n'est donc pas ce qui sécurise la lecture
  // (même sans lui, la policy empêcherait de toute façon de voir le profil
  // de quelqu'un d'autre) — il précise juste QUELLE ligne on veut parmi
  // celles que la policy autoriserait.
  //
  // .single() : on attend EXACTEMENT une ligne (le trigger d'inscription en
  // crée toujours une pour chaque utilisateur) — si ce n'était pas le cas,
  // .single() fait échouer la requête avec une vraie erreur plutôt que de
  // renvoyer silencieusement un tableau vide ou à plusieurs entrées.
  const loadProfile = async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const { data, error: selectError } = await supabase
      .from('profils')
      .select('*')
      .eq('id', userId)
      .single();

    if (!isMountedRef.current) return;

    // 3 ÉTATS, jamais mélangés : une erreur vide "profil" (pas de données à
    // moitié fiables affichées), un succès vide "error".
    if (selectError) {
      setError(selectError.message);
      setProfil(null);
    } else {
      // Cast explicite vers Profil : sans schéma "Database" généré à partir
      // du projet Supabase (hors périmètre de cette étape), le client ne
      // connaît pas la forme exacte de la table "profils" et typerait
      // "data" en interne de façon lâche — ce cast affirme qu'elle
      // correspond à l'interface Profil ci-dessus (vérifiée à la main
      // contre les colonnes réelles de la table), sans jamais introduire de
      // "any" dans ce fichier.
      setProfil(data as Profil);
      setError(null);
    }
    setIsLoading(false);
  };

  // Se relance à chaque changement de RÉFÉRENCE de "user" — c'est-à-dire à
  // chaque connexion/déconnexion (voir AuthContext : `user` est dérivé de
  // `session`, qui ne change de référence que lors d'un vrai évènement
  // d'auth), jamais à chaque simple re-render.
  useEffect(() => {
    // Personne de connecté (déconnexion, ou pas encore connecté) : rien à
    // charger. On vide aussi le profil précédent — sinon le profil d'un
    // utilisateur qui vient de se déconnecter resterait affiché à l'écran
    // pour le suivant qui se connecte, le temps que sa propre requête aboutisse.
    if (!user) {
      setProfil(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    loadProfile(user.id);
    // loadProfile est stable en pratique (ne dépend que de setState et du
    // client supabase, jamais recréée de façon significative) : inutile de
    // la lister en dépendance, seul un changement de "user" doit relancer
    // ce chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Rechargement MANUEL, exposé pour les écrans qui écrivent le profil
  // ailleurs que via addXp (ex: le nom d'utilisateur écrit juste après
  // l'inscription dans SignUpScreen.tsx) et veulent que ce contexte reflète
  // immédiatement la nouvelle valeur.
  const refreshProfile = async () => {
    if (!user) return;
    await loadProfile(user.id);
  };

  // AJOUTER DE L'XP — implémentation SIMPLE : on lit l'xp déjà en mémoire
  // (profil.xp, chargé par ce même contexte), on additionne "amount", puis
  // on écrit le total avec un UPDATE classique.
  //
  // LIMITE CONNUE de cette approche : c'est une lecture-puis-écriture faite
  // côté CLIENT, pas une opération atomique côté serveur. Si 2 écritures
  // partaient en même temps (double-tap rapide, ou 2 appareils connectés en
  // même temps) en lisant toutes les deux le même xp de départ, la seconde
  // écraserait le gain de la première au lieu de s'additionner (perte
  // silencieuse d'XP) — une vraie "race condition" d'écriture. La solution
  // robuste serait une fonction SQL Postgres (RPC), appelée via
  // supabase.rpc('ajouter_xp', { montant: amount }), qui ferait l'addition
  // ATOMIQUEMENT côté serveur (ex: UPDATE profils SET xp = xp + montant ...)
  // sans jamais lire de valeur côté client — hors périmètre de cette étape
  // (juste vérifier que l'écriture marche), cette version simple suffit.
  const addXp = async (amount: number): Promise<{ error: string | null }> => {
    if (!user) {
      return { error: 'Aucun utilisateur connecté.' };
    }
    if (!profil) {
      return { error: "Profil pas encore chargé, réessaie dans un instant." };
    }

    const newXp = profil.xp + amount;

    // .select().single() après l'update : Supabase renvoie directement la
    // ligne à jour, pas besoin d'un second SELECT séparé pour rafraîchir le
    // contexte (voir setProfil ci-dessous).
    const { data, error: updateError } = await supabase
      .from('profils')
      .update({ xp: newXp })
      .eq('id', user.id)
      .select()
      .single();

    if (!isMountedRef.current) return { error: null };

    if (updateError) {
      return { error: updateError.message };
    }

    setProfil(data as Profil);
    return { error: null };
  };

  const value: ProfileContextValue = { profil, isLoading, error, refreshProfile, addXp };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

// Hook de lecture/écriture, seul point d'accès au profil pour le reste de
// l'app — lève une erreur explicite si utilisé hors d'un <ProfileProvider>
// plutôt que de renvoyer silencieusement des valeurs par défaut trompeuses.
export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile() doit être appelé à l’intérieur d’un <ProfileProvider>.');
  }
  return context;
}
