import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

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
    screen: '',
  },
];

export default function ExercisesScreen() {
  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Exercices</Text>

      <View style={styles.list}>
        {/* Un Pressable par exercice, généré à partir du tableau EXERCISES. */}
        {EXERCISES.map((exercise) => (
          <Pressable
            key={exercise.id}
            style={styles.card}
            onPress={() => console.log(exercise.title)}
          >
            <View style={[styles.accentDot, { backgroundColor: exercise.accentColor }]} />
            <Text style={styles.cardTitle}>{exercise.title}</Text>
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backGroundExercice,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    // Pas d'épaisseur de bordure définie dans le thème : voir le message ci-contre.
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  accentDot: {
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    borderRadius: theme.radius.xl,
  },
  cardTitle: {
    flex: 1,
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
});
