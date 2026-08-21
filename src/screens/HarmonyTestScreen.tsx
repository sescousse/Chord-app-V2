// ÉCRAN DE TEST TEMPORAIRE — valide isolément analyserProgression (voir
// src/lib/harmonyAnalysis.ts), le premier analyseur harmonique de l'app
// (accords → degrés). Accessible depuis un bouton "🧪 Test analyse" sur
// l'écran d'accueil (voir HomeScreen.tsx) — à retirer avec sa route
// (HomeStack.tsx) une fois l'analyseur validé, comme les écrans de test
// audio des briques précédentes (src/audio/webAudioTest.ts).
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from '../theme';
import { analyserProgression, type ResultatAnalyseAccord } from '../lib/harmonyAnalysis';

// Les 12 hauteurs chromatiques, orthographiées avec des dièses uniquement
// (pas de choix "meilleure orthographe" par tonalité, ex: Fa♯ vs Sol♭) :
// simple et sans ambiguïté pour un outil de test — l'analyse elle-même
// compare par CHROMA (voir harmonyAnalysis.ts), donc le résultat ne dépend
// jamais de l'orthographe choisie ici.
const TONICS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// "major"/"minor" (anglais, format tonal direct) plutôt que "majeur"/
// "mineur" (comme ScaleChoice ailleurs dans l'app, ex: chordUtils.ts) : cet
// écran de test reste volontairement AUTONOME (aucun import d'un autre
// module de l'app, à part harmonyAnalysis.ts lui-même), pour rester simple
// à retirer entièrement plus tard.
const SCALE_TYPES: { value: 'major' | 'minor'; label: string }[] = [
  { value: 'major', label: 'majeur' },
  { value: 'minor', label: 'mineur' },
];

type TonaliteOption = {
  // Chaîne envoyée telle quelle à analyserProgression (ex: "C major").
  value: string;
  // Libellé affiché sur le chip (ex: "C majeur").
  label: string;
};

// Les 24 tonalités (12 toniques × majeur/mineur), construites une seule fois
// au chargement du module — aucune des 2 dimensions ne change à l'exécution.
const TONALITE_OPTIONS: TonaliteOption[] = TONICS.flatMap((tonic) =>
  SCALE_TYPES.map((scaleType) => ({
    value: `${tonic} ${scaleType.value}`,
    label: `${tonic} ${scaleType.label}`,
  })),
);

