import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

export default function CoursesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cours</Text>
      <Text style={styles.subtitle}>La liste des cours sera bientôt disponible.</Text>
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
