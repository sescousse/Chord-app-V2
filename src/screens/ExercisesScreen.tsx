import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ExercisesStackParamList } from '../navigation/ExercisesStack';
import { theme } from '../theme';

// Type du hook de navigation, restreint aux écrans de la pile Exercices.
type ExercisesNavigation = NativeStackNavigationProp<ExercisesStackParamList, 'ExercisesList'>;

// Forme d'une entrée du tableau d'exercices ci-dessous.
type Exercise = {
  id: string;
  title: string;
  accentColor: string;
  screen?: string; // TODO: nom/route de l'écran de destination, à brancher plus tard
};

// Toutes les données des exercices vivent ici. Pour ajouter/retirer un
// exercice, il suffit d'éditer ce tableau : le rendu est généré par .map()
// plus bas, aucun JSX à dupliquer.
const EXERCISES: Exercise[] = [
  {
    id: 'ecoute',
    title: 'Écoute musicale',
    accentColor: theme.colors.exercice, // TODO: remplacer par une couleur dédiée par exercice quand elle existera dans le thème
    screen: '',
  },
  {
    id: 'reproduction',
    title: 'Reproduction à l’oreille',
    accentColor: theme.colors.exercice, // TODO: remplacer par une couleur dédiée par exercice quand elle existera dans le thème
    screen: '',
  },
  {
    id: 'improvisation',
    title: 'Improvisation / Composition',
    accentColor: theme.colors.exercice, // TODO: remplacer par une couleur dédiée par exercice quand elle existera dans le thème
    screen: 'Impro',
  },
];

export default function ExercisesScreen() {
  // Hook de navigation typé sur la pile Exercices (pas de "any").
  const navigation = useNavigation<ExercisesNavigation>();

  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Exercices</Text>

      <View style={styles.list}>
        {/* Un Pressable par exercice, généré à partir du tableau EXERCISES. */}
        {EXERCISES.map((exercise) => (
          <Pressable key={exercise.id} style={theme.card} onPress={() => {
              // Seule la carte avec screen: "Impro" navigue vraiment, les autres restent en console.log.
              if (exercise.screen === 'Impro') {
                navigation.navigate('Impro');
              } else {
                console.log(exercise.title);
              }
            }}
          >
            <View style={[styles.accentDot, { backgroundColor: exercise.accentColor }]} />
            <Text style={theme.cardTitle}>{exercise.title}</Text>
          </Pressable>
        ))}
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
  list: {
    gap: theme.spacing.md,
  },
  accentDot: {
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    borderRadius: theme.radius.xl,
  },
});
