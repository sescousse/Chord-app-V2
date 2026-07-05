import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Piano App</Text>
      <Text style={styles.subtitle}>Bienvenue ! Tes cours et exercices apparaîtront ici.</Text>
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
