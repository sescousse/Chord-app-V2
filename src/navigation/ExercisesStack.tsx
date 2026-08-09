import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ImproIntroScreen from '../exercices/improIntro';
import ImproChoicesScreen from '../exercices/improChoices';
import ResultScreen from '../exercices/improResult';
import CreationScreen from '../exercices/creation';
import ExercisesScreen from '../screens/ExercisesScreen';
import PlaceholderScreen, { type PlaceholderParams } from '../screens/PlaceholderScreen';
import type { Emotion } from '../dataset/progression';
import { colors } from '../theme';

// Écrans + params de la pile "Exercices" (affichée sous le libellé
// "Apprentissage" dans la barre du bas — voir RootNavigator.tsx : seul le
// libellé visible change, cette pile et sa clé de route restent
// "Exercises"/"ExercisesStack", même convention que "Social" pour l'onglet
// "Profil"). `undefined` = pas de paramètre attendu.
export type ExercisesStackParamList = {
  ExercisesList: undefined;
  // Flux guidé "Improvisation guidée" (carte de la section JOUER sur
  // ExercisesScreen), en 3 écrans :
  // 1) Impro : écran d'intro animé (fondu), pas de param en entrée — voir
  //    ImproIntroScreen. Point d'entrée DIRECT depuis la carte "Improvisation
  //    guidée" (l'ancien menu intercalé ImproMenuScreen, qui proposait aussi
  //    "Crée ta progression" sur un écran séparé, a été retiré : ce choix se
  //    fait maintenant entre 2 cartes distinctes sur ExercisesScreen).
  Impro: undefined;
  // 2) ImproChoices : émotion ET style choisis sur UNE SEULE page (remplace
  //    les 2 anciens écrans séparés — l'ancien "Impro" pour l'émotion, et
  //    "ImproStyle" pour le style) — pas de param en entrée, les 2 choix
  //    sont faits ICI puis transmis directement à ImproResult.
  ImproChoices: undefined;
  // 3) ImproResult : reçoit émotion + style choisis sur ImproChoices. "style"
  //    est désormais OPTIONNEL : le bouton "Voir les progressions" de
  //    ImproChoices s'active dès que l'émotion est choisie, même sans style
  //    (le style ne filtre de toute façon pas encore les progressions — voir
  //    ImproChoicesScreen et ResultScreen).
  ImproResult: { emotion: Emotion; style?: string };
  // "Composition assistée" (carte de la section JOUER) : point d'entrée
  // direct, comme Impro ci-dessus.
  Creation: undefined;
  // Écran générique "À venir" pour toutes les cartes "Bientôt" de
  // ExercisesScreen (Backing tracks, Flash cards, cartes ÉCOUTER/APPRENDRE) —
  // même composant que les 7 placeholders du menu réglages (voir
  // PlaceholderScreen.tsx/AppStack.tsx), seul "titre" varie par carte.
  ComingSoon: PlaceholderParams;
};

const Stack = createNativeStackNavigator<ExercisesStackParamList>();

export default function ExercisesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.text,
      }}
    >
      {/* headerShown: false : "Exercices" était un header de navigation natif
          (title ci-dessous, maintenant retiré) — demande explicite de retirer
          cette barre de titre. Scopé à CET écran seulement (pas au Navigator
          entier via screenOptions) : les écrans suivants du flux (Improvisation,
          Émotion & style, Résultat, Crée ta progression) gardent leur header
          natif normal, dont le bouton retour est nécessaire à leur navigation. */}
      <Stack.Screen name="ExercisesList" component={ExercisesScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Impro"
        component={ImproIntroScreen}
        options={{ title: 'Improvisation libre' }}
      />
      <Stack.Screen
        name="ImproChoices"
        component={ImproChoicesScreen}
        options={{ title: 'Émotion & style' }}
      />
      <Stack.Screen
        name="ImproResult"
        component={ResultScreen}
        options={{ title: 'Résultat' }}
      />
      <Stack.Screen
        name="Creation"
        component={CreationScreen}
        options={{ title: 'Crée ta progression' }}
      />
      {/* "title" vient du param "titre" de la carte tapée (ex: "Backing
          tracks", "Flash cards") plutôt que d'une valeur fixe — un seul écran
          pour toutes les cartes "Bientôt", voir PlaceholderScreen.tsx. */}
      <Stack.Screen
        name="ComingSoon"
        component={PlaceholderScreen}
        options={({ route }) => ({ title: route.params.titre })}
      />
    </Stack.Navigator>
  );
}
