import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

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
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
