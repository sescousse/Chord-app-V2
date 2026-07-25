import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { theme } from '../theme';
import type { CourseStackParamList } from '../navigation/CourseStack';

// NativeStackScreenProps<CourseStackParamList, 'Lesson'> type à la fois
// "navigation" (pour naviguer depuis cet écran, inutilisé ici) et "route"
// (les infos de la route actuelle, dont ses paramètres). CourseParcoursScreen
// appelle navigation.navigate('Lesson', { lesson }) : React Navigation
// stocke cet objet "{ lesson }" tel quel dans route.params, et le typage
// CourseStackParamList['Lesson'] = { lesson: Lesson } (voir CourseStack.tsx)
// garantit ici que route.params.lesson est bien une Lesson complète — pas
// besoin d'aller la rechercher ailleurs par id, elle voyage avec la
// navigation.
type LessonScreenProps = NativeStackScreenProps<CourseStackParamList, 'Lesson'>;

export default function LessonScreen({ route }: LessonScreenProps) {
  const { lesson } = route.params;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={theme.text.title}>{lesson.title}</Text>

      {/* Un bloc par entrée de lesson.blocks, dans l'ordre reçu : aucun JSX
          de bloc n'est dupliqué, .map() s'en charge. */}
      {lesson.blocks.map((block) => (
        <View key={block.heading} style={styles.block}>
          <Text style={styles.blockHeading}>
            {block.icon} {block.heading}
          </Text>
          <Text style={styles.blockText}>{block.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  // Pas de token "carte de contenu" neutre dans le thème pour ce cas (theme.card
  // est spécifiquement stylé pour les lignes de liste avec pastille — voir
  // CoursesScreen) : ce style est donc composé à partir des tokens existants
  // (couleurs/espacements/rayons), sans aucune valeur en dur.
  block: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  blockHeading: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  blockText: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.regular,
    color: theme.colors.text,
  },
});
