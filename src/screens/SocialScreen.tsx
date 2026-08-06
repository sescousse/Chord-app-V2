import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { theme } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { SocialStackParamList } from '../navigation/SocialStack';

// Ce composant est l'écran INITIAL de SocialStack (voir SocialStack.tsx,
// route "SocialMain") — c'est ce qui lui donne accès à navigation.navigate
// ('UserProfile', ...) plus bas, vers l'autre route de cette même pile.
type SocialScreenNavigationProp = NativeStackNavigationProp<SocialStackParamList, 'SocialMain'>;

// Juste de quoi afficher/ouvrir une bulle — pas besoin du Profil complet
// (interface Profil, dans ProfileContext.tsx) pour cette liste.
type ProfileListItem = {
  id: string;
  nom_utilisateur: string | null;
};

// Combien de profils demander à Supabase au maximum — cette page n'affiche
// de toute façon qu'UNE SEULE rangée (voir plus bas), largement moins que
// 50 sur un écran de téléphone ; cette limite évite juste de rapatrier tous
// les profils de l'app à chaque ouverture, une fois qu'il y en aura beaucoup.
const MAX_PROFILES_FETCHED = 50;

// Taille d'une bulle (cercle) et espacement entre bulles — pas de token
// "avatar"/"bulle" dans le thème : composés à partir de spacing, comme
// l'avatar de ProfileScreen.tsx (qui utilise spacing.xl * 3, plus grand —
// celui-ci reste volontairement plus petit pour qu'un maximum tienne sur
// une seule ligne).
const BUBBLE_SIZE = theme.spacing.xl * 2;
const BUBBLE_GAP = theme.spacing.md;

export default function SocialScreen() {
  const navigation = useNavigation<SocialScreenNavigationProp>();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      // REQUÊTE DE LISTE — annuaire GLOBAL temporaire : tous les profils
      // sauf le mien (.neq, "not equal"), sans aucun filtre de recherche.
      // Lecture autorisée à tout utilisateur connecté par le RLS de
      // "profils". Ça reste volontairement simple tant que l'app a peu
      // d'utilisateurs ; une vraie recherche/découverte (par nom, par
      // affinité...) remplacera cet annuaire brut une fois qu'il y en aura
      // beaucoup — c'est d'ailleurs à ça que sert la bulle "+" plus bas.
      const { data, error: selectError } = await supabase
        .from('profils')
        .select('id, nom_utilisateur')
        .neq('id', user.id)
        .limit(MAX_PROFILES_FETCHED);

      if (!isMounted) return;

      if (selectError) {
        setError(selectError.message);
        setProfiles([]);
      } else {
        // Cast explicite (pas de schéma "Database" généré depuis Supabase,
        // même raison que ProfileContext.tsx) — jamais de "any".
        setProfiles(data as ProfileListItem[]);
      }
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // COMBIEN DE BULLES TIENNENT SUR UNE SEULE LIGNE — cette page ne wrappe
  // PAS et ne scrolle PAS horizontalement cette rangée : s'il y a plus
  // d'utilisateurs que de place, on en affiche simplement moins, plutôt que
  // de passer à la ligne. windowWidth vient de useWindowDimensions() (déjà
  // le pattern utilisé ailleurs dans l'app pour du responsive, ex:
  // SlidePanel.tsx/PianoChord.tsx) moins le padding horizontal de la page
  // (styles.content, theme.spacing.lg de chaque côté).
  const availableWidth = windowWidth - theme.spacing.lg * 2;
  const bubbleSlotWidth = BUBBLE_SIZE + BUBBLE_GAP;
  // "+ BUBBLE_GAP" au numérateur : n bulles occupent n tailles de bulle MAIS
  // seulement (n-1) espacements (rien après la dernière) — cette formule
  // calcule le plus grand n qui tient dans availableWidth avec cette règle.
  const maxBubbles = Math.max(1, Math.floor((availableWidth + BUBBLE_GAP) / bubbleSlotWidth));
  // La bulle "+" (recherche) occupe TOUJOURS la dernière place de la
  // rangée : les profils affichés se limitent donc à maxBubbles - 1.
  const visibleProfiles = profiles.slice(0, Math.max(0, maxBubbles - 1));

  // NAVIGATION VERS LA RECHERCHE — route "SearchUsers" de SocialStack (voir
  // SocialStack.tsx / SearchUsersScreen.tsx) : recherche par nom avec
  // debounce, résultats menant chacun au même écran de profil que les
  // bulles ci-dessus.
  const handleSearchPress = () => {
    navigation.navigate('SearchUsers');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={theme.text.title}>Social</Text>
      <Text style={theme.text.subtitle}>
        Annuaire temporaire de tous les utilisateurs — une vraie recherche arrivera plus tard.
      </Text>

      {isLoading && <ActivityIndicator size="large" color={theme.colors.primary} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {!isLoading && !error && (
        <View style={styles.bubbleRow}>
          {visibleProfiles.map((item) => (
            <Pressable
              key={item.id}
              style={styles.bubbleItem}
              onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
            >
              <View style={styles.bubbleCircle}>
                {/* TODO: illustration du personnage — 1re lettre du nom (ou
                    icône générique si pas de nom) en attendant. */}
                <Text style={styles.bubbleInitial}>
                  {item.nom_utilisateur?.trim() ? item.nom_utilisateur.trim().charAt(0).toUpperCase() : '👤'}
                </Text>
              </View>
              <Text style={styles.bubbleLabel} numberOfLines={1}>
                {item.nom_utilisateur ?? 'Utilisateur'}
              </Text>
            </Pressable>
          ))}

          {/* Bulle "+" — TOUJOURS la dernière de la rangée (voir
              visibleProfiles ci-dessus) : ouvre la recherche par nom. */}
          <Pressable style={styles.bubbleItem} onPress={handleSearchPress}>
            <View style={[styles.bubbleCircle, styles.bubbleCircleAdd]}>
              <Text style={styles.bubbleAddIcon}>+</Text>
            </View>
            <Text style={styles.bubbleLabel} numberOfLines={1}>
              Rechercher
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    textAlign: 'center',
  },
  // flexWrap: 'nowrap' explicite (c'est déjà la valeur par défaut, mais
  // l'écrire clarifie l'intention) : cette rangée ne doit JAMAIS passer à la
  // ligne, voir le calcul de visibleProfiles/maxBubbles plus haut, qui
  // garantit déjà que tout ce qui est rendu ici tient sur une seule ligne.
  bubbleRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: BUBBLE_GAP,
  },
  bubbleItem: {
    width: BUBBLE_SIZE,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  bubbleCircle: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleInitial: {
    fontSize: theme.text.size.xl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  // Bulle "+" : accent primary plein, pour se distinguer immédiatement des
  // bulles de profil (fond surface neutre) — même logique que les boutons
  // d'action pleins ailleurs dans l'app (ex: "Ajouter des amis" de
  // ProfileScreen.tsx).
  bubbleCircleAdd: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  bubbleAddIcon: {
    fontSize: theme.text.size.xl,
    fontWeight: theme.text.weight.bold,
    color: '#FFFFFF',
  },
  bubbleLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
