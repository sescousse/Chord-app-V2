import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

// Coquille pour l'instant : le contenu réel (cours de référence détaillés)
// n'est pas encore construit, seul l'écran et sa route existent (voir
// CourseStack.tsx, carte "Bibliothèque" de CoursesHubScreen).
export default function LibraryScreen() {
  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Bibliothèque</Text>
      <Text style={styles.text}>Les cours de référence détaillés arriveront ici.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  text: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.regular,
    color: theme.colors.textMuted,
  },
});
