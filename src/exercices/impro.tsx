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
  { label: 'Espoir', value: 'hopeful' },
  { label: 'Nostalgique', value: 'nostalgic' },
  { label: 'Romantique', value: 'romantic' },
];

export default function ImproScreen() {
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);

  // PRÉPARATION : on filtre les progressions selon l'émotion choisie.
  const filteredProgressions = PROGRESSIONS.filter(
    (progression) => progression.emotion === selectedEmotion
  );

  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Choisit ton emotion</Text>

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
              <Text style={styles.moodLabel} numberOfLines={1}>{mood.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* AFFICHAGE des progressions : séparé, après les boutons. */}
      <Text style={theme.text.subtitle}>
        {selectedEmotion
          ? 'Voici les progressions correspondant à ton humeur :'
          : 'Ici s\'afficheront les progressions'}
      </Text>
      {filteredProgressions.length > 0 ? (
        <View style={styles.progressionRow}>
          {filteredProgressions.map((progression, index) => (
            <Text key={index} style={theme.text.progressionText}>
              {progression.degrees.join(' - ')}{'   '}{progression.gamme}
            </Text>
          ))}
        </View>
      ) : selectedEmotion ? (
        <Text style={theme.text.subtitle}>Aucune progression trouvée</Text>
      ) : null}
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  progressionRow: {
    alignSelf: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.backGroundExercice,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.lg,
  },
  moodButton: {
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
