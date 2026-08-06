import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import ExercisesStack from './ExercisesStack';
import HomeStack from './HomeStack';
import SocialStack from './SocialStack';
import { colors, tabBar } from '../theme';

// Les onglets "Cours" et "Profil" ont été retirés (voir HomeStack.tsx /
// HomeScreen.tsx) : leur contenu (Parcours, Bibliothèque, et maintenant
// Profil) est désormais accessible depuis la bannière de sous-navigation de
// l'accueil (onglets Parcours / Bibliothèque / Compétences / Profil).
//
// "Social" (annuaire en bulles), lui, vivait dans cette même bannière et en
// est retiré ICI (voir HomeScreen.tsx) pour rejoindre la barre du bas — un
// seul chemin vers cet écran, pas deux.
export type RootTabParamList = {
  Home: undefined;
  Exercises: undefined;
  Social: undefined;
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
          // automatiquement. Ce masquage est spécifique à CET onglet (ses
          // "options" ne s'appliquent que quand Home est focus) : ouvrir
          // l'onglet Social par-dessus n'y change rien, voir plus bas.
          tabBarStyle:
            getFocusedRouteNameFromRoute(route) === 'Lesson' ? { display: 'none' } : tabBar,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        })}
      />
      {/* headerShown: false ici car ExercisesStack a déjà ses propres headers (sinon deux barres superposées). */}
      <Tab.Screen
        name="Exercises"
        component={ExercisesStack}
        options={{
          title: 'Exercices',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'musical-notes' : 'musical-notes-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      {/* headerShown: false ici car SocialStack a déjà son propre header par écran (voir SocialStack.tsx). */}
      <Tab.Screen
        name="Social"
        component={SocialStack}
        options={{
          title: 'Social',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
