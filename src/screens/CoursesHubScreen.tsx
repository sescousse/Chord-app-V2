import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import type { CourseStackParamList } from '../navigation/CourseStack';

type CoursesHubScreenNavigationProp = NativeStackNavigationProp<
  CourseStackParamList,
  'CoursesHub'
>;

// Une carte du hub : sa destination et sa couleur d'accent. "route" est
// restreint aux 2 routes ciblées ici (toutes deux sans paramètre dans
// CourseStackParamList), pas un simple "string" : ça garde
// navigation.navigate(card.route) type-sûr, sans "as" ni "any".
interface HubCard {
  key: string;
  title: string;
  subtitle: string;
  accentColor: string;
  route: 'CoursesList' | 'Library';
}

// "CoursesList" reste le nom de route de l'écran EXISTANT qui affiche les
// cours groupés par niveau (CoursesScreen) — on ne le renomme pas, on
// ajoute juste ce hub par-dessus (voir CourseStack.tsx). 2 couleurs
// d'accent distinctes prises dans le thème (aucune couleur inventée) :
// primary pour le mode phare (Parcours), exercice pour l'autre carte, comme
// déjà réutilisé ailleurs dans l'app pour "ce qui doit ressortir" (ex:
// CourseParcoursScreen, PianoChord).
const HUB_CARDS: HubCard[] = [
  {
    key: 'parcours',
    title: 'Parcours',
    subtitle: 'Apprends étape par étape',
    accentColor: theme.colors.primary,
    route: 'CoursesList',
  },
  {
    key: 'bibliotheque',
    title: 'Bibliothèque',
    subtitle: 'Consulte les cours en détail',
    accentColor: theme.colors.exercice,
    route: 'Library',
  },
];

export default function CoursesHubScreen() {
  const navigation = useNavigation<CoursesHubScreenNavigationProp>();

  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>Cours</Text>

      <View style={styles.cardList}>
        {HUB_CARDS.map((card) => (
          <Pressable
            key={card.key}
            style={[styles.card, { backgroundColor: card.accentColor }]}
            onPress={() => navigation.navigate(card.route)}
          >
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  cardList: {
    gap: theme.spacing.lg,
  },
  // Cartes "ludiques" : grandes, très arrondies (theme.radius.xl, le rayon le
  // plus prononcé du thème) et en pleine couleur d'accent (pas juste un
  // liseré) pour ressembler à 2 gros boutons de mode plutôt qu'à des lignes
  // de liste classiques (voir theme.card, qui lui sert pour des listes).
  card: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  // Pas de token "texte sur fond coloré" dans le thème (theme.colors.text est
  // pensé pour du texte sombre sur fond clair) : blanc en dur ici, comme déjà
  // fait ailleurs dans l'app pour ce même besoin (ex: CourseParcoursScreen,
  // PianoChord, LessonCourseScreen).
  cardTitle: {
    fontSize: theme.text.size.xxl,
    fontWeight: theme.text.weight.bold,
    color: '#FFFFFF',
  },
  cardSubtitle: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.regular,
    color: '#FFFFFF',
  },
});
