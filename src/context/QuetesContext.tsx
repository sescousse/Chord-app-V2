import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from './AuthContext';
import { useProfile } from './ProfileContext';
import { chargerOuTirerQuetesDuJour, avancerQuetesEnBase, type QueteDuJour } from '../lib/quetes';
import { chargerOuCreerQueteMois, avancerQueteMoisEnBase, type QueteMoisAffichee } from '../lib/quetesMois';
import type { QueteType } from '../dataset/quetes';

type QuetesContextValue = {
  quetesDuJour: QueteDuJour[];
  // Quête du mois de l'utilisateur courant — null seulement pendant le tout
  // premier chargement (isLoading true) ou si personne n'est connecté ;
  // sinon toujours remplie (chargerOuCreerQueteMois en crée une si besoin,
  // voir lib/quetesMois.ts).
  queteMois: QueteMoisAffichee | null;
  isLoading: boolean;
  error: string | null;
  // Fait avancer les quêtes ACTIVES du jour de ce "type", de "montant" — voir
  // son commentaire détaillé plus bas (calcul délégué à avancerQuetesEnBase,
  // récompense XP, la propagation à la quête du mois, et le piège anti-
  // boucle avec addXp).
  avancerQuete: (type: QueteType, montant: number) => Promise<{ error: string | null }>;
};

const QuetesContext = createContext<QuetesContextValue | undefined>(undefined);

type QuetesProviderProps = {
  children: ReactNode;
};

