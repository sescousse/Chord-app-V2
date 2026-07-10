import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Profil</Text>
      <Text style={theme.text.subtitle}>Ta progression et tes réglages seront bientôt ici.</Text>
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
