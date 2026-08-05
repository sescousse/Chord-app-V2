import { useEffect, useRef } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { theme } from '../theme';
import { UNIT_1, UNIT_1_TITLE, UNIT_2, UNIT_2_TITLE, type Step } from '../dataset/courseTheorie';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { UnitHeader } from '../components/UnitHeader';

// Au bout de combien de temps SANS nouvel évènement onScroll on considère que
// l'utilisateur a arrêté de scroller (voir handleScroll ci-dessous). Pendant
// un scroll actif, onScroll se déclenche beaucoup plus vite que ça ; 120ms
// sans nouvel évènement suffit à distinguer une vraie pause d'un simple
// intervalle entre deux évènements.
const SCROLL_SETTLE_DELAY_MS = 120;

// Ce composant n'est PAS une route de pile à part entière : la bannière de
// HomeScreen le rend comme simple enfant DANS l'écran "HomeMain" (voir
// HomeStack.tsx et le commentaire dans HomeScreen.tsx) — d'où 'HomeMain'
// (pas 'CourseParcours', qui n'existe plus) en second paramètre : c'est
// depuis CET écran-hôte que ce composant hérite son contexte de navigation,
// et donc son accès à navigation.navigate('Lesson', ...) ci-dessous.
type CourseParcoursScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'HomeMain'
>;

// Alignement horizontal successif des noeuds, pour donner l'effet de chemin
// qui serpente (centre, puis droite, puis gauche, puis on reboucle). Un seul
// endroit à modifier pour changer le motif du serpentin.
const STEP_ALIGNMENTS: ('center' | 'flex-start' | 'flex-end')[] = ['center', 'flex-end', 'flex-start'];

// Numérote uniquement les étapes de type 'lesson' (pas le Boss), dans leur
// ordre d'apparition DANS L'UNITÉ donnée, pour afficher "1", "2", "3" sur les
// noeuds ronds. Fonction plutôt qu'une seule Map figée sur UNIT_1 (comme
// avant) : chaque unité doit renuméroter depuis 1 (la 1re leçon de l'Unité 2
// affiche "1", pas "4"), maintenant que UNIT_2 existe aussi. Calculé une
// seule fois par unité ci-dessous, plutôt qu'avec un compteur mutable dans
// le .map() du rendu.
function computeLessonNumbers(steps: Step[]): Map<string, number> {
  return new Map(
    steps.filter((step) => step.kind === 'lesson').map((step, index) => [step.id, index + 1]),
  );
}

const UNIT_1_LESSON_NUMBERS = computeLessonNumbers(UNIT_1);
const UNIT_2_LESSON_NUMBERS = computeLessonNumbers(UNIT_2);

// Pas de token "taille de noeud de parcours" dans le thème : composé à
// partir de spacing.xl plutôt qu'écrit en dur. BOSS_NODE_SIZE est
// volontairement plus grand, pour le distinguer visuellement des leçons
// (consigne : "plus gros / couleur différente").
const LESSON_NODE_SIZE = theme.spacing.xl * 2;
const BOSS_NODE_SIZE = theme.spacing.xl * 2.5;

interface UnitPathProps {
  steps: Step[];
  lessonNumbers: Map<string, number>;
  onStepPress: (step: Step) => void;
}

