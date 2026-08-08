import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import AuthStack from './src/navigation/AuthStack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ProfileProvider } from './src/context/ProfileContext';
import { SuccesProvider } from './src/context/SuccesContext';
import { SuccesCelebrationOverlay } from './src/components/SuccesCelebrationOverlay';
import { theme } from './src/theme';

// AIGUILLAGE CONDITIONNEL — enveloppe la navigation EXISTANTE (RootNavigator,
// inchangé) plutôt que de la réécrire : ce composant choisit juste LEQUEL
// des deux navigateurs racine afficher, selon l'état d'auth lu via useAuth()
// (voir AuthContext.tsx) :
// - isLoading (vérification de session en cours, au tout premier lancement
//   de l'app) → spinner plein écran, pour éviter un flash de l'écran de
//   connexion avant même de savoir si une session existait déjà.
// - user connu → RootNavigator (l'app normale, onglets Accueil/Exercices...).
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

  return user ? <RootNavigator /> : <AuthStack />;
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
            <NavigationContainer>
              <RootNavigation />
              <StatusBar style="auto" />
            </NavigationContainer>
            {/* Frère de NavigationContainer, APRÈS lui : se peint par-dessus
                TOUTE la navigation (voir le commentaire détaillé dans
                SuccesCelebrationOverlay.tsx) — se rend invisible tout seul
                tant qu'aucun succès n'est en cours de célébration. */}
            <SuccesCelebrationOverlay />
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
