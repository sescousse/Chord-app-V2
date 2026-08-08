import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useProfile } from './ProfileContext';
import { SUCCES, type Succes } from '../dataset/succes';

// Code Postgres "unique_violation" — voir son usage détaillé dans
// debloquerSucces() plus bas.
const UNIQUE_VIOLATION_ERROR_CODE = '23505';

type SuccesContextValue = {
  // Ids des succès déjà débloqués par l'utilisateur COURANT — un Set pour
  // une vérification O(1) (ex: "ce succès est-il débloqué ?" pour CHAQUE
  // succès de la liste, sur ProfileScreen).
  succesDebloques: Set<string>;
  isLoading: boolean;
  error: string | null;
  // Débloque un succès pour l'utilisateur courant — voir le commentaire
  // détaillé sur son implémentation plus bas (anti-doublon, XP, célébration).
  debloquerSucces: (succesId: string) => Promise<{ error: string | null }>;
  // Succès actuellement affiché en écran de célébration, ou null si aucun —
  // voir SuccesCelebrationOverlay.tsx, qui lit cette valeur et l'affiche.
  succesEnCelebration: Succes | null;
  fermerCelebration: () => void;
};

const SuccesContext = createContext<SuccesContextValue | undefined>(undefined);

type SuccesProviderProps = {
  children: ReactNode;
};

