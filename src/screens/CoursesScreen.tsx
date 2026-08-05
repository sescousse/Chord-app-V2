import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

// ⚠️ Écran actuellement ORPHELIN : plus aucune route/navigateur ne pointe
// vers lui depuis la refonte de navigation (banniere Parcours/Bibliothèque/
// Compétences/Perso dans HomeScreen.tsx, qui affiche CourseParcoursScreen
// directement plutôt que de passer par cette liste groupée par niveau — voir
// HomeStack.tsx). Conservé tel quel (contenu des 11 cours intact) plutôt que
// supprimé, au cas où il faille le rebrancher quelque part plus tard.

// Niveau d'un cours. L'ordre des sections affichées est décidé séparément
// par LEVELS (juste en dessous), pas par cet ordre-ci.
type Level = 'debutant' | 'intermediaire' | 'avance';

type Course = {
  id: string;
  title: string;
  level: Level;
  accentColor: string;
};

// Titre de section affiché pour chaque niveau, DANS L'ORDRE où les sections
// doivent apparaître à l'écran. Seul endroit à modifier pour renommer ou
// réordonner un niveau — le rendu plus bas ne fait que parcourir ce tableau.
const LEVELS: { level: Level; title: string }[] = [
  { level: 'debutant', title: 'Débutant' },
  { level: 'intermediaire', title: 'Intermédiaire' },
  { level: 'avance', title: 'Avancé' },
];

// Les 11 cours. Niveaux PROVISOIRES (à ajuster plus tard). Ajouter un cours
// = ajouter une entrée ici avec son niveau ; les sections plus bas se
// contentent de filtrer ce tableau par niveau, aucune donnée dupliquée
// ailleurs.
const COURSES: Course[] = [
  { id: 'theorie-impro', title: "Théorie pour l'impro", level: 'debutant', accentColor: theme.colors.primary },
  { id: 'socle-improvisation', title: "Socle de l'improvisation", level: 'debutant', accentColor: theme.colors.primary },
  { id: 'accords', title: 'Tout sur les accords', level: 'intermediaire', accentColor: theme.colors.primary },
  { id: 'rythme-groove', title: 'Rythme et groove', level: 'debutant', accentColor: theme.colors.primary },
  { id: 'harmonisation', title: "Guide de l'harmonisation", level: 'intermediaire', accentColor: theme.colors.primary },
  { id: 'emotions', title: 'Jouer ses émotions', level: 'intermediaire', accentColor: theme.colors.primary },
  { id: 'melodie-main-droite', title: 'Mélodie main droite', level: 'intermediaire', accentColor: theme.colors.primary },
  { id: 'accompagnement-main-gauche', title: 'Accompagnement main gauche', level: 'intermediaire', accentColor: theme.colors.primary },
  { id: 'coordination-mains', title: 'Coordination des mains', level: 'intermediaire', accentColor: theme.colors.primary },
  { id: 'jazz-blues-fondamentaux', title: 'Jazz-blues fondamentaux', level: 'avance', accentColor: theme.colors.primary },
  { id: 'jazz-blues-avance', title: 'Jazz-blues avancé', level: 'avance', accentColor: theme.colors.primary },
];

export default function CoursesScreen() {
  // Écran orphelin (voir note en haut de fichier) : aucun de ces 11 cours ne
  // mène encore à un écran réel, un console.log suffit comme placeholder.
  const openCourse = (course: Course) => {
    console.log(course.title);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={theme.text.title}>Cours</Text>

      {/* Une section par niveau (LEVELS), chacune filtrant COURSES par
          niveau puis mappant les cours correspondants en cartes : aucun JSX
          de carte/section n'est dupliqué. */}
      {LEVELS.map(({ level, title }) => {
        const coursesForLevel = COURSES.filter((course) => course.level === level);

        return (
          <View key={level} style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.list}>
              {coursesForLevel.map((course) => (
                <Pressable key={course.id} style={theme.card} onPress={() => openCourse(course)}>
                  <View style={[styles.accentDot, { backgroundColor: course.accentColor }]} />
                  <Text style={theme.cardTitle}>{course.title}</Text>
                </Pressable>
              ))}
            </View>
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
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.md,
  },
  // Pas de token "titre de section" dédié dans le thème (theme.text.title
  // est déjà pris par le titre de page "Cours") : on compose donc ce style à
  // partir des tokens existants (theme.text.size / theme.text.weight /
  // theme.colors) plutôt que d'écrire des valeurs en dur.
  sectionTitle: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  list: {
    gap: theme.spacing.md,
  },
  accentDot: {
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    borderRadius: theme.radius.xl,
  },
});
