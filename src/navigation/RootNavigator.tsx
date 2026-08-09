import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import ExercisesStack from './ExercisesStack';
import HomeStack from './HomeStack';
import SocialStack from './SocialStack';
import QuetesScreen from '../screens/QuetesScreen';
import { colors, tabBar } from '../theme';

// L'onglet "Cours" a été retiré (voir HomeStack.tsx / HomeScreen.tsx) : son
// contenu (Parcours, Bibliothèque) est désormais accessible depuis la
// bannière de sous-navigation de l'accueil (Parcours / Bibliothèque /
// Compétences).
//
// "Social" (annuaire en bulles) et "Profil" (mon profil personnel) vivaient
// tous les deux ailleurs (bannière de l'accueil pour Profil, cet onglet-ci
// pour Social) et sont maintenant FUSIONNÉS ici, dans une seule page (voir
// ProfileScreen.tsx, qui inclut désormais le bloc "Ajouter des amis") — d'où
// le libellé/l'icône "Profil" ci-dessous. La clé de route "Social" et le nom
// du fichier SocialStack.tsx, eux, sont restés inchangés (identifiants
// internes seulement, voir le commentaire dans SocialStack.tsx) : les
// renommer n'aurait rien changé pour l'utilisateur, juste plus de fichiers à
// toucher pour le même résultat.
export type RootTabParamList = {
  Home: undefined;
  Exercises: undefined;
  // Onglet "Quêtes" (façon Duolingo) : pas de pile dédiée pour l'instant,
  // QuetesScreen n'a aucune sous-navigation (voir QuetesScreen.tsx) — un
  // Stack à un seul écran n'aurait rien apporté de plus.
  Quetes: undefined;
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
      {/* headerShown: false ici car ExercisesStack a déjà ses propres headers
          (sinon deux barres superposées). title "Apprentissage" (renommé
          depuis "Exercices" — la page a été refondue en 4 sections
          Jouer/S'entraîner/Écouter/Apprendre, voir ExercisesScreen.tsx) :
          seul le libellé visible change, la clé de route "Exercises" et le
          nom du fichier ExercisesStack.tsx restent inchangés (identifiants
          internes seulement), même convention que "Social" → "Profil". */}
      <Tab.Screen
        name="Exercises"
        component={ExercisesStack}
        options={{
          title: 'Apprentissage',
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
      {/* headerShown: false ici car QuetesScreen gère lui-même sa safe area
          (voir QuetesScreen.tsx), comme les autres onglets — pas de header
          natif par-dessus. */}
      <Tab.Screen
        name="Quetes"
        component={QuetesScreen}
        options={{
          title: 'Quêtes',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={size} color={color} />
          ),
        }}
      />
      {/* headerShown: false ici car SocialStack a déjà son propre header par
          écran (voir SocialStack.tsx). title/icône "Profil" : cet onglet
          affiche maintenant ma page profil personnelle (fusionnée avec
          l'ancienne page Social, voir ProfileScreen.tsx) — seul le libellé
          visible change, la route reste "Social" en interne. */}
      <Tab.Screen
        name="Social"
        component={SocialStack}
        options={{
          title: 'Profil',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person-circle' : 'person-circle-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
