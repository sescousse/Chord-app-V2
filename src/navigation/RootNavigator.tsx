import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import ExercisesStack from './ExercisesStack';
import CoursesScreen from '../screens/CoursesScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors, tabBar } from '../theme';

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
        tabBarStyle: tabBar,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Tab.Screen name="Courses" component={CoursesScreen} options={{ title: 'Cours' }} />
      {/* headerShown: false ici car ExercisesStack a déjà ses propres headers (sinon deux barres superposées). */}
      <Tab.Screen
        name="Exercises"
        component={ExercisesStack}
        options={{ title: 'Exercices', headerShown: false }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
