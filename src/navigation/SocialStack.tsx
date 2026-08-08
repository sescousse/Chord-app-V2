import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ProfileScreen from '../screens/ProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import SearchUsersScreen from '../screens/SearchUsersScreen';
import { colors } from '../theme';

// Pile de l'onglet du bas anciennement "Social", maintenant affiché comme
// "Profil" (voir RootNavigator.tsx) — les noms internes ("SocialStack",
// "SocialMain" ci-dessous) sont restés tels quels, seul le libellé visible
// de l'onglet a changé : renommer ces identifiants n'apportait rien de
// fonctionnel, juste plus de fichiers à toucher pour le même résultat.
//
// "SocialMain" est maintenant MA page profil personnelle (ProfileScreen.tsx,
// qui inclut désormais le bloc "Ajouter des amis" — l'ancien SocialScreen.tsx
// a été supprimé, sa page a été absorbée dans ProfileScreen). "UserProfile"
// et "SearchUsers" sont de VRAIES routes de pile : des écrans plein écran
// ouverts PAR-DESSUS SocialMain (profil d'un AUTRE utilisateur ; recherche
// par nom, ouverte depuis la bulle "+" de ProfileScreen) — ProfileScreen en
// hérite via useNavigation() puisqu'il est l'écran initial de CETTE pile.
export type SocialStackParamList = {
  SocialMain: undefined;
  UserProfile: { userId: string };
  SearchUsers: undefined;
};

const Stack = createNativeStackNavigator<SocialStackParamList>();

export default function SocialStack() {
  return (
    <Stack.Navigator initialRouteName="SocialMain" screenOptions={{ headerTintColor: colors.text }}>
      {/* headerShown: false : ProfileScreen a son propre en-tête (nom +
          actions + personnage, voir ProfileScreen.tsx), pas besoin du header
          natif par-dessus. */}
      <Stack.Screen name="SocialMain" component={ProfileScreen} options={{ headerShown: false }} />
      {/* Header natif par défaut ici (comme avant dans HomeStack.tsx) :
          contenu simple, une flèche retour standard suffit. */}
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profil' }} />
      <Stack.Screen
        name="SearchUsers"
        component={SearchUsersScreen}
        options={{ title: 'Rechercher' }}
      />
    </Stack.Navigator>
  );
}
