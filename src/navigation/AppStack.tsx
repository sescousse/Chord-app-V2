import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RootNavigator from './RootNavigator';
import PlaceholderScreen, { type PlaceholderParams } from '../screens/PlaceholderScreen';
import { colors } from '../theme';

// Pile RACINE de l'app (voir App.tsx, qui rend <AppStack /> au lieu de
// <RootNavigator /> directement) — AU-DESSUS de RootNavigator (les onglets
// Accueil/Exercices/Profil, INCHANGÉ) : nécessaire pour donner un "chez-soi"
// dans la navigation aux 7 écrans PLACEHOLDER du menu réglages (voir
// SettingsDrawer.tsx), qui ne sont pas des onglets et n'ont pas leur place
// dans un des Stack existants (HomeStack/ExercisesStack/SocialStack).
//
// Chaque écran placeholder a son PROPRE header natif (title + bouton retour
// automatique fourni par le Stack — comportement par défaut, pas besoin de
// le régler explicitement), contrairement à "MainTabs" (headerShown: false,
// RootNavigator gère déjà toute SA chrome lui-même).
//
// PlaceholderParams vit maintenant dans PlaceholderScreen.tsx (source
// canonique, importée ci-dessus) : ExercisesStack.tsx en a aussi besoin pour
// sa propre route "ComingSoon", pas de raison de la dupliquer ici.
export type AppStackParamList = {
  MainTabs: undefined;
  // Section "Compte"
  Preferences: PlaceholderParams;
  ProfileSettings: PlaceholderParams;
  Notifications: PlaceholderParams;
  PrivacySettings: PlaceholderParams;
  // Section "Abonnement"
  ManageSubscription: PlaceholderParams;
  // Section "Assistance"
  HelpCenter: PlaceholderParams;
  Feedback: PlaceholderParams;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.text }}>
      <Stack.Screen name="MainTabs" component={RootNavigator} options={{ headerShown: false }} />

      <Stack.Screen
        name="Preferences"
        component={PlaceholderScreen}
        initialParams={{ titre: 'Préférences' }}
        options={{ title: 'Préférences' }}
      />
      <Stack.Screen
        name="ProfileSettings"
        component={PlaceholderScreen}
        initialParams={{ titre: 'Profil' }}
        options={{ title: 'Profil' }}
      />
      <Stack.Screen
        name="Notifications"
        component={PlaceholderScreen}
        initialParams={{ titre: 'Notifications' }}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="PrivacySettings"
        component={PlaceholderScreen}
        initialParams={{ titre: 'Paramètres de confidentialité' }}
        options={{ title: 'Confidentialité' }}
      />
      <Stack.Screen
        name="ManageSubscription"
        component={PlaceholderScreen}
        initialParams={{ titre: 'Gérer mon abonnement' }}
        options={{ title: 'Abonnement' }}
      />
      <Stack.Screen
        name="HelpCenter"
        component={PlaceholderScreen}
        initialParams={{ titre: "Centre d'aide" }}
        options={{ title: "Centre d'aide" }}
      />
      <Stack.Screen
        name="Feedback"
        component={PlaceholderScreen}
        initialParams={{ titre: 'Remarque' }}
        options={{ title: 'Remarque' }}
      />
    </Stack.Navigator>
  );
}