// Le chemin d'UNE unité : une étape par entrée de "steps", chacune alignée
// selon STEP_ALIGNMENTS pour serpenter verticalement. Extrait en composant
// séparé pour être appelé une fois par unité (UNIT_1 puis UNIT_2) sans
// dupliquer ce JSX ; un Fragment (pas de View englobante) pour que ses
// enfants restent des frères directs des Text de titre dans le ScrollView,
// et gardent donc le même espacement (styles.content.gap) qu'avant.
function UnitPath({ steps, lessonNumbers, onStepPress }: UnitPathProps) {
  return (
    <>
      {steps.map((step, index) => {
        const isBoss = step.kind === 'boss';
        const alignment = isBoss ? 'center' : STEP_ALIGNMENTS[index % STEP_ALIGNMENTS.length];
        const nodeLabel = isBoss ? '👑' : String(lessonNumbers.get(step.id) ?? '');
        // Verrouillage VISUEL uniquement (voir Step.locked dans
        // courseTheorie.ts) : grise le noeud et le titre, et désactive le
        // Pressable — "disabled" empêche onPress de se déclencher ET
        // supprime le retour visuel au toucher, donc pas besoin d'un
        // gestionnaire séparé pour les étapes verrouillées.
        const isLocked = step.locked === true;

        return (
          <View key={step.id} style={[styles.stepRow, { alignItems: alignment }]}>
            <Pressable
              style={[styles.node, isBoss && styles.bossNode, isLocked && styles.nodeLocked]}
              onPress={() => onStepPress(step)}
              disabled={isLocked}
            >
              <Text style={[styles.nodeLabel, isBoss && styles.bossNodeLabel]}>{nodeLabel}</Text>
            </Pressable>
            <Text style={[styles.stepTitle, isLocked && styles.stepTitleLocked]}>
              {step.title}
            </Text>
          </View>
        );
      })}
    </>
  );
}

