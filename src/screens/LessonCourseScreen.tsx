import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import type { HomeStackParamList } from '../navigation/HomeStack';
import type { CoursePage } from '../dataset/courseTheorie';
import LessonIntroScreen from './LessonIntroScreen';
import { InteractivePiano } from '../components/InteractivePiano';

// NativeStackScreenProps<HomeStackParamList, 'Lesson'> donne à la fois
// "route" (la Lesson complète voyage en paramètre de navigation, voir
// CourseParcoursScreen.handleStepPress — pas besoin d'aller la rechercher
// ailleurs par id) et "navigation" (utilisé ici pour revenir au parcours
// via goBack() une fois la dernière page terminée).
type LessonCourseScreenProps = NativeStackScreenProps<HomeStackParamList, 'Lesson'>;

export default function LessonCourseScreen({ route, navigation }: LessonCourseScreenProps) {
  const { lesson } = route.params;

  // Affiche d'abord LessonIntroScreen (titre de la leçon + conseils, fondu
  // d'entrée) avant la page 1 du cours. true au montage ; passe à false une
  // fois l'intro fermée (délai automatique ou tap dedans, voir onDone
  // ci-dessous), ce qui affiche alors normalement la page 1 (pageIndex
  // démarre déjà à 0, inchangé). Ce state est déclaré ici, avant tout retour
  // anticipé, pour respecter les règles des Hooks : tous les hooks de ce
  // composant doivent s'exécuter à chaque rendu, intro affichée ou non.
  const [showIntro, setShowIntro] = useState(true);

  // Le header natif et la tab bar sont masqués sur cet écran (voir
  // HomeStack.tsx / RootNavigator.tsx) : la barre du haut (titre + cœurs)
  // se retrouve donc collée au vrai bord de l'écran, sous l'encoche/l'heure
  // du système. useSafeAreaInsets() donne la hauteur de cette zone système
  // (insets.top) pour l'ajouter en paddingTop de la barre du haut, en plus
  // d'un peu d'espace pour aérer (voir styles.topBar).
  const insets = useSafeAreaInsets();

  // Pages à afficher : celles de la leçon si elle a été convertie au format
  // "slides" (lesson.pages, ex: LESSON_1_1), sinon repli sur ses blocks — un
  // LessonBlock (icon/heading/text obligatoires) est déjà structurellement
  // un CoursePage (icon optionnel), donc affichable tel quel, une page par
  // bloc, sans conversion ni perte de contenu pour les leçons pas encore
  // converties.
  const pages: CoursePage[] = lesson.pages ?? lesson.blocks;

  // Seul état de cet écran : l'index (0-based) de la page actuellement
  // affichée. Le bouton "Compris"/"Terminer" l'incrémente (ou revient en
  // arrière sur la dernière page) ; la barre de progression en bas en
  // dépend aussi, pour savoir quelle fraction remplir.
  const [pageIndex, setPageIndex] = useState(0);

  const currentPage = pages[pageIndex];
  const isLastPage = pageIndex === pages.length - 1;

  // Remplissage de la barre de progression, en fraction (0 à 1) de
  // pages.length. Valeur initiale déjà correcte (pas de "0 → valeur" au
  // montage) : seuls les changements de pageIndex ensuite sont animés.
  const progress = useRef(new Animated.Value((pageIndex + 1) / pages.length)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: (pageIndex + 1) / pages.length,
      duration: 250,
      // La largeur n'est pas animable par le driver natif.
      useNativeDriver: false,
    }).start();
  }, [pageIndex, pages.length, progress]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Navigation entre pages : une seule page de la leçon à la fois. Sur la
  // dernière page, il n'y a plus de page suivante à afficher : le bouton
  // referme alors cet écran (retour au parcours) plutôt que d'avancer.
  const handlePressContinue = () => {
    if (isLastPage) {
      navigation.goBack();
      return;
    }
    setPageIndex((index) => index + 1);
  };

  // Retour anticipé APRÈS tous les hooks ci-dessus (voir le commentaire sur
  // showIntro) : tant que l'intro n'est pas fermée, elle seule s'affiche —
  // rien de la page de cours (topBar, contenu, bouton, cœurs, barre de
  // progression) n'est monté en dessous.
  if (showIntro) {
    return <LessonIntroScreen lessonTitle={lesson.title} onDone={() => setShowIntro(false)} />;
  }

  return (
    <View style={styles.screen}>
      {/* Barre du haut : titre de section (à gauche) + cœurs (statiques pour
          l'instant, voir HEARTS plus bas) alignés à droite sur la même
          ligne — sortie du ScrollView pour rester alignée à gauche même si
          le texte plus bas est centré. Fond (theme.colors.surface) + bordure
          distincts du contenu, et paddingTop = insets.top + un peu d'air,
          pour ne pas passer sous la zone système (encoche/heure). */}
      <View style={[styles.topBar, { paddingTop: insets.top + theme.spacing.md }]}>
        <View style={styles.headerRow}>
          <View style={styles.headingLeft}>
            {currentPage.icon ? <Text style={styles.headingIcon}>{currentPage.icon}</Text> : null}
            <Text style={styles.heading}>{currentPage.heading}</Text>
          </View>
          <View style={styles.heartsRow}>
            {HEARTS.map((_, index) => (
              <Text key={index} style={styles.heart}>
                ❤️
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* ScrollView au cas où le texte d'une page dépasserait la hauteur
          disponible (grand écran de texte, petit téléphone, etc.). Fond
          theme.colors.background : c'est la seule zone "contenu", les deux
          autres (topBar/bottomBar) sont volontairement détachées visuellement. */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.text}>{currentPage.text}</Text>

        {/* Composant interactif optionnel de la page (voir
            CoursePage.interactive dans courseTheorie.ts), affiché SOUS le
            texte. Une page sans ce champ (la grande majorité) ne rend rien
            de plus ici et reste texte seul, comme avant. */}
        {currentPage.interactive === 'piano' && <InteractivePiano />}
      </ScrollView>

      {/* Zone du bas : bouton puis barre de progression, sur un fond
          (theme.colors.surface) + bordure distincts du contenu, comme la
          barre du haut. */}
      <View style={styles.bottomBar}>
        <Pressable style={styles.button} onPress={handlePressContinue}>
          <Text style={styles.buttonLabel}>{isLastPage ? 'Terminer' : 'Compris'}</Text>
        </Pressable>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      </View>
    </View>
  );
}

// Nombre de cœurs affichés en haut à droite : 5, tous pleins pour l'instant.
// Purement décoratif ici — aucune logique de vie/perte de vie, aucun state :
// juste un tableau pour .map() 5 fois le même glyphe.
const HEARTS = [0, 1, 2, 3, 4];

const styles = StyleSheet.create({
  // Fond de l'écran entier : c'est le fond de la zone "contenu" (ScrollView).
  // topBar/bottomBar posent leur propre fond par-dessus, edge-to-edge (pas de
  // padding ici, sinon leur couleur n'atteindrait pas les bords de l'écran).
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // ⚠️ theme.colors.surface est actuellement IDENTIQUE à theme.colors.background
  // dans colors.ts (même valeur 'rgb(220, 219, 219)' pour les deux) : sans la
  // bordure ci-dessous, topBar/bottomBar seraient donc invisibles contre le
  // fond du contenu, malgré le backgroundColor différent en apparence dans le
  // code. C'est cette bordure (theme.colors.border) qui crée la séparation
  // visible aujourd'hui ; si "surface" est un jour rendu réellement distinct
  // de "background" dans le thème, le fond seul suffira aussi.
  topBar: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  bottomBar: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  // Pas de token "hauteur de barre de progression" dans le thème : réutilise
  // spacing.sm (8), la même valeur qui servait déjà de diamètre aux points de
  // progression précédents, pour garder une épaisseur cohérente avec le
  // reste de l'écran. radius.sm vaut la moitié de spacing.sm, d'où des bouts
  // arrondis en pilule plutôt qu'un rectangle droit.
  progressTrack: {
    height: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  heartsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  // Pas de token de couleur appliqué ici : l'emoji ❤️ a sa propre couleur
  // fixe (rouge) sur toutes les plateformes et ignore la prop "color" de
  // Text, comme tous les emoji — aucun theme.colors ne s'applique ni n'est
  // nécessaire. (@expo/vector-icons n'est pas installé dans ce projet, d'où
  // le repli emoji prévu par la consigne plutôt qu'une icône Ionicons.)
  heart: {
    fontSize: theme.text.size.md,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  headingIcon: {
    fontSize: theme.text.size.xl,
  },
  heading: {
    fontSize: theme.text.size.xl,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
    textAlign: 'left',
  },
  text: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.regular,
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: theme.text.size.md * 1.4,
  },
  // Pas de token "bouton primaire" dans le thème (theme.card est pensé pour
  // des lignes de liste, pas un bouton) : composé ici à partir des tokens
  // couleur/espacement/rayon existants, comme déjà fait ailleurs (ex:
  // CourseParcoursScreen) quand un style n'a pas d'équivalent direct.
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  // Pas de token "texte sur fond coloré" dans le thème (theme.colors.text est
  // pensé pour du texte sombre sur fond clair) : blanc en dur ici, comme déjà
  // fait ailleurs dans l'app pour ce même besoin (ex: CourseParcoursScreen,
  // PianoChord).
  buttonLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
});
