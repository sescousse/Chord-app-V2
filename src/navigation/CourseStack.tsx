import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ImproScreen from '../exercices/impro';
import CoursesScreen from '../screens/CoursesScreen';
import CourseParcoursScreen from '../screens/CourseParcoursScreen';
import LessonScreen from '../screens/LessonScreen';
import { colors } from '../theme';
import type { Lesson } from '../dataset/courseTheorie';

export type CourseStackParamList = {
  CoursesList: undefined;
  Degrés: undefined;
  Gammes: undefined;
  // Unité 1 fixe pour l'instant : un seul parcours existe, pas besoin de
  // paramètre pour identifier "quelle unité" afficher.
  CourseParcours: undefined;
  // La leçon complète (objet Lesson, pas juste son id) est passée en
  // paramètre : voir le commentaire dans LessonScreen.tsx pour le détail de
  // ce choix.
  Lesson: { lesson: Lesson };
};

const Stack = createNativeStackNavigator<CourseStackParamList>();

export default function CoursesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="CoursesList"
        component={CoursesScreen}
        options={{ title: 'Cours' }}
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
        component={LessonScreen}
        // "options" en fonction de la route (plutôt qu'un objet fixe) pour
        // afficher le vrai titre de la leçon reçue en paramètre dans l'en-tête.
        options={({ route }) => ({ title: route.params.lesson.title })}
      />
    </Stack.Navigator>
  );
}
