import { createNavigationContainerRef } from '@react-navigation/native';

import type { AppStackParamList } from './AppStack';

// Réf partagée vers le NavigationContainer (voir App.tsx, prop "ref" du
// NavigationContainer) — nécessaire pour naviguer depuis SettingsDrawer.tsx,
// qui est rendu EN DEHORS de l'arbre de navigation (comme
// SuccesCelebrationOverlay, frère du NavigationContainer) et n'a donc pas
// accès au hook useNavigation() normal. C'est le mécanisme standard de React
// Navigation pour "naviguer sans prop navigation" : navigationRef.navigate()
// fonctionne exactement comme navigation.navigate() une fois le container
// prêt (voir isReady() plus bas).
export const navigationRef = createNavigationContainerRef<AppStackParamList>();
