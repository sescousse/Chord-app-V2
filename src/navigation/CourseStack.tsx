import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ImproScreen from '../exercices/impro';
import CoursesScreen from '../screens/CoursesScreen';
import CoursesHubScreen from '../screens/CoursesHubScreen';
import LibraryScreen from '../screens/LibraryScreen';
import CourseParcoursScreen from '../screens/CourseParcoursScreen';
import LessonCourseScreen from '../screens/LessonCourseScreen';
import { colors } from '../theme';
import type { Lesson } from '../dataset/courseTheorie';

export type CourseStackParamList = {
  // Écran d'aiguillage, désormais la base de la pile (voir "initialRouteName"
  // sur le Stack.Navigator plus bas) : 2 cartes, "Parcours" (→ CoursesList,
  // l'écran existant ci-dessous, inchangé) et "Bibliothèque" (→ Library,
  // nouvelle coquille).
  CoursesHub: undefined;
  // Écran EXISTANT (cours groupés par niveau) : ni son nom de route, ni son
  // component, ni son fonctionnement ne changent — seul son accès change
  // (avant : écran de base ; maintenant : atteint depuis CoursesHub via la
  // carte "Parcours"). Toute la suite de la pile (CourseParcours, Lesson...)
  // continue de fonctionner à l'identique depuis cet écran.
  CoursesList: undefined;
  Degrés: undefined;
  Gammes: undefined;
  // Unité 1 fixe pour l'instant : un seul parcours existe, pas besoin de
  // paramètre pour identifier "quelle unité" afficher.
  CourseParcours: undefined;
  // La leçon complète (objet Lesson, pas juste son id) est passée en
  // paramètre : voir le commentaire dans LessonCourseScreen.tsx pour le
  // détail de ce choix.
  Lesson: { lesson: Lesson };
  // Coquille pour l'instant (voir LibraryScreen.tsx) : le contenu réel de la
  // bibliothèque n'est pas construit ici, seule la route existe.
  Library: undefined;
};

const Stack = createNativeStackNavigator<CourseStackParamList>();

export default function CoursesStack() {
  return (
    <Stack.Navigator
      // CoursesHub devient l'écran de base de la pile (celui affiché quand on
      // ouvre l'onglet Cours). "initialRouteName" le fixe explicitement,
      // plutôt que de dépendre uniquement de l'ordre des Stack.Screen
      // ci-dessous (qui le fait déjà, puisqu'il est déclaré en premier) : ça
      // reste correct même si l'ordre du JSX changeait plus tard.
      initialRouteName="CoursesHub"
      screenOptions={{
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="CoursesHub"
        component={CoursesHubScreen}
        options={{ title: 'Cours' }}
      />
      {/* Écran EXISTANT (cours groupés par niveau), inchangé à part son titre
          d'en-tête : "Cours" est repris par CoursesHub ci-dessus (nouvel écran
          de base), donc ce titre passe à "Parcours" pour rester cohérent avec
          la carte qui y mène — et ne pas afficher "Cours" deux fois de suite
          dans la pile. */}
      <Stack.Screen
        name="CoursesList"
        component={CoursesScreen}
        options={{ title: 'Parcours' }}
      />
      <Stack.Screen name="Degrés" component={ImproScreen} options={{ title: 'Degrés' }} />
      <Stack.Screen name="Gammes" component={ImproScreen} options={{ title: 'Gammes' }} />
      <Stack.Screen
        name="CourseParcours"
        component={CourseParcoursScreen}
        options={{ title: 'Unité 1' }}
      />
      <Stack.Screen
        name="Lesson"
        component={LessonCourseScreen}
        // "options" en fonction de la route (plutôt qu'un objet fixe) pour
        // afficher le vrai titre de la leçon reçue en paramètre dans l'en-tête.
        // headerShown: false car LessonCourseScreen doit s'afficher plein
        // écran (immersif, façon Duolingo) : pas de header ici — voir aussi
        // RootNavigator.tsx qui masque la tab bar du bas pour cette même
        // route ("Lesson").
        options={({ route }) => ({ title: route.params.lesson.title, headerShown: false })}
      />
      {/* Coquille pour l'instant (voir LibraryScreen.tsx). */}
      <Stack.Screen
        name="Library"
        component={LibraryScreen}
        options={{ title: 'Bibliothèque' }}
      />
    </Stack.Navigator>
  );
}
