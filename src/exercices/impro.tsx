import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import type { Emotion } from '../dataset/progression';

// Les deux boutons affichés pour cette étape statique. `emotions` vient du
// fichier de données existant (src/dataset/progression.ts) : on le réutilise
// déjà pour typer les valeurs, même si le filtrage arrivera plus tard.
const MOODS: { label: string; value: Emotion }[] = [
  { label: 'Joyeux', value: 'happy' },
  { label: 'Triste', value: 'sad' },
];

export default function ImproScreen() {
  // Mémorise l'émotion choisie. `null` tant qu'on n'a rien sélectionné.
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);

  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Improvisation</Text>

      <View style={styles.moodRow}>
        {MOODS.map((mood) => {
          const isSelected = mood.value === selectedEmotion;
          return (
            <Pressable
              key={mood.value}
              // Au clic, on remplace le state par la valeur du bouton pressé.
              style={[styles.moodButton, isSelected && styles.moodButtonSelected]}
              onPress={() => setSelectedEmotion(mood.value)}
            >
              <Text style={styles.moodLabel}>{mood.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Affichage conditionnel selon la valeur du state. */}
      <Text style={theme.text.subtitle}>
        {selectedEmotion ? `Émotion choisie : ${selectedEmotion}` : 'Choisis une émotion'}
      </Text>
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
  moodRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  moodButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    // Même remarque que pour ExercisesScreen : pas d'épaisseur de bordure dans le thème.
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  // Style appliqué en plus quand le bouton correspond au state sélectionné.
  moodButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  moodLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
});
