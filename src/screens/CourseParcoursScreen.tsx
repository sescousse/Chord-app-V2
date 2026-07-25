import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { theme } from '../theme';
import { UNIT_1, UNIT_1_TITLE, type Step } from '../dataset/courseTheorie';
import type { CourseStackParamList } from '../navigation/CourseStack';

type CourseParcoursScreenNavigationProp = NativeStackNavigationProp<
  CourseStackParamList,
  'CourseParcours'
>;

// Alignement horizontal successif des noeuds, pour donner l'effet de chemin
// qui serpente (centre, puis droite, puis gauche, puis on reboucle). Un seul
// endroit à modifier pour changer le motif du serpentin.
const STEP_ALIGNMENTS: ('center' | 'flex-start' | 'flex-end')[] = ['center', 'flex-end', 'flex-start'];

// Numérote uniquement les étapes de type 'lesson' (pas le Boss), dans leur
// ordre d'apparition dans UNIT_1, pour afficher "1", "2", "3" sur les noeuds
// ronds. Calculé une seule fois ici plutôt qu'avec un compteur mutable dans
// le .map() du rendu.
const lessonNumberById = new Map<string, number>(
  UNIT_1.filter((step) => step.kind === 'lesson').map((step, index) => [step.id, index + 1]),
);

// Pas de token "taille de noeud de parcours" dans le thème : composé à
// partir de spacing.xl plutôt qu'écrit en dur. BOSS_NODE_SIZE est
// volontairement plus grand, pour le distinguer visuellement des leçons
// (consigne : "plus gros / couleur différente").
const LESSON_NODE_SIZE = theme.spacing.xl * 2;
const BOSS_NODE_SIZE = theme.spacing.xl * 2.5;

export default function CourseParcoursScreen() {
  const navigation = useNavigation<CourseParcoursScreenNavigationProp>();

  // Un seul gestionnaire pour toutes les étapes : type 'lesson' → on passe
  // toute la Lesson de l'étape en paramètre de navigation (voir le
  // commentaire dans LessonScreen.tsx) ; type 'boss' → pas d'écran de leçon
  // dédié pour l'instant, une simple alerte avec son texte de défi suffit
  // (périmètre strict : squelette navigable, rien de plus).
  const handleStepPress = (step: Step) => {
    if (step.kind === 'lesson') {
      if (step.lesson) {
        navigation.navigate('Lesson', { lesson: step.lesson });
      }
      return;
    }

    Alert.alert(step.title, step.lesson?.blocks[0]?.text ?? 'Défi à venir.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={theme.text.title}>{UNIT_1_TITLE}</Text>

      {/* Le chemin : une étape par entrée de UNIT_1, chacune alignée selon
          STEP_ALIGNMENTS pour serpenter verticalement. Aucun JSX de noeud
          n'est dupliqué entre leçons et Boss : seul le style change selon
          "kind". */}
      {UNIT_1.map((step, index) => {
        const isBoss = step.kind === 'boss';
        const alignment = isBoss ? 'center' : STEP_ALIGNMENTS[index % STEP_ALIGNMENTS.length];
        const nodeLabel = isBoss ? '👑' : String(lessonNumberById.get(step.id) ?? '');

        return (
          <View key={step.id} style={[styles.stepRow, { alignItems: alignment }]}>
            <Pressable
              style={[styles.node, isBoss && styles.bossNode]}
              onPress={() => handleStepPress(step)}
            >
              <Text style={[styles.nodeLabel, isBoss && styles.bossNodeLabel]}>{nodeLabel}</Text>
            </Pressable>
            <Text style={styles.stepTitle}>{step.title}</Text>
          </View>
        );
      })}
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
  stepRow: {
    width: '100%',
    gap: theme.spacing.xs,
  },
  node: {
    alignItems: 'center',
    justifyContent: 'center',
    width: LESSON_NODE_SIZE,
    height: LESSON_NODE_SIZE,
    borderRadius: LESSON_NODE_SIZE / 2,
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  // Boss : plus gros, et une couleur différente (theme.colors.exercice,
  // déjà réutilisée ailleurs dans l'app — ex: PianoChord — pour signaler
  // "ce qui doit ressortir du reste" ; pas de token "boss" dédié dans le
  // thème).
  bossNode: {
    width: BOSS_NODE_SIZE,
    height: BOSS_NODE_SIZE,
    borderRadius: BOSS_NODE_SIZE / 2,
    backgroundColor: theme.colors.exercice,
  },
  // Pas de token "texte sur fond coloré" dans le thème (theme.colors.text est
  // pensé pour du texte sombre sur fond clair) : blanc en dur ici, comme déjà
  // fait ailleurs dans l'app pour ce même besoin (ex: PianoChord, noms de
  // touches noires).
  nodeLabel: {
    fontSize: theme.text.size.xl,
    fontWeight: theme.text.weight.bold,
    color: '#FFFFFF',
  },
  bossNodeLabel: {
    fontSize: theme.text.size.xxl,
  },
  stepTitle: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    maxWidth: LESSON_NODE_SIZE * 2,
  },
});
