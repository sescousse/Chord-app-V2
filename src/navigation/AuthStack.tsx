import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import { colors } from '../theme';

// Pile affichée par App.tsx UNIQUEMENT quand aucun utilisateur n'est
// connecté (voir l'aiguillage dans App.tsx) — SignIn en premier écran,
// SignUp accessible depuis son lien "S'inscrire".
export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="SignIn"
      // headerShown: false : chaque écran compose son propre titre dans son
      // contenu (voir SignInScreen/SignUpScreen), pas besoin du header natif.
      screenOptions={{ headerShown: false, headerTintColor: colors.text }}
    >
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}
