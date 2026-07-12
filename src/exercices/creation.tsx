import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

// Palette des degrés proposés. Modifie ce tableau pour ajouter/retirer des boutons.
const MAJEUR: string[] = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'];
const MINEURNAT: string[] = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

type ScaleChoice = 'majeur' | 'mineur';

// Les 2 boutons de choix de gamme, affichés avant la palette de degrés.
const SCALES: { label: string; value: ScaleChoice }[] = [
  { label: 'Majeur', value: 'majeur' },
  { label: 'Mineur', value: 'mineur' },
];

// Associe chaque gamme choisie au tableau de degrés correspondant.
const DEGREES_BY_SCALE: Record<ScaleChoice, string[]> = {
  majeur: MAJEUR,
  mineur: MINEURNAT,
};

export default function CreationScreen() {
  const [scale, setScale] = useState<ScaleChoice | null>(null);
  const [progression, setProgression] = useState<string[]>([]);

  // Ajout immuable : on crée un nouveau tableau (spread + degré) au lieu de
  // faire progression.push(degree), qui modifierait l'ancien tableau en place.
  const addDegree = (degree: string) => {
    setProgression((prev) => [...prev, degree]);
  };

  // Même logique : slice() renvoie une copie tronquée, ne mute pas prev.
  const removeLast = () => {
    setProgression((prev) => prev.slice(0, -1));
  };

  const clearProgression = () => {
    setProgression([]);
  };

  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Crée ta progression</Text>

      {/* Choix de la gamme : conditionne les degrés proposés ensuite. */}
      <View style={styles.scaleRow}>
        {SCALES.map((item) => {
          const isSelected = item.value === scale;
          return (
            <Pressable
              key={item.value}
              style={[styles.scaleButton, isSelected && styles.scaleButtonSelected]}
              onPress={() => setScale(item.value)}
            >
              <Text style={styles.scaleLabel}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Palette des degrés disponibles, une fois la gamme choisie. */}
      {scale ? (
        <View style={styles.paletteRow}>
          {DEGREES_BY_SCALE[scale].map((degree) => (
            <Pressable key={degree} style={styles.degreeButton} onPress={() => addDegree(degree)}>
              <Text style={styles.degreeLabel}>{degree}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={theme.text.subtitle}>Choisis une gamme pour voir les degrés</Text>
      )}

      {/* Progression en cours de construction. */}
      <Text style={theme.text.subtitle}>
        {progression.length > 0 ? progression.join(' - ') : 'Ajoute des accords pour construire ta progression'}
      </Text>

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton} onPress={removeLast}>
          <Text style={styles.actionLabel}>Retirer le dernier</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={clearProgression}>
          <Text style={styles.actionLabel}>Effacer</Text>
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
  scaleRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  scaleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  scaleButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  scaleLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  degreeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  degreeLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.textMuted,
  },
  actionLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.textMuted,
  },
});
