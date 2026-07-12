import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ImproScreen from '../exercices/impro';
import ImproMenuScreen from '../exercices/improMenu';
import CreationScreen from '../exercices/creation';
import ExercisesScreen from '../screens/ExercisesScreen';
import { colors } from '../theme';

// Écrans + params de la pile "Exercices". `undefined` = pas de paramètre attendu.
export type ExercisesStackParamList = {
  ExercisesList: undefined;
  // Menu intercalé entre la carte "Improvisation / Composition" et les deux modes.
  ImproMenu: undefined;
  Impro: undefined;
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
        component={ImproScreen}
        options={{ title: 'Improvisation libre' }}
      />
      <Stack.Screen
        name="Creation"
        component={CreationScreen}
        options={{ title: 'Crée ta progression' }}
      />
    </Stack.Navigator>
  );
}
