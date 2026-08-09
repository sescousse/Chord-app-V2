import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { theme } from '../theme';
import { supabase } from '../lib/supabase';
import type { AuthStackParamList } from '../navigation/AuthStack';

type SignInScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

export default function SignInScreen() {
  const navigation = useNavigation<SignInScreenNavigationProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Renseigne un email et un mot de passe.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Message d'erreur le plus courant ici : "Invalid login credentials"
      // (email et/ou mot de passe incorrects, ou compte pas encore confirmé
      // si la confirmation email est activée) — affiché tel quel plus bas.
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      // Pas de navigation manuelle : une connexion réussie change la session
      // Supabase, ce qui déclenche onAuthStateChange dans AuthContext — et
      // c'est CE changement qui fait basculer l'aiguillage racine (App.tsx)
      // de AuthStack vers AppStack, automatiquement.
    } catch (caughtError) {
      // Erreurs qui n'arrivent jamais jusqu'à Supabase (pas de réseau...).
      setErrorMessage(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={theme.text.title}>Se connecter</Text>
        <Text style={theme.text.subtitle}>Connecte-toi avec ton email et ton mot de passe.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <Pressable style={styles.button} onPress={handleSignIn} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonLabel}>Se connecter</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.linkText}>Pas de compte ? S'inscrire</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  form: {
    gap: theme.spacing.md,
  },
  // Pas de token "champ de formulaire" dans le thème : composé à partir des
  // tokens existants, comme les autres éléments "sans équivalent direct"
  // ailleurs dans l'app (ex: le bouton de LessonCourseScreen).
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.text.size.md,
    color: theme.colors.text,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    textAlign: 'center',
  },
  linkText: {
    textAlign: 'center',
    color: theme.colors.primary,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
  },
});
