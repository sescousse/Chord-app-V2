import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

// État d'OUVERTURE du menu réglages (drawer glissant depuis la gauche, voir
// src/components/SettingsDrawer.tsx) — un simple booléen partagé, PAS de
// navigateur dédié (@react-navigation/drawer) : voir SettingsDrawer.tsx pour
// le choix de rester sur des dépendances déjà présentes dans le projet
// (Animated seul, sans react-native-gesture-handler/reanimated).
//
// Un Context, comme AuthContext/ProfileContext/SuccesContext : nécessaire
// car le bouton qui OUVRE ce drawer (l'engrenage de ProfileScreen) est
// profondément imbriqué dans la navigation (RootNavigator > SocialStack >
// ProfileScreen), tandis que le drawer LUI-MÊME est rendu tout en haut de
// l'app, en dehors de cette navigation (voir App.tsx, même principe que
// SuccesCelebrationOverlay/SuccesContext) — ce Context est le seul lien
// entre les deux.
type SettingsDrawerContextValue = {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const SettingsDrawerContext = createContext<SettingsDrawerContextValue | undefined>(undefined);

type SettingsDrawerProviderProps = {
  children: ReactNode;
};

export function SettingsDrawerProvider({ children }: SettingsDrawerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const value: SettingsDrawerContextValue = {
    isOpen,
    openDrawer: () => setIsOpen(true),
    closeDrawer: () => setIsOpen(false),
  };

  return <SettingsDrawerContext.Provider value={value}>{children}</SettingsDrawerContext.Provider>;
}

// Hook de lecture/écriture, seul point d'accès à l'état du drawer — lève une
// erreur explicite si utilisé hors d'un <SettingsDrawerProvider> plutôt que
// de renvoyer silencieusement des valeurs par défaut trompeuses (même
// convention que useSucces()/useProfile()).
export function useSettingsDrawer(): SettingsDrawerContextValue {
  const context = useContext(SettingsDrawerContext);
  if (context === undefined) {
    throw new Error('useSettingsDrawer() doit être appelé à l’intérieur d’un <SettingsDrawerProvider>.');
  }
  return context;
}
