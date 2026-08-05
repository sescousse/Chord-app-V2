import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import type { Emotion } from '../dataset/progression';
import type { ExercisesStackParamList } from '../navigation/ExercisesStack';

// Émotions proposées — ancien contenu de improEmotion.tsx (écran supprimé,
// fusionné avec le choix de style dans cette page unique). Exporté pour être
// réutilisé par ResultScreen (rappel du choix "Joyeux · Jazz"), comme avant.
export const MOODS: { label: string; value: Emotion }[] = [
  { label: 'Joyeux', value: 'happy' },
  { label: 'Triste', value: 'sad' },
  { label: 'Espoir', value: 'hopeful' },
  { label: 'Nostalgique', value: 'nostalgic' },
  { label: 'Romantique', value: 'romantic' },
];

// Styles proposés — ancien contenu de improStyle.tsx (écran supprimé, fusionné
// ici). IMPORTANT (inchangé) : le style est seulement mémorisé et transmis à
// ResultScreen, il NE FILTRE PAS les progressions (le champ `style` n'existe
// pas dans Progression) — voir ExercisesStackParamList.ImproResult.style,
// désormais optionnel.
const STYLES = ['Pop', 'Jazz', 'Classique', 'Cinématique'] as const;

type ImproChoicesNavigation = NativeStackNavigationProp<ExercisesStackParamList, 'ImproChoices'>;

// Page unique qui remplace les 2 anciens écrans séparés (choix émotion, puis
// choix style) : les 2 choix vivent ici, dans le MÊME state, et sont transmis
// ENSEMBLE à ImproResult en un seul saut de navigation.
export default function ImproChoicesScreen() {
  const navigation = useNavigation<ImproChoicesNavigation>();

  // Émotion OBLIGATOIRE pour voir les progressions (le filtrage réel de
  // ResultScreen se fait par émotion) : null tant qu'aucune n'est choisie,
  // ce qui désactive le bouton "Voir les progressions" plus bas.
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);

  // Style OPTIONNEL : simplement mémorisé et transmis, ne conditionne PAS
  // l'activation du bouton (contrairement à l'émotion) — l'utilisateur peut
  // voir les progressions sans en choisir un.
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const isReadyToSeeProgressions = selectedEmotion !== null;

  // "?? undefined" convertit "aucun style choisi" (null, notre state local)
  // vers ce qu'attend le param de route ImproResult.style (string |
  // undefined, voir ExercisesStack.tsx) — undefined, pas null, est la
  // convention React Navigation pour "paramètre absent".
  const handleSeeProgressions = () => {
    if (selectedEmotion === null) {
      return;
    }
    navigation.navigate('ImproResult', {
      emotion: selectedEmotion,
      style: selectedStyle ?? undefined,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={theme.text.title}>Choisis ton émotion</Text>
        <View style={styles.optionsRow}>
          {MOODS.map((mood) => {
            const isSelected = mood.value === selectedEmotion;
            return (
              <Pressable
                key={mood.value}
                style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                onPress={() => setSelectedEmotion(mood.value)}
              >
                <Text style={styles.optionLabel} numberOfLines={1}>
                  {mood.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={theme.text.title}>Choisis ton style</Text>
        <View style={styles.optionsRow}>
          {STYLES.map((style) => {
            const isSelected = style === selectedStyle;
            return (
              <Pressable
                key={style}
                style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                onPress={() => setSelectedStyle(style)}
              >
                <Text style={styles.optionLabel} numberOfLines={1}>
                  {style}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Désactivé (disabled + style grisé) tant qu'aucune émotion n'est
          choisie — voir isReadyToSeeProgressions. Le style, lui, n'est
          jamais requis. */}
      <Pressable
        style={[styles.seeButton, !isReadyToSeeProgressions && styles.seeButtonDisabled]}
        onPress={handleSeeProgressions}
        disabled={!isReadyToSeeProgressions}
      >
        <Text style={styles.seeButtonLabel}>Voir les progressions</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  section: {
    gap: theme.spacing.md,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  optionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  // Même convention que degreeChip/levelButton/modeButton ailleurs dans
  // l'app pour un état "sélectionné" : fond plein en couleur d'accent.
  optionButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  optionLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  seeButton: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  // Désactivé tant qu'aucune émotion n'est choisie : reprend
  // theme.colors.locked, le même gris neutre déjà utilisé pour les étapes
  // verrouillées du parcours (voir CourseParcoursScreen) — un vrai token de
  // couleur plutôt qu'une opacité réduite improvisée.
  seeButtonDisabled: {
    backgroundColor: theme.colors.locked,
  },
  // Pas de token "texte sur fond coloré" dans le thème : blanc en dur, comme
  // déjà fait ailleurs pour ce même besoin (ex: LessonCourseScreen,
  // CourseParcoursScreen).
  seeButtonLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
});
