import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import type { ExercisesStackParamList } from '../navigation/ExercisesStack';

// Type du hook de navigation, restreint aux écrans de la pile Exercices.
type ImproMenuNavigation = NativeStackNavigationProp<ExercisesStackParamList, 'ImproMenu'>;

export default function ImproMenuScreen() {
  const navigation = useNavigation<ImproMenuNavigation>();

  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Improvisation</Text>
      <Text style={theme.text.subtitle}>Choisis comment tu veux travailler tes accords.</Text>

      <View style={styles.menu}>
        <Pressable style={styles.menuButton} onPress={() => navigation.navigate('Impro')}>
          <Text style={styles.menuLabel}>Improvisation libre</Text>
        </Pressable>
        <Pressable style={styles.menuButton} onPress={() => navigation.navigate('Creation')}>
          <Text style={styles.menuLabel}>Crée ta progression</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  menu: {
    gap: theme.spacing.md,
  },
  menuButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  menuLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
});
