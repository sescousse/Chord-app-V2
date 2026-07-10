import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

export default function CoursesScreen() {
  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Cours</Text>
      <Text style={theme.text.subtitle}>La liste des cours sera bientôt disponible.</Text>
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