export default function CourseParcoursScreen() {
  const navigation = useNavigation<CourseParcoursScreenNavigationProp>();

  // Position brute du scroll, suivie via Animated.event ci-dessous (native
  // driver : mise à jour côté natif, sans repasser par le pont JS à chaque
  // frame). Pas utilisée directement pour l'effet visuel de soulèvement
  // (voir liftAnim plus bas, qui suit un principe différent : "en train de
  // scroller ou non", pas la position) — gardée disponible si un futur
  // effet a besoin de la position exacte (ex: parallax).
  const scrollY = useRef(new Animated.Value(0)).current;

  // 0 = boîtes d'en-tête au repos, 1 = "soulevées". C'est CETTE valeur
  // (interpolée en pixels par UnitHeader) qui pilote l'effet demandé — pas
  // scrollY. Une seule instance PARTAGÉE par toutes les UnitHeader de
  // l'écran : elles se soulèvent donc toutes ensemble.
  const liftAnim = useRef(new Animated.Value(0)).current;

  // Évite de relancer l'animation de soulèvement à CHAQUE évènement onScroll
  // (qui peut se déclencher très souvent pendant un scroll actif) : une fois
  // déjà soulevée, on ne fait que repousser le minuteur de retour au repos
  // (voir settleTimeoutRef), sans redémarrer inutilement le "aller".
  const isLiftedRef = useRef(false);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Appelée à CHAQUE évènement onScroll (via le "listener" de Animated.event
  // ci-dessous). Logique en 2 temps :
  // 1. Si pas déjà soulevée, anime rapidement liftAnim vers 1 (soulèvement).
  // 2. Repousse (debounce) un minuteur de "retour au repos" à chaque appel :
  //    tant que d'autres évènements onScroll arrivent, ce minuteur est sans
  //    cesse annulé et reprogrammé. S'il finit par se déclencher (plus
  //    aucun évènement onScroll pendant SCROLL_SETTLE_DELAY_MS), c'est qu'on
  //    a arrêté de scroller : on relâche alors la boîte en douceur avec
  //    Animated.spring (retour "attiré", pas un simple aller-retour linéaire).
  //
  // Détecter l'arrêt via un minuteur plutôt que via les évènements dédiés du
  // ScrollView (onScrollEndDrag / onMomentumScrollEnd) : sur un relâchement
  // sans élan (drag lent puis lâcher), onMomentumScrollEnd ne se déclenche
  // pas toujours, ce qui laisserait la boîte soulevée en permanence.
  const handleScroll = () => {
    if (!isLiftedRef.current) {
      isLiftedRef.current = true;
      Animated.timing(liftAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }).start();
    }

    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
    }
    settleTimeoutRef.current = setTimeout(() => {
      isLiftedRef.current = false;
      Animated.spring(liftAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7,
        tension: 40,
      }).start();
      settleTimeoutRef.current = null;
    }, SCROLL_SETTLE_DELAY_MS);
  };

  // Nettoyage : annule le minuteur en attente si l'écran est démonté pendant
  // qu'on attend un éventuel arrêt du scroll.
  useEffect(() => {
    return () => {
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
    };
  }, []);

  // Animated.event relie contentOffset.y (la position de scroll native) à
  // scrollY, ET appelle handleScroll en JS à chaque évènement via son option
  // "listener" — combinant tracking natif fluide (scrollY) et notre propre
  // logique de soulèvement/retour au repos, sans sacrifier l'un pour l'autre.
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true, listener: handleScroll },
  );

  // Un seul gestionnaire pour toutes les étapes : type 'lesson' → on passe
  // toute la Lesson de l'étape en paramètre de navigation (voir le
  // commentaire dans LessonCourseScreen.tsx) ; type 'boss' → pas d'écran de
  // leçon dédié pour l'instant, une simple alerte avec son texte de défi
  // suffit (périmètre strict : squelette navigable, rien de plus).
  //
  // Garde "if (step.locked) return" en plus du "disabled" posé sur le
  // Pressable dans UnitPath : le Pressable suffit déjà à empêcher tout appui
  // d'arriver ici, mais cette garde documente/protège explicitement la règle
  // "une étape verrouillée ne navigue jamais", au cas où ce gestionnaire
  // serait un jour appelé autrement qu'via ce Pressable.
  const handleStepPress = (step: Step) => {
    if (step.locked) return;

    if (step.kind === 'lesson') {
      if (step.lesson) {
        navigation.navigate('Lesson', { lesson: step.lesson });
      }
      return;
    }

    Alert.alert(step.title, step.lesson?.blocks[0]?.text ?? 'Défi à venir.');
  };

  return (
    <Animated.ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      onScroll={onScroll}
      // Sans ça, onScroll (et donc handleScroll) ne se déclenche que par
      // à-coups sur iOS — 16 ≈ un évènement par frame (60fps), nécessaire
      // pour que le debounce de handleScroll détecte correctement l'arrêt.
      scrollEventThrottle={16}
    >
      <UnitHeader unitNumber={1} title={UNIT_1_TITLE} liftAnim={liftAnim} />
      <UnitPath steps={UNIT_1} lessonNumbers={UNIT_1_LESSON_NUMBERS} onStepPress={handleStepPress} />

      {/* Unité 2 à la suite (accessible en scrollant) : même liftAnim PARTAGÉ
          que l'en-tête de l'Unité 1 (les 2 se soulèvent ensemble au scroll),
          "dimmed" en plus car toutes ses étapes sont verrouillées (voir
          UNIT_2 dans courseTheorie.ts) — cohérent avec ses bulles grisées,
          affichées par ce même UnitPath sans code de rendu séparé. */}
      <UnitHeader unitNumber={2} title={UNIT_2_TITLE} liftAnim={liftAnim} dimmed />
      <UnitPath steps={UNIT_2} lessonNumbers={UNIT_2_LESSON_NUMBERS} onStepPress={handleStepPress} />
    </Animated.ScrollView>
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
  // Étape verrouillée (Step.locked === true) : remplace la couleur du noeud
  // (primary ou, pour le Boss, exercice) par le gris neutre theme.colors.locked
  // — appliqué APRÈS bossNode dans le tableau de styles (voir UnitPath), donc
  // il l'emporte sur le rouge du Boss tout en gardant sa taille plus grande.
  nodeLocked: {
    backgroundColor: theme.colors.locked,
    borderColor: theme.colors.locked,
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
  // Même gris que nodeLocked, pour que le titre d'une étape verrouillée
  // reste cohérent avec son noeud.
  stepTitleLocked: {
    color: theme.colors.locked,
  },
});
