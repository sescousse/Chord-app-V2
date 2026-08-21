// TEMPORAIRE — écran-hôte MINIMAL pour tester ReproduisAccordExercise (voir
// src/components/ReproduisAccordExercise.tsx, la vraie brique, autonome et
// réutilisable). Ce fichier n'est PAS l'intégration finale : c'est juste un
// point d'entrée de test, accessible depuis le bloc "Découvrir les accords"
// de GammeMenuScreen (voir la route ReproduisAccord dans ExercisesStack.tsx)
// — les futurs points d'entrée réels (depuis un cours, depuis un onglet de
// pratique) écriront chacun leur PROPRE écran-hôte du même genre, avec leur
// propre façon de "quitter" (voir onQuit ci-dessous).
//
// Tout ce que fait CET écran : lire tonique/mode dans les params de route,
// fournir le cadre (fond, safe zone via ScrollView) que ReproduisAccordExercise
// ne fournit pas lui-même, et définir ce que "Quitter" signifie ICI (retour
// au menu du module) — aucune logique d'exercice ici, elle vit entièrement
// dans le composant.
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ExercisesStackParamList } from '../navigation/ExercisesStack';
import { theme } from '../theme';
import { ReproduisAccordExercise } from '../components/ReproduisAccordExercise';

type ReproduisAccordRoute = RouteProp<ExercisesStackParamList, 'ReproduisAccord'>;
type ReproduisAccordNavigation = NativeStackNavigationProp<ExercisesStackParamList, 'ReproduisAccord'>;

export default function ReproduisAccordScreen() {
  const route = useRoute<ReproduisAccordRoute>();
  const navigation = useNavigation<ReproduisAccordNavigation>();
  const { tonique, mode } = route.params;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ReproduisAccordExercise
        tonique={tonique}
        mode={mode}
        onQuit={() => navigation.navigate('GammeMenu', { tonique, mode })}
      />
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
  },
});
