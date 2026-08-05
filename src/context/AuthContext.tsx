import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

// Ce que le reste de l'app peut lire sur l'état de connexion. `user` (dérivé
// de `session`, jamais stocké séparément — voir plus bas) est ce que la
// majorité des écrans utiliseront ; `session`/`isLoading` restent
// disponibles pour les cas qui en ont besoin (ex: l'aiguillage racine).
type AuthContextValue = {
  user: User | null;
  session: Session | null;
  // true UNIQUEMENT pendant la toute première vérification de session au
  // lancement de l'app (voir le useEffect ci-dessous) — jamais revrai après,
  // même pendant une connexion/déconnexion en cours (ça, c'est aux écrans
  // SignIn/SignUp/Profil de le gérer avec leur propre état de soumission).
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

// Fournisseur UNIQUE de l'état d'auth pour toute l'app (à placer une seule
// fois, tout en haut — voir App.tsx). Toute la logique de connexion "réelle"
// (appels signUp/signInWithPassword/signOut) reste dans les écrans qui les
// déclenchent : ce composant ne fait qu'OBSERVER l'état de session courant,
// il ne le modifie jamais lui-même.
export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  // Démarre à true : tant qu'on n'a pas interrogé Supabase au moins une
  // fois, on ne sait pas encore si l'utilisateur est connecté ou non — voir
  // l'aiguillage dans App.tsx, qui affiche un spinner tant que c'est vrai.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Évite d'appeler setState après démontage (ex: si l'app se ferme pendant
    // que la promesse ci-dessous est encore en vol) — un cas rare mais React
    // avertit sinon d'une fuite mémoire potentielle.
    let isMounted = true;

    // 1) SESSION INITIALE — supabase.auth.getSession() relit la session déjà
    // stockée sur l'appareil (AsyncStorage, voir supabase.ts) : c'est ce qui
    // permet à un utilisateur déjà connecté de ne PAS retomber sur l'écran
    // de connexion à chaque redémarrage de l'app. Ne fait PAS d'appel
    // réseau à chaque fois (le token est lu localement ; Supabase ne
    // recontacte le serveur que si ce token doit être rafraîchi).
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setIsLoading(false);
    });

    // 2) ÉCOUTE CONTINUE — onAuthStateChange se déclenche pour CHAQUE
    // évènement d'auth qui arrive APRÈS ce chargement initial : connexion
    // (SignIn), inscription (SignUp), déconnexion (SignOut), et même le
    // rafraîchissement automatique du token (autoRefreshToken: true dans
    // supabase.ts). C'est le mécanisme qui fait fonctionner l'aiguillage
    // conditionnel de App.tsx : dès qu'un écran appelle signIn/signUp/
    // signOut, `session` change ICI tout seul, sans navigation manuelle à
    // écrire côté écrans.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    // `user` dérivé de `session` (jamais un state séparé) : les deux ne
    // peuvent alors jamais désynchroniser accidentellement l'un de l'autre.
    user: session?.user ?? null,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook de lecture, seul point d'accès à l'état d'auth pour le reste de
// l'app — lève une erreur explicite si utilisé hors d'un <AuthProvider>
// plutôt que de renvoyer silencieusement des valeurs par défaut trompeuses.
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth() doit être appelé à l’intérieur d’un <AuthProvider>.');
  }
  return context;
}
