import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

export default function ExercisesScreen() {
  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Exercices</Text>
      <Text style={theme.text.subtitle}>Les exercices de piano seront bientôt disponibles.</Text>
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
});
