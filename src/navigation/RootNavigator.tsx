import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

import ExercisesStack from './ExercisesStack';
import HomeStack from './HomeStack';
import { colors, tabBar } from '../theme';

// Les onglets "Cours" et "Profil" ont été retirés (voir HomeStack.tsx /
// HomeScreen.tsx) : leur contenu (Parcours, Bibliothèque, et maintenant
// Profil) est désormais accessible depuis la bannière de sous-navigation de
// l'accueil (onglets Parcours / Bibliothèque / Compétences / Profil). La
// barre du bas ne garde donc plus que ces 2 onglets.
export type RootTabParamList = {
  Home: undefined;
  Exercises: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTintColor: colors.background,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.background,
        tabBarStyle: tabBar,
      }}
    >
      {/* headerShown: false ici car HomeStack a déjà son propre header par
          écran (HomeMain n'en affiche pas du tout, voir HomeStack.tsx) —
          sinon deux barres superposées. "options" en fonction de la route
          (plutôt qu'un objet fixe) pour masquer la tab bar uniquement sur
          l'écran de leçon plein écran — voir le commentaire sur tabBarStyle
          plus bas. Ce mécanisme vivait avant sur l'onglet "Cours" (retiré) :
          il est rebranché ici tel quel, puisque "Lesson" est maintenant une
          route de HomeStack (ouverte depuis l'onglet bannière "Parcours" de
          HomeScreen). */}
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={({ route }) => ({
          title: 'Accueil',
          headerShown: false,
          // getFocusedRouteNameFromRoute lit le nom de l'écran ACTUELLEMENT
          // affiché à l'intérieur de HomeStack (le native-stack imbriqué
          // dans cet onglet) — pas le nom de l'onglet lui-même ("Home").
          // Tant qu'aucune navigation n'a eu lieu dans ce stack, il renvoie
          // undefined (on est alors sur son premier écran, "HomeMain").
          // Quand l'écran affiché est "Lesson" (la leçon plein écran), on
          // remplace le style normal de la tab bar par { display: 'none' }
          // pour un rendu plein écran ; sur "HomeMain" (accueil, quel que
          // soit l'onglet actif de sa bannière), on retombe sur le style
          // habituel (tabBar, défini dans le thème) et la tab bar réapparaît
          // automatiquement.
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
    </Tab.Navigator>
  );
}
