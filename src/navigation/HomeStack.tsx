import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import LessonCourseScreen from '../screens/LessonCourseScreen';
import BoutiqueJetonsScreen from '../screens/BoutiqueJetonsScreen';
import { colors } from '../theme';
import type { Lesson } from '../dataset/courseTheorie';

// Pile de l'onglet Accueil. "HomeMain" est l'écran d'accueil complet
// (bannière Parcours/Bibliothèque/Compétences/Profil, voir HomeScreen.tsx).
// "CourseParcoursScreen" n'a PAS sa propre route ici : la bannière l'affiche
// comme un simple composant enfant DANS HomeMain (voir le commentaire sur ce
// choix dans HomeScreen.tsx), pas via une navigation — c'est pourquoi elle
// n'apparaît pas dans HomeStackParamList. "Lesson", en revanche, est une
// VRAIE route de pile : l'écran plein écran ouvert PAR-DESSUS HomeMain
// quand on tape une leçon depuis l'onglet bannière "Parcours".
//
// "UserProfile" (profil d'un autre utilisateur) vivait ici quand "Social"
// était un onglet de la bannière de l'accueil — Social a maintenant son
// propre onglet dans la barre du bas, avec sa propre pile dédiée (voir
// SocialStack.tsx), donc cette route n'a plus sa place ici.
export type HomeStackParamList = {
  HomeMain: undefined;
  Lesson: { lesson: Lesson };
  // Ouvert depuis l'icône jetons du header d'accueil (voir HomeScreen.tsx) —
  // placeholder pour l'instant (voir BoutiqueJetonsScreen.tsx).
  BoutiqueJetons: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
  return (
    <Stack.Navigator initialRouteName="HomeMain" screenOptions={{ headerTintColor: colors.text }}>
      {/* headerShown: false : HomeScreen affiche sa propre bannière de
          sous-navigation en haut (voir HomeScreen.tsx), un header natif
          par-dessus ferait doublon. */}
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      {/* headerShown: false : écran de leçon plein écran/immersif (façon
          Duolingo) — voir aussi RootNavigator.tsx, qui masque la tab bar du
          bas pour cette même route "Lesson". */}
      <Stack.Screen
        name="Lesson"
        component={LessonCourseScreen}
        options={({ route }) => ({ title: route.params.lesson.title, headerShown: false })}
      />
      {/* Header natif par défaut ici (title + retour, comme les écrans
          placeholder du menu réglages dans AppStack.tsx) : contenu simple,
          pas besoin d'un header maison. */}
      <Stack.Screen
        name="BoutiqueJetons"
        component={BoutiqueJetonsScreen}
        options={{ title: 'Boutique' }}
      />
    </Stack.Navigator>
  );
}
