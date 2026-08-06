import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { theme } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { SocialStackParamList } from '../navigation/SocialStack';

// Ce composant est enregistré comme route "SearchUsers" de SocialStack (voir
// SocialStack.tsx) — c'est ce qui lui donne accès à navigation.navigate
// ('UserProfile', ...) plus bas, vers l'autre route de cette même pile.
type SearchUsersScreenNavigationProp = NativeStackNavigationProp<SocialStackParamList, 'SearchUsers'>;

// Un résultat de recherche : nom (pour l'affichage/l'avatar) + xp/niveau
// (aperçu rapide, sans avoir besoin du Profil complet de ProfileContext.tsx).
type SearchResultItem = {
  id: string;
  nom_utilisateur: string | null;
  xp: number;
  niveau: number;
};

// Délai d'attente après la dernière frappe avant de lancer la recherche —
// voir le commentaire détaillé sur le debounce plus bas.
const SEARCH_DEBOUNCE_MS = 300;

// Nombre maximum de résultats renvoyés par la recherche.
const SEARCH_RESULTS_LIMIT = 20;

export default function SearchUsersScreen() {
  const navigation = useNavigation<SearchUsersScreenNavigationProp>();
  const { user } = useAuth();

  // "searchText" suit CHAQUE frappe (contrôle direct du champ) ;
  // "debouncedSearchText" ne se met à jour que 300ms après la DERNIÈRE
  // frappe (voir le useEffect ci-dessous) — c'est cette 2e valeur, pas
  // "searchText", qui déclenche la vraie requête Supabase plus bas.
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');

  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DEBOUNCE — technique pour éviter de lancer une requête réseau à CHAQUE
  // lettre tapée (ce qui enverrait une requête par frappe, la plupart
  // annulées/inutiles avant même d'avoir fini de taper un nom).
  //
  // Le principe : à chaque frappe (chaque changement de "searchText"), ce
  // useEffect se relance et programme un minuteur de SEARCH_DEBOUNCE_MS
  // (300ms) qui, s'il arrive à son terme, recopie "searchText" dans
  // "debouncedSearchText". MAIS la fonction de nettoyage (le "return"
  // ci-dessous) ANNULE ce minuteur dès la frappe SUIVANTE, avant qu'il ait
  // eu le temps de se déclencher — donc tant que l'utilisateur continue de
  // taper, "debouncedSearchText" ne bouge jamais. Ce n'est que lorsqu'il
  // s'arrête de taper pendant 300ms d'affilée que le minuteur arrive enfin
  // à son terme et que "debouncedSearchText" se met à jour — DÉCLENCHANT
  // ALORS la recherche (voir le useEffect suivant, qui dépend de cette
  // valeur, pas de "searchText").
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  // RECHERCHE — se déclenche uniquement quand "debouncedSearchText" change
  // (donc au plus une fois par pause de frappe, jamais à chaque lettre).
  useEffect(() => {
    let isMounted = true;

    async function search() {
      const term = debouncedSearchText.trim();

      // Champ vide : pas de résultats à afficher, et surtout pas de requête
      // à lancer (ilike('nom_utilisateur', '%%') matcherait TOUT le monde).
      if (!term) {
        setResults([]);
        setError(null);
        setIsLoading(false);
        return;
      }
      if (!user) return;

      setIsLoading(true);
      setError(null);

      // REQUÊTE ilike — '%' avant ET après le texte saisi = "contient ce
      // texte n'importe où dans le nom" (comme un LIKE SQL classique) ;
      // "ilike" (au lieu de "like") le fait de façon INSENSIBLE À LA CASSE
      // ("Marie" trouve aussi bien "marie" que "MARIE"). .neq exclut mon
      // propre profil des résultats — pas la peine de me retrouver moi-même
      // en cherchant mon propre nom. Lecture autorisée à tout utilisateur
      // connecté par le RLS de "profils".
      const { data, error: searchError } = await supabase
        .from('profils')
        .select('id, nom_utilisateur, xp, niveau')
        .ilike('nom_utilisateur', `%${term}%`)
        .neq('id', user.id)
        .limit(SEARCH_RESULTS_LIMIT);

      if (!isMounted) return;

      if (searchError) {
        setError(searchError.message);
        setResults([]);
      } else {
        // Cast explicite (pas de schéma "Database" généré depuis Supabase,
        // même raison que ProfileContext.tsx) — jamais de "any".
        setResults(data as SearchResultItem[]);
      }
      setIsLoading(false);
    }

    search();

    return () => {
      isMounted = false;
    };
  }, [debouncedSearchText, user]);

  // NAVIGATION VERS LE PROFIL — même route "UserProfile" que les bulles de
  // SocialScreen.tsx et le suivi s'y fait exactement pareil (bouton Suivre/
  // Ne plus suivre déjà géré par UserProfileScreen, rien à répéter ici).
  const handleOpenProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const hasSearchTerm = searchText.trim().length > 0;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Rechercher un utilisateur"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoFocus
        value={searchText}
        onChangeText={setSearchText}
      />

      <ScrollView contentContainerStyle={styles.resultsContent}>
        {!hasSearchTerm && (
          <Text style={theme.text.subtitle}>Tape un nom d'utilisateur pour lancer la recherche.</Text>
        )}

        {hasSearchTerm && isLoading && (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        )}

        {hasSearchTerm && !isLoading && error && <Text style={styles.errorText}>{error}</Text>}

        {hasSearchTerm && !isLoading && !error && results.length === 0 && (
          <Text style={theme.text.subtitle}>Aucun utilisateur ne correspond à "{searchText.trim()}".</Text>
        )}

        {hasSearchTerm && !isLoading && !error && results.length > 0 && (
          <View style={styles.resultsList}>
            {results.map((item) => (
              <Pressable
                key={item.id}
                style={styles.resultItem}
                onPress={() => handleOpenProfile(item.id)}
              >
                <View style={styles.resultAvatar}>
                  {/* TODO: illustration du personnage — 1re lettre du nom
                      (ou icône générique si pas de nom) en attendant, même
                      convention que SocialScreen.tsx/UserProfileScreen.tsx. */}
                  <Text style={styles.resultAvatarText}>
                    {item.nom_utilisateur?.trim()
                      ? item.nom_utilisateur.trim().charAt(0).toUpperCase()
                      : '👤'}
                  </Text>
                </View>
                <View style={styles.resultTextGroup}>
                  <Text style={styles.resultName}>{item.nom_utilisateur ?? 'Utilisateur'}</Text>
                  <Text style={styles.resultMeta}>
                    Niveau {item.niveau} · {item.xp.toLocaleString('fr-FR')} XP
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  // Même style de champ que SignInScreen.tsx/SignUpScreen.tsx, pour rester
  // cohérent avec les autres champs de saisie de l'app.
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
  resultsContent: {
    gap: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    textAlign: 'center',
  },
  resultsList: {
    gap: theme.spacing.md,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  // Même avatar rond (fond background, bordure, initiale) que les bulles de
  // SocialScreen.tsx/UserProfileScreen.tsx, juste réutilisé en ligne plutôt
  // qu'en grille.
  resultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarText: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  resultTextGroup: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  resultName: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  resultMeta: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
});
