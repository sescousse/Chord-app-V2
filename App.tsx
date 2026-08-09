import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppStack from './src/navigation/AppStack';
import AuthStack from './src/navigation/AuthStack';
import { navigationRef } from './src/navigation/navigationRef';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ProfileProvider } from './src/context/ProfileContext';
import { SuccesProvider } from './src/context/SuccesContext';
import { QuetesProvider } from './src/context/QuetesContext';
import { SettingsDrawerProvider } from './src/context/SettingsDrawerContext';
import { SuccesCelebrationOverlay } from './src/components/SuccesCelebrationOverlay';
import { SettingsDrawer } from './src/components/SettingsDrawer';
import { theme } from './src/theme';

// AIGUILLAGE CONDITIONNEL — enveloppe la navigation EXISTANTE (AppStack,
// inchangée dans son principe) plutôt que de la réécrire : ce composant
// choisit juste LEQUEL des deux navigateurs racine afficher, selon l'état
// d'auth lu via useAuth() (voir AuthContext.tsx) :
// - isLoading (vérification de session en cours, au tout premier lancement
//   de l'app) → spinner plein écran, pour éviter un flash de l'écran de
//   connexion avant même de savoir si une session existait déjà.
// - user connu → AppStack (les onglets Accueil/Exercices/Profil, INCHANGÉS,
//   PLUS les écrans du menu réglages — voir AppStack.tsx, qui remplace ici
//   RootNavigator direct depuis l'ajout du drawer réglages).
// - user === null → AuthStack (SignIn/SignUp).
// Aucune navigation manuelle nécessaire pour basculer de l'un à l'autre :
// AuthContext met "user" à jour tout seul dès qu'une connexion/inscription/
// déconnexion aboutit (onAuthStateChange), ce qui refait juste re-render ce
// composant avec la bonne branche.
function RootNavigation() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return user ? <AppStack /> : <AuthStack />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* AuthProvider tout en haut, au-dessus de NavigationContainer : c'est
          ce qui rend useAuth() disponible dans RootNavigation ci-dessus (et,
          plus tard, dans n'importe quel écran de l'app qui en aurait besoin). */}
      <AuthProvider>
        {/* ProfileProvider SOUS AuthProvider (dépend de useAuth(), voir
            ProfileContext.tsx) et AU-DESSUS de NavigationContainer : rend
            useProfile() disponible à tous les écrans de la navigation
            (HomeScreen, ProfileScreen...), comme useAuth() déjà. */}
        <ProfileProvider>
          {/* SuccesProvider SOUS ProfileProvider (dépend de useProfile(),
              pour addXp — voir SuccesContext.tsx) : rend useSucces()
              disponible à tous les écrans, comme useAuth()/useProfile()
              déjà. */}
          <SuccesProvider>
            {/* QuetesProvider SOUS ProfileProvider (dépend de useProfile(),
                pour addXp — récompense d'une quête complétée) : rend
                useQuetes() disponible à tous les écrans, comme useSucces()
                déjà. Doit être un ENFANT de ProfileProvider, jamais l'inverse
                (voir le commentaire "POURQUOI ICI" dans QuetesContext.tsx) :
                c'est cette contrainte d'arbre qui empêche addXp lui-même
                d'appeler avancerQuete, et donc la boucle de farming XP que ça
                créerait. */}
            <QuetesProvider>
              {/* SettingsDrawerProvider AU-DESSUS de NavigationContainer : le
                  menu réglages (SettingsDrawer, sibling ci-dessous) et le
                  bouton qui l'ouvre (engrenage de ProfileScreen, profondément
                  imbriqué DANS la navigation) doivent tous les deux pouvoir
                  lire/écrire ce même état — voir SettingsDrawerContext.tsx. */}
              <SettingsDrawerProvider>
                {/* ref={navigationRef} : permet à SettingsDrawer.tsx de
                    naviguer vers un écran placeholder alors qu'il est rendu EN
                    DEHORS de cet arbre de navigation (voir navigationRef.ts). */}
                <NavigationContainer ref={navigationRef}>
                  <RootNavigation />
                  <StatusBar style="auto" />
                </NavigationContainer>
                {/* Frères de NavigationContainer, APRÈS lui : se peignent
                    par-dessus TOUTE la navigation (voir le commentaire détaillé
                    dans SuccesCelebrationOverlay.tsx) — chacun se rend
                    invisible tout seul tant qu'il n'est pas actif. */}
                <SuccesCelebrationOverlay />
                <SettingsDrawer />
              </SettingsDrawerProvider>
            </QuetesProvider>
          </SuccesProvider>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
});
