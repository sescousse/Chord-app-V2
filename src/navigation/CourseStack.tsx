import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ImproScreen from '../exercices/impro';
import CoursesScreen from '../screens/CoursesScreen';
import { colors } from '../theme';

export type CourseStackParamList = {
  CoursesList: undefined;
  Degrés: undefined;
  Gammes: undefined;
};

const Stack = createNativeStackNavigator<CourseStackParamList>();

export default function CoursesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="CoursesList"
        component={CoursesScreen}
        options={{ title: 'Cours' }}
      />
      <Stack.Screen name="Degrés" component={ImproScreen} options={{ title: 'Degrés' }} />
      <Stack.Screen name="Gammes" component={ImproScreen} options={{ title: 'Gammes' }} />
    </Stack.Navigator>
  );
}
