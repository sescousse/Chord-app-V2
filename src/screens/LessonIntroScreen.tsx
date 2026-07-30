import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';

// Combien de temps avant de passer automatiquement à la page 1 si
// l'utilisateur ne tape pas l'écran avant. Un tap déclenche la même
// transition immédiatement (voir handleContinue) : ce délai n'accélère
// jamais rien de bloquant, il fixe juste une attente maximale.
const AUTO_ADVANCE_DELAY_MS = 2500;
const FADE_IN_DURATION_MS = 600;
const FADE_OUT_DURATION_MS = 250;

// Conseils pratiques génériques (placeholder à remplacer par le vrai
// contenu plus tard).
const TIPS = [
  'Prends ton temps, écoute avant de comprendre.',
  'Joue les exemples sur ton piano.',
  "Il n'y a pas de mauvaise note en exploration.",
];

type LessonIntroScreenProps = {
  lessonTitle: string;
  // Appelé une fois le fondu de sortie terminé : le parent (LessonCourseScreen)
  // bascule alors sur la page 1 de la leçon.
  onDone: () => void;
};

export default function LessonIntroScreen({ lessonTitle, onDone }: LessonIntroScreenProps) {
  const insets = useSafeAreaInsets();

  // Animated.Value est une valeur qui vit EN DEHORS du state React : Animated
  // l'anime frame par frame (via le driver natif ici) sans passer par un
  // re-render à chaque étape, contrairement à un useState. useRef garde la
  // MÊME instance entre les rendus (un useState recréerait une nouvelle
  // valeur, et donc une nouvelle animation, à chaque render).
  const opacity = useRef(new Animated.Value(0)).current;

  // Garde-fou pour ne déclencher qu'UNE fois la transition de sortie, que ce
  // soit un tap ou le délai automatique qui l'appelle en premier (sinon un
  // tap juste avant le délai, ou l'inverse, lancerait deux fondus de sortie
  // et appellerait onDone deux fois). Un ref (et non un useState) car cette
  // valeur n'a pas besoin de déclencher de re-render : elle sert juste de
  // verrou lu dans des callbacks.
  const hasStartedLeavingRef = useRef(false);

  // Fondu d'apparition au montage : l'opacité part de 0 (invisible, valeur
  // initiale ci-dessus) et anime vers 1 (visible) sur FADE_IN_DURATION_MS.
  // Le style plus bas (opacity: opacity) traduit cette valeur en rendu.
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_DURATION_MS,
      // La native driver anime l'opacité côté natif (fluide, hors du thread JS) ;
      // possible ici car "opacity" fait partie des propriétés qu'il supporte.
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  // Tap sur l'écran OU fin du délai automatique : les deux appellent
  // handleContinue, qui ne fait l'action qu'une seule fois (voir
  // hasStartedLeavingRef).
  const handleContinue = () => {
    if (hasStartedLeavingRef.current) {
      return;
    }
    hasStartedLeavingRef.current = true;

    // Fondu de sortie (1 → 0), puis on prévient le parent une fois
    // l'animation terminée : Animated.timing(...).start(callback) appelle ce
    // callback quand l'anim est finie (pas avant), pour ne changer d'écran
    // qu'une fois le fondu visuellement terminé.
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      onDone();
    });
  };

  useEffect(() => {
    const timer = setTimeout(handleContinue, AUTO_ADVANCE_DELAY_MS);
    return () => clearTimeout(timer);
    // Montage uniquement : handleContinue n'a pas besoin d'être dans les deps
    // (hasStartedLeavingRef est un ref, toujours à jour ; onDone ne change
    // pas de sémantique d'un render à l'autre).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Pressable style={styles.screen} onPress={handleContinue}>
      <Animated.View
        style={[styles.content, { opacity, paddingTop: insets.top + theme.spacing.xl }]}
      >
        {/* TODO: animation personnage ici */}
        <View style={styles.mascotPlaceholder} />

        <Text style={styles.title}>{lessonTitle}</Text>

        <View style={styles.tipsList}>
          {TIPS.map((tip) => (
            <Text key={tip} style={styles.tip}>
              {tip}
            </Text>
          ))}
        </View>

        <Text style={styles.hint}>Touche l'écran pour continuer</Text>
      </Animated.View>
    </Pressable>
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
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  // Zone réservée pour la future illustration/animation de mascotte (voir le
  // TODO ci-dessus) : hauteur fixe pour que le layout ne bouge pas quand elle
  // sera branchée, pas de fond pour l'instant (rien à afficher encore). Pas
  // de token de taille dédié dans le thème : composé à partir de spacing.xl.
  mascotPlaceholder: {
    height: theme.spacing.xl * 3,
    width: '100%',
  },
  title: {
    fontSize: theme.text.size.xxl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  tipsList: {
    gap: theme.spacing.sm,
  },
  tip: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.regular,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Pas de token "texte d'indice discret" dans le thème : composé à partir de
  // text.size.sm + colors.textMuted, comme d'autres textes secondaires de
  // l'écran de leçon (ex: l'ancien label de progression de LessonCourseScreen).
  hint: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
