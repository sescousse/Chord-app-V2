import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';

import { theme } from '../theme';
import { PianoChord } from '../components/PianoChord';
import { chordNotesWithOctaves, degreeToChord, type ScaleChoice } from '../dataset/chordUtils';

// Palette des degrés proposés. Modifie ce tableau pour ajouter/retirer des boutons.
const MAJEUR: string[] = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MINEURNAT: string[] = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

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

// Tonalités proposées pour le choix de tonique. Ajoute des notes ici pour étendre le choix.
const TONICS: string[] = ['C', 'G', 'D', 'A', 'E', 'F'];

// degreeToChord (degré + gamme + tonique → accord concret) vit maintenant
// dans chordUtils.ts, partagée avec improResult.tsx (voir son enrichissement
// par 7e diatonique) plutôt que dupliquée ici.

export default function CreationScreen() {
  const [scale, setScale] = useState<ScaleChoice | null>(null);
  const [tonic, setTonic] = useState<string>('C');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
              <Text style={styles.scaleLabel} numberOfLines={1}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Choix de la tonalité : combiné à la gamme pour calculer les accords concrets. */}
      <View style={styles.scaleRow}>
        {TONICS.map((item) => {
          const isSelected = item === tonic;
          return (
            <Pressable
              key={item}
              style={[styles.scaleButton, isSelected && styles.scaleButtonSelected]}
              onPress={() => setTonic(item)}
            >
              <Text style={styles.scaleLabel} numberOfLines={1}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Palette des degrés disponibles, une fois la gamme et la tonalité choisies. */}
      {scale && tonic ? (
        <View style={styles.paletteRow}>
          {DEGREES_BY_SCALE[scale].map((degree) => (
            <Pressable key={degree} style={styles.degreeButton} onPress={() => addDegree(degree)}>
              <Text style={styles.degreeLabel}>{degree}</Text>
              <Text style={styles.chordLabel}>{degreeToChord(degree, scale, tonic)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={theme.text.subtitle}>Choisis une gamme et une tonalité pour voir les degrés</Text>
      )}

      {/* Progression en cours de construction : degré + accord concret pour chaque étape. */}
      <Text style={theme.text.subtitle}>
        {progression.length > 0 && scale
          ? progression.map((degree) => `${degree} (${degreeToChord(degree, scale, tonic)})`).join(' - ')
          : 'Ajoute des accords pour construire ta progression'}
      </Text>

      {/* Zone à blocs-pianos : un bloc par accord de la progression, dans
          l'ordre. On protège l'affichage avec "scale" car degreeToChord en a
          besoin (Scale.get) — sans gamme choisie, on ne peut pas encore
          calculer d'accord concret, donc on affiche juste le message d'invite. */}
      <View style={styles.chordBlocksContainer}>
        {progression.length > 0 && scale ? (
          progression.map((degree, index) => {
            // 1) Degré → accord concret (ex: "iv" en Do majeur → "Dm").
            const chordName = degreeToChord(degree, scale, tonic);
            // 2) Accord concret → notes qui le composent. Chord.get renvoie
            //    un objet décrivant l'accord ; sa propriété "notes" est le
            //    tableau de noms de notes (ex: "Dm" → ["D", "F", "A"]) que
            //    PianoChord attend dans sa prop "notes" pour savoir quelles
            //    touches mettre en valeur sur le clavier.
            const chordNotes = chordNotesWithOctaves(chordName, 3);

            return (
              <View key={index} style={styles.chordBlock}>
                <Text style={styles.chordBlockLabel}>{chordName}</Text>
                <PianoChord notes={chordNotes} />
              </View>
            );
          })
        ) : (
          <Text style={theme.text.subtitle}>Ta progression apparaîtra ici</Text>
        )}
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton} onPress={removeLast}>
          <Text style={styles.actionLabel}>Retirer le dernier</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={clearProgression}>
          <Text style={styles.actionLabel}>Effacer</Text>
        </Pressable>
      </View>
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
  gap: theme.spacing.lg,
  // plus de justifyContent: 'center' ! Le contenu commence en haut et descend.
},
  scaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  scaleButton: {
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
  chordLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  chordBlocksContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
  },
  chordBlock: {
     width: '90%',
    // Pas de alignItems: 'center' ici : PianoChord mesure la largeur
    // réellement disponible dans son conteneur parent direct via onLayout
    // (voir son commentaire dans PianoChord.tsx) pour ne jamais déborder —
    // ça suppose que ce parent le laisse s'étirer sur toute sa largeur
    // (comportement par défaut) plutôt que le recroqueviller sur son
    // contenu. Le texte (chordBlockLabel) reste centré via son propre
    // textAlign, plus besoin de le faire porter par ce conteneur.
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chordBlockLabel: {
    textAlign: 'center',
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
