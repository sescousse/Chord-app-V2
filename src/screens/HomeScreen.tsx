import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Piano App</Text>
      <Text style={theme.text.subtitle}>Bienvenue ! Tes cours et exercices apparaîtront ici.</Text>
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