// Fournisseur du système de succès — même principe que ProfileContext/
// AuthContext (un seul Provider central, monté une fois tout en haut, voir
// App.tsx). Dépend de useAuth() (quel utilisateur) ET useProfile() (addXp,
// pour la récompense) : doit donc être monté SOUS les deux dans l'arbre.
export function SuccesProvider({ children }: SuccesProviderProps) {
  const { user } = useAuth();
  const { profil, addXp } = useProfile();

  const [succesDebloques, setSuccesDebloques] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [succesEnCelebration, setSuccesEnCelebration] = useState<Succes | null>(null);

  // CHARGEMENT DES SUCCÈS DÉBLOQUÉS — même principe que ProfileContext : un
  // SELECT au chargement, relancé à chaque changement d'utilisateur
  // (connexion/déconnexion). Le RLS de "succes_debloques" ("lecture limitée
  // à auth.uid() = utilisateur") impose déjà cette restriction côté serveur.
  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setSuccesDebloques(new Set());
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    supabase
      .from('succes_debloques')
      .select('succes_id')
      .eq('utilisateur', user.id)
      .then(({ data, error: selectError }) => {
        if (!isMounted) return;

        if (selectError) {
          setError(selectError.message);
          setSuccesDebloques(new Set());
        } else {
          // Cast explicite : pas de schéma "Database" généré depuis
          // Supabase (même raison qu'ailleurs dans l'app, ex:
          // ProfileContext.tsx) — jamais de "any".
          const rows = data as { succes_id: string }[];
          setSuccesDebloques(new Set(rows.map((row) => row.succes_id)));
          setError(null);
        }
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // DÉBLOCAGE D'UN SUCCÈS — 3 temps :
  //
  // 1) VÉRIFICATION LOCALE d'abord (succesDebloques.has) : évite un
  //    aller-retour réseau inutile pour le cas le plus fréquent (le succès
  //    est déjà débloqué depuis longtemps — ex: rejouer une leçon déjà
  //    terminée une fois "premiere_lecon" acquis).
  //
  // 2) INSERT dans "succes_debloques". Le VRAI rempart anti-doublon reste la
  //    contrainte unique(utilisateur, succes_id) CÔTÉ BASE (voir le SQL
  //    fourni à part), pas la vérification locale ci-dessus : si elle était
  //    périmée (ex: 2 appareils connectés en même temps), Postgres refuse le
  //    2e insert avec le code "23505" (violation de contrainte unique) — on
  //    traite alors ça comme "déjà débloqué" (pas de re-XP, pas de
  //    célébration), PAS comme une vraie erreur à remonter.
  //
  // 3) Seulement si l'insert a RÉELLEMENT eu lieu (un nouveau déblocage) :
  //    addXp() de la récompense propre à ce succès, ET déclenchement de
  //    l'écran de célébration (succesEnCelebration) — jamais les deux à la
  //    fois qu'une seule fois par succès, par construction.
  const debloquerSucces = async (succesId: string): Promise<{ error: string | null }> => {
    if (!user) {
      return { error: 'Aucun utilisateur connecté.' };
    }

    if (succesDebloques.has(succesId)) {
      return { error: null };
    }

    const succes = SUCCES.find((item) => item.id === succesId);
    if (!succes) {
      return { error: `Succès inconnu : "${succesId}".` };
    }

    const { error: insertError } = await supabase
      .from('succes_debloques')
      .insert({ utilisateur: user.id, succes_id: succesId });

    if (insertError) {
      if (insertError.code === UNIQUE_VIOLATION_ERROR_CODE) {
        setSuccesDebloques((current) => new Set(current).add(succesId));
        return { error: null };
      }
      return { error: insertError.message };
    }

    setSuccesDebloques((current) => new Set(current).add(succesId));

    const { error: xpError } = await addXp(succes.recompense_xp);
    // Le succès reste débloqué (déjà écrit ci-dessus) même si l'ajout d'XP a
    // échoué — pas la peine d'annuler le déblocage pour ça ; on remonte
    // juste l'erreur à l'appelant, qui décide comment l'afficher (comme pour
    // addXp seul ailleurs dans l'app).
    if (xpError) {
      return { error: xpError };
    }

    setSuccesEnCelebration(succes);
    return { error: null };
  };

  // SUCCÈS DE STREAK ("7_jours"/"30_jours") — surveille profil.streak_actuelle
  // (calculée et écrite par validerActiviteDuJour, dans ProfileContext.tsx)
  // et débloque le succès correspondant dès qu'elle atteint le seuil.
  //
  // POURQUOI ICI et pas dans validerActiviteDuJour lui-même (comme le
  // suggère naturellement la consigne) : ProfileProvider est le PARENT de
  // SuccesProvider dans App.tsx (SuccesProvider dépend déjà de useProfile()
  // pour addXp ci-dessus) — ProfileContext ne peut donc PAS appeler
  // useSucces() sans créer une dépendance circulaire entre les 2 contextes.
  // Réagir ICI au changement de profil.streak_actuelle (que ce Provider
  // peut déjà lire) obtient exactement le même résultat fonctionnel, dans le
  // bon sens de dépendance.
  //
  // ">=" (pas "===") : plus robuste qu'une égalité stricte si la streak
  // venait un jour à "sauter" une valeur (ex: futur gel de série) — sans
  // risque de double déclenchement, debloquerSucces() est déjà idempotent.
  useEffect(() => {
    if (!profil) return;

    if (profil.streak_actuelle >= 7) {
      void debloquerSucces('7_jours');
    }
    if (profil.streak_actuelle >= 30) {
      void debloquerSucces('30_jours');
    }
    // "debloquerSucces" volontairement absent des dépendances (nouvelle
    // référence à chaque rendu, comme ailleurs dans ce fichier) : seul un
    // vrai changement de streak_actuelle doit relancer cette vérification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil?.streak_actuelle]);

  const fermerCelebration = () => {
    setSuccesEnCelebration(null);
  };

  const value: SuccesContextValue = {
    succesDebloques,
    isLoading,
    error,
    debloquerSucces,
    succesEnCelebration,
    fermerCelebration,
  };

  return <SuccesContext.Provider value={value}>{children}</SuccesContext.Provider>;
}

// Hook de lecture/écriture, seul point d'accès au système de succès pour le
// reste de l'app — lève une erreur explicite si utilisé hors d'un
// <SuccesProvider> plutôt que de renvoyer silencieusement des valeurs par
// défaut trompeuses.
export function useSucces(): SuccesContextValue {
  const context = useContext(SuccesContext);
  if (context === undefined) {
    throw new Error('useSucces() doit être appelé à l’intérieur d’un <SuccesProvider>.');
  }
  return context;
}
