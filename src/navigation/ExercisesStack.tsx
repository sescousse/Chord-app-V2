import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ImproScreen from '../exercices/impro';
import ExercisesScreen from '../screens/ExercisesScreen';
import { colors } from '../theme';

// Écrans + params de la pile "Exercices". `undefined` = pas de paramètre attendu.
export type ExercisesStackParamList = {
  ExercisesList: undefined;
  Impro: undefined;
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
      <Stack.Screen name="Impro" component={ImproScreen} options={{ title: 'Improvisation' }} />
    </Stack.Navigator>
  );
}