// Découpe la saisie libre en accords individuels : un ou plusieurs espaces
// comme séparateur (\s+, pas juste " "), et filter() retire les "accords"
// vides qu'un double-espace ou un espace en bout de ligne produirait sinon
// — sans ce filtre, une saisie comme "Dm7  G7" (2 espaces) créerait un faux
// 3e accord vide entre les deux.
function splitChordsInput(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export default function HarmonyTestScreen() {
  const [chordsText, setChordsText] = useState('Dm7 G7 Cmaj7');
  const [tonaliteIndex, setTonaliteIndex] = useState(0); // "C major" par défaut.
  // null tant qu'"Analyser" n'a jamais été pressé — distinct d'un tableau
  // vide (résultat d'une analyse dont la saisie ne contenait aucun accord),
  // pour ne pas afficher "Aucun accord saisi." avant le tout premier appui.
  const [results, setResults] = useState<ResultatAnalyseAccord[] | null>(null);

  const selectedTonalite = TONALITE_OPTIONS[tonaliteIndex];

  const handleAnalyze = () => {
    setResults(analyserProgression(splitChordsInput(chordsText), selectedTonalite.value));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={theme.text.title}>Test analyse harmonique</Text>
      <Text style={theme.text.subtitle}>
        Tape des accords séparés par des espaces, choisis une tonalité, puis appuie sur "Analyser".
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Ex: Dm7 G7 Cmaj7"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        value={chordsText}
        onChangeText={setChordsText}
      />

      <Text style={styles.sectionLabel}>Tonalité</Text>
      {/* flexWrap : 24 chips ne tiennent jamais sur une seule ligne — revient
          à la ligne automatiquement, comme les autres grilles de chips de
          l'app (ex: ExpandedChordPanel). */}
      <View style={styles.tonaliteGrid}>
        {TONALITE_OPTIONS.map((option, index) => {
          const isSelected = index === tonaliteIndex;
          return (
            <Pressable
              key={option.value}
              style={[styles.tonaliteChip, isSelected && styles.tonaliteChipSelected]}
              onPress={() => setTonaliteIndex(index)}
            >
              <Text style={[styles.tonaliteChipLabel, isSelected && styles.tonaliteChipLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.analyzeButton} onPress={handleAnalyze}>
        <Text style={styles.analyzeButtonLabel}>Analyser</Text>
      </Pressable>

      {results && (
        <View style={styles.resultsBlock}>
          <Text style={styles.sectionLabel}>Résultat — tonalité : {selectedTonalite.label}</Text>

          {results.length === 0 ? (
            <Text style={theme.text.subtitle}>Aucun accord saisi.</Text>
          ) : (
            // CHAQUE accord affiché individuellement, y compris ceux non
            // reconnus/hors tonalité (jamais filtrés en silence) : c'est
            // exactement le but de cet écran — rendre visibles les cas que
            // l'analyseur ne sait pas traiter, pas seulement les succès.
            results.map((result, index) => (
              <View key={`${result.saisie}-${index}`} style={styles.resultRow}>
                <Text style={styles.resultInput} numberOfLines={1}>
                  {result.saisie || '(vide)'}
                </Text>
                <Text style={styles.resultArrow}>→</Text>

                {result.statut === 'reconnu' && (
                  <View style={styles.resultReconnu}>
                    <Text style={styles.resultOk} numberOfLines={1}>
                      {result.accordCompris} · {result.degre} · {result.qualiteEnClair}
                    </Text>
                    {/* Badge diatonique/altéré : seulement pour 'diatonique'/'altere',
                        les 2 autres statuts diatoniques (qualité indéterminée, gamme
                        mineure non prise en charge) restent muets plutôt que d'afficher
                        un badge trompeur — voir harmonyAnalysis.ts pour le détail des 4
                        valeurs possibles de statutDiatonique. */}
                    {result.statutDiatonique === 'diatonique' && (
                      <View style={[styles.badge, styles.badgeDiatonique]}>
                        <Text style={styles.badgeLabel}>diatonique</Text>
                      </View>
                    )}
                    {result.statutDiatonique === 'altere' && (
                      <View style={[styles.badge, styles.badgeAltere]}>
                        <Text style={styles.badgeLabel}>altéré</Text>
                      </View>
                    )}
                    {result.statutDiatonique === 'qualiteIndeterminee' && (
                      <View style={[styles.badge, styles.badgeIndetermine]}>
                        <Text style={styles.badgeLabel}>qualité incertaine</Text>
                      </View>
                    )}
                    {result.statutDiatonique === 'gammeNonPriseEnCharge' && (
                      <View style={[styles.badge, styles.badgeIndetermine]}>
                        <Text style={styles.badgeLabel}>analyse diatonique non dispo (mineur)</Text>
                      </View>
                    )}
                  </View>
                )}
                {result.statut === 'horsTonalite' && (
                  <Text style={styles.resultWarning} numberOfLines={1}>
                    {result.accordCompris} · hors tonalité
                  </Text>
                )}
                {result.statut === 'nonReconnu' && (
                  <Text style={styles.resultError} numberOfLines={1}>
                    non reconnu
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  // Même style que SearchUsersScreen.tsx/SignInScreen.tsx/SignUpScreen.tsx,
  // pour rester cohérent avec les autres champs de saisie de l'app.
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.text.size.md,
    color: theme.colors.text,
  },
  sectionLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tonaliteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  tonaliteChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tonaliteChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tonaliteChipLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.text,
  },
  tonaliteChipLabelSelected: {
    fontWeight: theme.text.weight.semibold,
  },
  analyzeButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
  },
  analyzeButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
  resultsBlock: {
    gap: theme.spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  // Empile le texte (accord · degré · qualité) et le badge diatonique/altéré
  // verticalement à droite de la ligne — sur une seule ligne ils seraient
  // trop serrés vu la longueur du libellé de qualité en clair.
  resultReconnu: {
    flex: 1,
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  badge: {
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  // Teal "exercice" (déjà utilisé ailleurs dans l'app pour un accent
  // positif/actif) : lecture immédiate "conforme à l'attendu".
  badgeDiatonique: {
    backgroundColor: theme.colors.exercice,
  },
  // Rouge "danger" (déjà la convention de l'app pour "à remarquer") : la
  // qualité jouée diffère de l'attendu pour ce degré.
  badgeAltere: {
    backgroundColor: theme.colors.danger,
  },
  // Gris neutre "locked" : ni conforme ni non-conforme — analyse simplement
  // pas disponible pour ce cas (qualité indéterminée ou tonalité mineure).
  badgeIndetermine: {
    backgroundColor: theme.colors.locked,
  },
  badgeLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
  resultInput: {
    flex: 1,
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  resultArrow: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  resultOk: {
    flex: 1,
    textAlign: 'right',
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Amber : ni une vraie erreur (l'accord EST reconnu), ni un résultat
  // normal — un avertissement, même famille de couleur que
  // backGroundExercice ailleurs dans l'app pour ce registre intermédiaire.
  resultWarning: {
    flex: 1,
    textAlign: 'right',
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.backGroundExercice,
  },
  resultError: {
    flex: 1,
    textAlign: 'right',
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.danger,
  },
});
