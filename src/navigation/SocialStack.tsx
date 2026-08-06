import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SocialScreen from '../screens/SocialScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import SearchUsersScreen from '../screens/SearchUsersScreen';
import { colors } from '../theme';

// Pile de l'onglet Social (barre du bas, voir RootNavigator.tsx).
// "SocialMain" est l'annuaire en bulles (SocialScreen.tsx). "UserProfile" et
// "SearchUsers" sont de VRAIES routes de pile : des écrans plein écran
// ouverts PAR-DESSUS SocialMain (profil d'un utilisateur ; recherche par
// nom, ouverte depuis la bulle "+" de SocialScreen) — SocialScreen en
// hérite via useNavigation() puisqu'il est l'écran initial de CETTE pile.
//
// UserProfileScreen vivait avant dans HomeStack (quand Social était un
// onglet de la bannière de l'accueil) : maintenant que Social a son propre
// onglet en bas, ce composant est enregistré ICI à la place — un même
// composant PEUT être enregistré comme route de piles différentes, rien à
// changer côté UserProfileScreen.tsx à part son type de route (voir ce
// fichier).
export type SocialStackParamList = {
  SocialMain: undefined;
  UserProfile: { userId: string };
  SearchUsers: undefined;
};

const Stack = createNativeStackNavigator<SocialStackParamList>();

export default function SocialStack() {
  return (
    <Stack.Navigator initialRouteName="SocialMain" screenOptions={{ headerTintColor: colors.text }}>
      {/* headerShown: false : SocialScreen affiche déjà son propre titre
          "Social" dans son contenu (voir SocialScreen.tsx), pas besoin du
          header natif par-dessus. */}
      <Stack.Screen name="SocialMain" component={SocialScreen} options={{ headerShown: false }} />
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
