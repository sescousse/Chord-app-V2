import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import { PROGRESSIONS, type Emotion } from '../dataset/progression';

// Les deux boutons affichés pour cette étape statique. `emotions` vient du
// fichier de données existant (src/dataset/progression.ts) : on le réutilise
// déjà pour typer les valeurs, même si le filtrage arrivera plus tard.
const MOODS: { label: string; value: Emotion }[] = [
  { label: 'Joyeux', value: 'happy' },
  { label: 'Triste', value: 'sad' },   // sert a nommer les valeurs happy/sad 
];

export default function ImproScreen() {
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);

  // PRÉPARATION : on filtre les progressions selon l'émotion choisie.
  const filteredProgressions = PROGRESSIONS.filter(
    (progression) => progression.emotion === selectedEmotion
  );

  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Improvisation</Text>

      {/* Les boutons : leur .map ne s'occupe QUE des boutons. */}
      <View style={styles.moodRow}>
        {MOODS.map((mood) => {
          const isSelected = mood.value === selectedEmotion;
          return (
            <Pressable
              key={mood.value}
              style={[styles.moodButton, isSelected && styles.moodButtonSelected]}
              onPress={() => setSelectedEmotion(mood.value)}
            >
              <Text style={styles.moodLabel}>{mood.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* AFFICHAGE des progressions : séparé, après les boutons. */}
      {filteredProgressions.length > 0 ? (
        filteredProgressions.map((progression, index) => (
          <Text key={index} style={theme.text.subtitle}>
            {progression.degrees.join(' - ')}
          </Text>
        ))
      ) : (
        <Text style={theme.text.subtitle}>
          {selectedEmotion ? 'Aucune progression trouvée' : 'Choisis une émotion'}
        </Text>
      )}
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
