import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import CoursesScreen from '../screens/CoursesScreen';
import ExercisesScreen from '../screens/ExercisesScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme/colors';

export type RootTabParamList = {
  Home: undefined;
  Courses: undefined;
  Exercises: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Tab.Screen name="Courses" component={CoursesScreen} options={{ title: 'Cours' }} />
      <Tab.Screen name="Exercises" component={ExercisesScreen} options={{ title: 'Exercices' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