// Fournisseur des QUÊTES DU JOUR — même principe que ProfileContext/
// SuccesContext (un seul Provider central, monté une fois tout en haut, voir
// App.tsx). Dépend de useAuth() (quel utilisateur) ET useProfile() (addXp,
// pour la récompense d'une quête tout juste complétée) : doit donc être
// monté SOUS les deux dans l'arbre — comme SuccesProvider, et POUR LA MÊME
// RAISON D'ARCHITECTURE (voir le commentaire "POURQUOI ICI" dans
// SuccesContext.tsx) : ProfileProvider est un ANCÊTRE de QuetesProvider,
// donc addXp (ProfileContext.tsx) ne peut JAMAIS appeler useQuetes() lui-même
// (un parent ne peut pas consommer le contexte d'un de ses enfants). C'est ce
// qui impose la règle anti-boucle détaillée sur avancerQuete plus bas : le
// lien "gagner de l'XP fait avancer la quête 'xp_jour'" est branché à chaque
// APPELANT d'addXp qui représente un vrai gain (LessonCourseScreen.tsx,
// improResult.tsx, creation.tsx), juste après l'avoir appelé — jamais depuis
// l'intérieur d'addXp.
export function QuetesProvider({ children }: QuetesProviderProps) {
  const { user } = useAuth();
  const { addXp } = useProfile();

  const [quetesDuJour, setQuetesDuJour] = useState<QueteDuJour[]>([]);
  const [queteMois, setQueteMois] = useState<QueteMoisAffichee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CHARGEMENT (+ TIRAGE/CRÉATION SI BESOIN) — quêtes du JOUR et quête du
  // MOIS chargées EN PARALLÈLE (Promise.all), une fois par connexion/
  // lancement (voir [user] en dépendance, même principe que ProfileContext/
  // SuccesContext) : PAS besoin de recharger à chaque focus d'écran, la
  // progression des deux est tenue à jour EN MÉMOIRE par avancerQuete
  // ci-dessous, quel que soit l'écran qui l'appelle — voir son commentaire
  // pour le détail de cette mise à jour "temps réel".
  useEffect(() => {
    let isActive = true;

    if (!user) {
      setQuetesDuJour([]);
      setQueteMois(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    Promise.all([chargerOuTirerQuetesDuJour(user.id), chargerOuCreerQueteMois(user.id)]).then(
      ([quetesResult, queteMoisResult]) => {
        if (!isActive) return;

        // Erreur PARTIELLE : si l'une des deux charges échoue, on affiche
        // quand même ce qui a réussi (jamais tout effacer pour l'échec d'une
        // seule des deux) — le 1er message d'erreur rencontré suffit à
        // prévenir l'utilisateur, pas besoin de les combiner.
        setQuetesDuJour(quetesResult.quetes ?? []);
        setQueteMois(queteMoisResult.quete);
        setError(quetesResult.error ?? queteMoisResult.error);
        setIsLoading(false);
      },
    );

    return () => {
      isActive = false;
    };
  }, [user]);

  // FAIT AVANCER LA QUÊTE DU MOIS de "montant", à partir de "queteMoisActuelle"
  // reçue EXPLICITEMENT en paramètre (PAS lue depuis le state React
  // "queteMois") — nécessaire car son unique appelant (avancerQuete
  // ci-dessous) peut avoir PLUSIEURS quêtes du jour à traiter dans une même
  // rafale (2 quêtes 'xp_jour' tirées le même jour, toutes deux complétées
  // par le même gain d'XP, par exemple) : lire "queteMois" depuis le state à
  // chaque itération y lirait une valeur PÉRIMÉE pour la 2e itération —
  // setQueteMois() ne se reflète qu'au rendu SUIVANT, jamais de façon
  // synchrone au sein d'une même fonction. En faisant transiter la valeur
  // "à jour" explicitement d'un appel à l'autre (voir la boucle plus bas),
  // chaque quête du jour complétée fait bien avancer le compteur d'UN cran
  // de plus, jamais un cran perdu ni un double comptage.
  //
  // Renvoie la quête du mois APRÈS cet avancement (ou "queteMoisActuelle"
  // inchangée si rien n'a bougé) : c'est cette valeur de retour, pas le
  // state, qui doit être transmise à l'appel suivant de la même rafale.
  const avancerQueteMois = async (
    montant: number,
    queteMoisActuelle: QueteMoisAffichee | null,
  ): Promise<{ queteMoisApres: QueteMoisAffichee | null; error: string | null }> => {
    const { queteMiseAJour, error: updateError } = await avancerQueteMoisEnBase(
      queteMoisActuelle,
      montant,
    );

    if (updateError) {
      return { queteMoisApres: queteMoisActuelle, error: updateError };
    }

    // null : soit il n'y avait pas encore de quête du mois chargée, soit
    // elle était déjà "complete" (anti-doublon, voir avancerQueteMoisEnBase)
    // — dans les deux cas, rien à répercuter dans l'état affiché.
    if (!queteMiseAJour) {
      return { queteMoisApres: queteMoisActuelle, error: null };
    }

    setQueteMois(queteMiseAJour);

    // RÉCOMPENSE — une seule fois, garantie par l'anti-doublon ci-dessus
    // (queteMiseAJour n'est renvoyée QUE si "queteMoisActuelle" n'était pas
    // déjà complète). TODO: récompense en monnaie/coffre quand la boutique
    // existera — pour l'instant, uniquement de l'XP (voir
    // QueteMois.recompense_xp, dataset/quetesMois.ts).
    //
    // ⚠️ MÊME PIÈGE ANTI-BOUCLE que pour les quêtes du jour (voir le
    // commentaire détaillé sur avancerQuete plus bas) : cet addXp() ne peut
    // PAS redéclencher avancerQuete('xp_jour', ...) ni avancerQueteMois —
    // même raison structurelle (addXp vient de ProfileContext, un ANCÊTRE de
    // QuetesProvider dans l'arbre, qui ne peut physiquement rien appeler
    // ici).
    if (queteMiseAJour.complete) {
      const { error: xpError } = await addXp(queteMiseAJour.recompense_xp);
      if (xpError) {
        return { queteMoisApres: queteMiseAJour, error: xpError };
      }
    }

    return { queteMoisApres: queteMiseAJour, error: null };
  };

  // FAIT AVANCER LES QUÊTES DU JOUR — le calcul + l'écriture Supabase vivent
  // dans avancerQuetesEnBase (lib/quetes.ts, anti-doublon inclus : ne touche
  // jamais une quête déjà "complete") ; ce contexte se contente de :
  // 1) l'appeler sur les quêtes déjà en mémoire (quetesDuJour) ;
  // 2) répercuter le résultat dans l'état affiché — c'est CE setState qui
  //    rend la progression "temps réel" sur QuetesScreen (et n'importe quel
  //    autre écran qui lirait un jour ce contexte), sans avoir à y retourner
  //    ni à recharger quoi que ce soit ;
  // 3) donner la récompense XP des quêtes qui viennent tout juste de passer
  //    à "complete" (jamais deux fois la même, garanti par l'anti-doublon
  //    d'avancerQuetesEnBase), ET faire avancer la QUÊTE DU MOIS d'UN cran
  //    par quête du jour tout juste complétée (voir avancerQueteMois
  //    ci-dessus — "chaque quête journalière complétée compte, jusqu'à
  //    3/jour" : la limite de 3 vient simplement du fait qu'il n'existe
  //    jamais plus de 3 quêtes du jour à compléter, pas d'une règle
  //    explicite ici).
  //
  // ⚠️ PIÈGE ANTI-BOUCLE — addXp() à l'étape 3 (pour la quête du jour ET
  // pour la quête du mois) NE DOIT JAMAIS redéclencher avancerQuete('xp_jour',
  // ...) : sinon, une quête XP qui vient de se terminer ferait avancer
  // (voire terminer, avec SA PROPRE récompense) une AUTRE quête XP du jour
  // — une boucle de farming gratuit à partir de rien. La protection n'est
  // PAS un flag/garde ajouté ici : elle vient de l'architecture elle-même
  // (voir le commentaire en tête de ce fichier) — addXp() (ProfileContext.tsx)
  // n'appelle JAMAIS avancerQuete, quel que soit l'appelant, parce qu'il ne
  // PEUT physiquement pas (parent ne peut pas lire le contexte d'un enfant).
  // 'xp_jour' n'avance donc QUE via les appels explicites faits par les
  // écrans qui gagnent vraiment de l'XP (LessonCourseScreen.tsx,
  // improResult.tsx, creation.tsx) — jamais depuis une récompense de quête
  // (jour OU mois), structurellement impossible.
  const avancerQuete = async (
    type: QueteType,
    montant: number,
  ): Promise<{ error: string | null }> => {
    if (!user) {
      return { error: 'Aucun utilisateur connecté.' };
    }

    const { quetesMisesAJour, error: updateError } = await avancerQuetesEnBase(
      quetesDuJour,
      type,
      montant,
    );

    if (updateError) {
      return { error: updateError };
    }

    if (quetesMisesAJour.length === 0) {
      return { error: null };
    }

    setQuetesDuJour((current) =>
      current.map((quete) => quetesMisesAJour.find((maj) => maj.id === quete.id) ?? quete),
    );

    // RÉCOMPENSE — chaque quête ici vient RÉELLEMENT de passer à "complete"
    // pour la première fois (garanti par l'anti-doublon d'avancerQuetesEnBase,
    // qui ne considère que les quêtes pas encore complètes). Séquentiel (pas
    // Promise.all) : addXp lit-puis-écrit l'xp du profil de façon non
    // atomique (voir son propre commentaire dans ProfileContext.tsx) —
    // enchaîner plutôt que lancer plusieurs gains en parallèle réduit le
    // risque qu'ils s'écrasent l'un l'autre, même principe que
    // LessonCourseScreen.handleFinishLesson.
    //
    // TODO: récompense en monnaie/coffre quand la boutique existera — pour
    // l'instant, uniquement de l'XP (voir Quete.recompense_xp, dataset/quetes.ts).
    //
    // "queteMoisCourante" thread la quête du mois d'une itération à l'autre
    // (voir le commentaire détaillé sur avancerQueteMois) — initialisée avec
    // le state actuel, puis réassignée à chaque quête du jour qui se termine
    // dans CETTE rafale.
    let queteMoisCourante = queteMois;
    for (const quete of quetesMisesAJour) {
      if (quete.complete) {
        await addXp(quete.recompense_xp);

        // QUÊTE DU MOIS — une quête du jour vient de se terminer : ça compte
        // pour un cran de "Accomplis 30 quêtes", quel que soit son type.
        const { queteMoisApres } = await avancerQueteMois(1, queteMoisCourante);
        queteMoisCourante = queteMoisApres;
      }
    }

    return { error: null };
  };

  const value: QuetesContextValue = { quetesDuJour, queteMois, isLoading, error, avancerQuete };

  return <QuetesContext.Provider value={value}>{children}</QuetesContext.Provider>;
}

// Hook de lecture/écriture, seul point d'accès aux quêtes du jour pour le
// reste de l'app — lève une erreur explicite si utilisé hors d'un
// <QuetesProvider> plutôt que de renvoyer silencieusement des valeurs par
// défaut trompeuses.
export function useQuetes(): QuetesContextValue {
  const context = useContext(QuetesContext);
  if (context === undefined) {
    throw new Error('useQuetes() doit être appelé à l’intérieur d’un <QuetesProvider>.');
  }
  return context;
}
