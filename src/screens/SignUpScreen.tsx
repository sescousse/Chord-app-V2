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

type SignUpScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen() {
  const navigation = useNavigation<SignUpScreenNavigationProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Confirmation OPTIONNELLE (consigne) : seulement vérifiée si remplie, voir
  // handleSignUp — la laisser vide ne bloque jamais l'inscription.
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSignUp = async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    if (!email || !password) {
      setErrorMessage('Renseigne un email et un mot de passe.');
      return;
    }
    if (confirmPassword.length > 0 && confirmPassword !== password) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      // error.message courant ici : "Password should be at least 6
      // characters." si le mot de passe est trop court (limite par défaut
      // du projet Supabase, réglable côté dashboard) — affiché tel quel.
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      // PIÈGE CLASSIQUE SUPABASE : avec la confirmation email ACTIVÉE,
      // réinscrire un email déjà utilisé ne renvoie PAS d'erreur — c'est
      // volontaire côté Supabase, pour ne pas révéler quels emails existent
      // déjà (anti-énumération). Le seul indice disponible : l'utilisateur
      // renvoyé a un tableau "identities" VIDE au lieu d'en contenir une
      // nouvelle. Sans cette vérification, l'utilisateur croirait avoir créé
      // un compte alors qu'aucun email n'a été envoyé.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setErrorMessage('Cet email est déjà utilisé. Connecte-toi plutôt.');
        return;
      }

      // Pas de session retournée = confirmation par email requise avant de
      // pouvoir se connecter (comportement PAR DÉFAUT d'un projet Supabase
      // neuf). Voir la note fournie à part pour désactiver ce réglage
      // pendant le développement.
      if (!data.session) {
        setInfoMessage(
          'Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.',
        );
        return;
      }

      // Session retournée directement (confirmation email désactivée, ou
      // déjà confirmée) : AuthContext détecte le changement de session tout
      // seul via onAuthStateChange, et l'aiguillage racine (App.tsx) bascule
      // alors automatiquement vers l'app — rien à faire ici.
    } catch (caughtError) {
      setErrorMessage(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={theme.text.title}>Créer un compte</Text>
        <Text style={theme.text.subtitle}>Inscris-toi avec ton email pour commencer.</Text>

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
          <TextInput
            style={styles.input}
            placeholder="Confirmer le mot de passe (optionnel)"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        {infoMessage && (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>{infoMessage}</Text>
          </View>
        )}

        <Pressable style={styles.button} onPress={handleSignUp} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonLabel}>Créer un compte</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('SignIn')}>
          <Text style={styles.linkText}>Déjà un compte ? Se connecter</Text>
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
  // Carte d'info neutre (pas une erreur) : réutilise la combinaison
  // surface + bordure primary déjà utilisée un peu partout dans l'app pour
  // des cartes/boutons mis en valeur (ex: impro*.tsx) plutôt qu'un nouveau
  // token dédié.
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  infoText: {
    color: theme.colors.text,
    fontSize: theme.text.size.sm,
    textAlign: 'center',
  },
  linkText: {
    textAlign: 'center',
    color: theme.colors.primary,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
  },
});
