import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import LessonCourseScreen from '../screens/LessonCourseScreen';
import { colors } from '../theme';
import type { Lesson } from '../dataset/courseTheorie';

// Pile de l'onglet Accueil : seulement 2 routes. "HomeMain" est l'écran
// d'accueil complet (bannière Parcours/Bibliothèque/Compétences/Perso, voir
// HomeScreen.tsx). "CourseParcoursScreen" n'a PAS sa propre route ici : la
// bannière l'affiche comme un simple composant enfant DANS HomeMain (voir le
// commentaire sur ce choix dans HomeScreen.tsx), pas via une navigation —
// c'est pourquoi elle n'apparaît pas dans HomeStackParamList. "Lesson", en
// revanche, doit rester une VRAIE route de pile : c'est l'écran plein écran
// ouvert quand on tape une leçon depuis l'onglet bannière "Parcours"
// (CourseParcoursScreen.handleStepPress appelle navigation.navigate('Lesson',
// { lesson }) ; comme ce composant est rendu à l'intérieur de HomeMain, ce
// navigate() atterrit bien dans CETTE pile).
export type HomeStackParamList = {
  HomeMain: undefined;
  Lesson: { lesson: Lesson };
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
    </Stack.Navigator>
  );
}
