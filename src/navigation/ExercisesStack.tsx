import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ImproIntroScreen from '../exercices/improIntro';
import ImproChoicesScreen from '../exercices/improChoices';
import ResultScreen from '../exercices/improResult';
import ImproMenuScreen from '../exercices/improMenu';
import CreationScreen from '../exercices/creation';
import ExercisesScreen from '../screens/ExercisesScreen';
import type { Emotion } from '../dataset/progression';
import { colors } from '../theme';

// Écrans + params de la pile "Exercices". `undefined` = pas de paramètre attendu.
export type ExercisesStackParamList = {
  ExercisesList: undefined;
  // Menu intercalé entre la carte "Improvisation / Composition" et les deux modes.
  ImproMenu: undefined;
  // Flux guidé "Improvisation libre", désormais en 3 écrans (au lieu de 4,
  // voir ImproChoices ci-dessous) :
  // 1) Impro : écran d'intro animé (fondu), pas de param en entrée — voir
  //    ImproIntroScreen. Garde ce nom de route historique : ImproMenuScreen
  //    navigue déjà vers "Impro" sans paramètre, inutile de le modifier.
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
  Creation: undefined;
};

const Stack = createNativeStackNavigator<ExercisesStackParamList>();

export default function ExercisesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="ExercisesList"
        component={ExercisesScreen}
        options={{ title: 'Exercices' }}
      />
      <Stack.Screen
        name="ImproMenu"
        component={ImproMenuScreen}
        options={{ title: 'Improvisation' }}
      />
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
    </Stack.Navigator>
  );
}
