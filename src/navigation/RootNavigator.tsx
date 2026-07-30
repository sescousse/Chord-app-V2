import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

import ExercisesStack from './ExercisesStack';
import CoursesStack from './CourseStack';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors, tabBar } from '../theme';

export type RootTabParamList = {
  Home: undefined;
  Courses: undefined;
  Exercises: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: tabBar,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil' }} />
      {/* headerShown: false ici car CoursesStack a déjà son propre header (sinon deux barres superposées).
          "options" en fonction de la route (plutôt qu'un objet fixe) pour pouvoir masquer la tab bar
          uniquement sur l'écran de leçon plein écran — voir le commentaire sur tabBarStyle plus bas. */}
      <Tab.Screen
        name="Courses"
        component={CoursesStack}
        options={({ route }) => ({
          title: 'Cours',
          headerShown: false,
          // getFocusedRouteNameFromRoute lit le nom de l'écran ACTUELLEMENT
          // affiché à l'intérieur de CoursesStack (le native-stack imbriqué
          // dans cet onglet) — pas le nom de l'onglet lui-même ("Courses").
          // Tant qu'aucune navigation n'a eu lieu dans ce stack, il renvoie
          // undefined (on est alors sur son premier écran, "CoursesList").
          // Quand l'écran affiché est "Lesson" (la route de CourseStackParamList
          // rendue par LessonCourseScreen), on remplace le style normal de la
          // tab bar par { display: 'none' } pour un rendu plein écran ; sur
          // toute autre route du stack (parcours, liste de cours...), on
          // retombe sur le style habituel (tabBar, défini dans le thème) et
          // la tab bar réapparaît automatiquement.
          tabBarStyle:
            getFocusedRouteNameFromRoute(route) === 'Lesson' ? { display: 'none' } : tabBar,
        })}
      />
      {/* headerShown: false ici car ExercisesStack a déjà ses propres headers (sinon deux barres superposées). */}
      <Tab.Screen
        name="Exercises"
        component={ExercisesStack}
        options={{ title: 'Exercices', headerShown: false }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
