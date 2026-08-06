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
import { useProfile } from '../context/ProfileContext';
import type { AuthStackParamList } from '../navigation/AuthStack';

type SignUpScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

// Combien de fois retenter l'écriture du nom d'utilisateur, et avec quel
// délai entre 2 tentatives — voir writeUsername ci-dessous pour le pourquoi.
const USERNAME_UPDATE_MAX_ATTEMPTS = 5;
const USERNAME_UPDATE_RETRY_DELAY_MS = 400;

// Écrit nom_utilisateur dans le profil de l'utilisateur qui vient de
// s'inscrire.
//
// UPDATE, JAMAIS UN INSERT : la ligne "profils" existe déjà à ce stade,
// créée par le trigger d'inscription (voir le contexte donné pour cette
// tâche) — un INSERT entrerait en conflit avec la clé primaire "id" (déjà
// prise) et échouerait. La bonne opération pour "modifier une ligne
// existante" est un UPDATE.
//
// RETRY : le trigger tourne côté serveur juste après la création du compte
// (auth.users), et peut ne pas avoir encore terminé au moment où CET update
// part côté client — un vrai cas de course, pas hypothétique. .select()
// .single() après l'update fait échouer la requête avec le code Postgrest
// "PGRST116" (aucune ligne trouvée) si la ligne n'existe pas encore : on
// détecte précisément CE cas pour retenter après un court délai, plutôt que
// d'abandonner immédiatement ou de retenter aveuglément sur n'importe quelle
// erreur (ex: pas la peine de retenter une vraie erreur réseau).
async function writeUsername(userId: string, username: string): Promise<string | null> {
  for (let attempt = 1; attempt <= USERNAME_UPDATE_MAX_ATTEMPTS; attempt += 1) {
    const { error } = await supabase
      .from('profils')
      .update({ nom_utilisateur: username })
      .eq('id', userId)
      .select()
      .single();

    if (!error) {
      return null;
    }

    const isProfileRowNotReadyYet = error.code === 'PGRST116';
    if (!isProfileRowNotReadyYet || attempt === USERNAME_UPDATE_MAX_ATTEMPTS) {
      return error.message;
    }

    await new Promise((resolve) => setTimeout(resolve, USERNAME_UPDATE_RETRY_DELAY_MS));
  }

  return "Le profil n'a pas pu être trouvé après plusieurs tentatives.";
}

export default function SignUpScreen() {
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  // refreshProfile : voir son usage plus bas, juste après l'écriture du nom
  // d'utilisateur (ProfileContext.tsx).
  const { refreshProfile } = useProfile();

  const [username, setUsername] = useState('');
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

    if (!username.trim()) {
      setErrorMessage("Renseigne un nom d'utilisateur.");
      return;
    }
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
      //
      // Sans session active, auth.uid() ne résout à rien côté serveur : le
      // RLS de "profils" empêcherait de toute façon l'update du nom
      // d'utilisateur ci-dessous. Cette écriture reste donc à faire une fois
      // le compte confirmé et connecté — un flux "complète ton profil" à la
      // première connexion serait la suite logique, mais reste hors
      // périmètre de cette étape.
      if (!data.session) {
        setInfoMessage(
          'Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.',
        );
        return;
      }

      if (!data.user) {
        setErrorMessage('Compte créé, mais une erreur inattendue est survenue.');
        return;
      }

      const usernameError = await writeUsername(data.user.id, username.trim());
      if (usernameError) {
        setErrorMessage(
          `Compte créé, mais le nom d'utilisateur n'a pas pu être enregistré : ${usernameError}`,
        );
        return;
      }

      // Le SELECT initial de ProfileContext (déclenché par l'apparition de
      // la session ci-dessus, via onAuthStateChange) a pu partir AVANT que
      // cet update soit terminé, et donc afficher "nom_utilisateur: null" —
      // ce rechargement explicite garantit que le contexte reflète bien le
      // nom qu'on vient d'écrire, sans attendre un éventuel prochain
      // rechargement.
      await refreshProfile();

      // Pas de navigation manuelle : AuthContext a déjà basculé l'aiguillage
      // racine (App.tsx) vers l'app dès que la session est apparue, plus haut.
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
            placeholder="Nom d'utilisateur"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoComplete="username"
            value={username}
            onChangeText={setUsername}
          />
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
