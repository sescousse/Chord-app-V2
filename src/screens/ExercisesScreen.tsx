import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

export default function ExercisesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Exercices</Text>
      <Text style={styles.subtitle}>Les exercices de piano seront bientôt disponibles.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
