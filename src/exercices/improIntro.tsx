import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import type { ExercisesStackParamList } from '../navigation/ExercisesStack';

const FADE_IN_DURATION_MS = 600;
const FADE_OUT_DURATION_MS = 250;

// Texte d'explication (placeholder court, à reformuler plus tard) : comment
// se servir de l'exercice d'improvisation libre.
const EXPLANATION_LINES = [
  "Improvise librement à partir d'une progression d'accords.",
  "Choisis l'émotion que tu veux explorer (et, si tu veux, un style musical).",
  'Puis découvre les accords de la progression et enrichis-les à ta façon.',
];

type ImproIntroNavigation = NativeStackNavigationProp<ExercisesStackParamList, 'Impro'>;

// Écran d'intro de l'improvisation libre : reprend le PATRON d'animation
// (fondu via Animated) de LessonIntroScreen.tsx (intro des leçons de cours),
// adapté à un flux qui NAVIGUE réellement vers un autre écran de la pile
// (ImproChoices) au lieu de basculer un state interne — voir handleContinue.
//
// 2 différences volontaires avec LessonIntroScreen :
// - Pas de délai automatique. Un lecteur a besoin de lire l'explication à
//   son rythme (contrairement aux 2-3 conseils rapides d'une leçon) : on le
//   laisse avancer via le bouton "Commencer" plutôt que de le presser après
//   un délai fixe.
// - Pas de useSafeAreaInsets. Cet écran garde son header natif (bouton
//   retour standard, voir ExercisesStack.tsx), qui réserve déjà l'espace
//   nécessaire sous l'encoche/l'heure — contrairement à l'écran de leçon
//   (header masqué, plein écran), il n'y a ici aucune zone système à gérer
//   manuellement.
export default function ImproIntroScreen() {
  const navigation = useNavigation<ImproIntroNavigation>();

  // Animated.Value : vit hors du state React, animé frame par frame sans
  // re-render à chaque étape ; useRef garde la MÊME instance entre les
  // rendus (un useState en recréerait une nouvelle, donc une nouvelle
  // animation, à chaque render). Même mécanique que LessonIntroScreen.
  const opacity = useRef(new Animated.Value(0)).current;

  // Évite de déclencher deux fois la transition de sortie (ex: double-tap
  // rapide sur "Commencer", qui naviguerait deux fois vers ImproChoices).
  // Un ref, pas un state : cette valeur ne doit pas déclencher de re-render,
  // elle sert seulement de verrou lu dans handleContinue.
  const hasStartedLeavingRef = useRef(false);

  // Fondu d'apparition au montage : 0 (valeur initiale) → 1 sur
  // FADE_IN_DURATION_MS. Le style plus bas (opacity: opacity) traduit cette
  // valeur en rendu visuel.
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_DURATION_MS,
      // Native driver : anime l'opacité côté natif, fluide, sans repasser
      // par le thread JS à chaque frame — possible ici car "opacity" fait
      // partie des propriétés que le native driver sait animer.
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  // Tap sur "Commencer" : fondu de sortie (1 → 0), puis navigation vers
  // ImproChoices UNE FOIS le fondu terminé (Animated.timing(...).start(cb)
  // n'appelle "cb" qu'à la fin de l'animation, pas avant) — l'écran suivant
  // n'apparaît donc qu'une fois la sortie visuellement terminée.
  //
  // PAS DE MINUTEUR À NETTOYER ICI (contrairement à LessonIntroScreen, qui a
  // aussi un délai automatique en setTimeout) : cet écran n'utilise que des
  // animations Animated, jamais de setTimeout/setInterval. Une animation
  // Animated qui tourne encore quand son composant se démonte s'arrête
  // simplement d'elle-même, sans fuite ni effet de bord — rien à nettoyer
  // dans un useEffect de retour ici.
  const handleContinue = () => {
    if (hasStartedLeavingRef.current) {
      return;
    }
    hasStartedLeavingRef.current = true;

    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('ImproChoices');
    });
  };

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.content, { opacity }]}>
        <Text style={styles.title}>Improvisation libre</Text>

        <View style={styles.explanationList}>
          {EXPLANATION_LINES.map((line) => (
            <Text key={line} style={styles.explanationLine}>
              {line}
            </Text>
          ))}
        </View>

        <Pressable style={styles.startButton} onPress={handleContinue}>
          <Text style={styles.startButtonLabel}>Commencer</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.text.size.xxl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  explanationList: {
    gap: theme.spacing.sm,
  },
  explanationLine: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.regular,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Pas de token "bouton primaire" dans le thème (déjà signalé ailleurs, ex:
  // LessonCourseScreen) : composé à partir des tokens couleur/espacement/
  // rayon existants.
  startButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  // Pas de token "texte sur fond coloré" (idem, déjà signalé ailleurs) :
  // blanc en dur.
  startButtonLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
});
