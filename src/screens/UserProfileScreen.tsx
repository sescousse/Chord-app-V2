import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { theme } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Profil } from '../context/ProfileContext';
import { suivre, nePlusSuivre, estSuivi, compterAbonnes, compterAbonnements } from '../lib/follows';
import type { SocialStackParamList } from '../navigation/SocialStack';

// Profil de N'IMPORTE QUEL utilisateur (le mien ou un autre), reçu en
// paramètre de navigation — voir SocialStack.tsx (ouvert depuis l'onglet
// "Social" de la barre du bas). Contrairement à ProfileContext (scopé à MON
// profil uniquement), cet écran fait sa PROPRE lecture ponctuelle, sur l'id
// reçu.
type UserProfileScreenProps = NativeStackScreenProps<SocialStackParamList, 'UserProfile'>;

export default function UserProfileScreen({ route }: UserProfileScreenProps) {
  const { userId } = route.params;
  const { user } = useAuth();
  // On ne peut pas se suivre soi-même : pas de bouton Suivre dans ce cas
  // (voir le rendu plus bas).
  const isOwnProfile = user?.id === userId;

  const [profil, setProfil] = useState<Profil | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowActionPending, setIsFollowActionPending] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  // Charge le profil ciblé, ses compteurs, et (si ce n'est pas moi) si je le
  // suis déjà — relancé si "userId" change (naviguer d'un profil à un autre
  // sans redémonter cet écran, ex: via une future liste d'amis).
  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      // LECTURE DU PROFIL CIBLÉ — même requête que ProfileContext.tsx, mais
      // sur N'IMPORTE QUEL id (pas seulement le mien) : autorisé par le RLS
      // de "profils" (lecture ouverte à tous les utilisateurs connectés).
      const { data, error: selectError } = await supabase
        .from('profils')
        .select('*')
        .eq('id', userId)
        .single();

      if (!isMounted) return;

      if (selectError) {
        setError(selectError.message);
        setProfil(null);
        setIsLoading(false);
        return;
      }

      // Cast explicite vers Profil, même raison que dans ProfileContext.tsx
      // (pas de schéma "Database" généré depuis Supabase) — jamais de "any".
      setProfil(data as Profil);

      const [followersResult, followingResult] = await Promise.all([
        compterAbonnes(userId),
        compterAbonnements(userId),
      ]);
      if (!isMounted) return;
      setFollowersCount(followersResult.count);
      setFollowingCount(followingResult.count);

      if (!isOwnProfile) {
        const followStatus = await estSuivi(userId);
        if (!isMounted) return;
        setIsFollowing(followStatus.isFollowing);
      }

      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [userId, isOwnProfile]);

  // LOGIQUE DU BOUTON SUIVRE/NE PLUS SUIVRE : un seul bouton, 2
  // comportements selon "isFollowing" déjà connu (chargé via estSuivi() dans
  // l'effet ci-dessus) — nePlusSuivre() si je le suis déjà, suivre() sinon.
  // Après l'action, on RECHARGE le compteur d'abonnés depuis Supabase
  // plutôt que de l'incrémenter/décrémenter à la main côté client : ça reste
  // juste même si quelqu'un d'autre avait déjà changé ce chiffre entretemps.
  const handleToggleFollow = async () => {
    setFollowError(null);
    setIsFollowActionPending(true);

    const action = isFollowing ? nePlusSuivre : suivre;
    const { error: actionError } = await action(userId);

    if (actionError) {
      setFollowError(actionError);
      setIsFollowActionPending(false);
      return;
    }

    setIsFollowing(!isFollowing);

    const followersResult = await compterAbonnes(userId);
    setFollowersCount(followersResult.count);

    setIsFollowActionPending(false);
  };

  if (isLoading) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !profil) {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.errorText}>{error ?? 'Profil introuvable.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarIcon}>👤</Text>
        </View>
        <Text style={styles.profileName}>{profil.nom_utilisateur ?? 'Utilisateur'}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profil.xp.toLocaleString('fr-FR')}</Text>
            <Text style={styles.statLabel}>XP</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profil.niveau}</Text>
            <Text style={styles.statLabel}>Niveau</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followersCount ?? '—'}</Text>
            <Text style={styles.statLabel}>Abonnés</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followingCount ?? '—'}</Text>
            <Text style={styles.statLabel}>Abonnements</Text>
          </View>
        </View>

        {/* Bouton Suivre/Ne plus suivre : absent sur MON propre profil (on
            ne peut pas se suivre soi-même). */}
        {!isOwnProfile && (
          <>
            <Pressable
              style={[styles.followButton, isFollowing && styles.followButtonActive]}
              onPress={handleToggleFollow}
              disabled={isFollowActionPending}
            >
              {isFollowActionPending ? (
                <ActivityIndicator color={isFollowing ? theme.colors.primary : '#FFFFFF'} />
              ) : (
                <Text
                  style={[
                    styles.followButtonLabel,
                    isFollowing && styles.followButtonLabelActive,
                  ]}
                >
                  {isFollowing ? 'Ne plus suivre' : 'Suivre'}
                </Text>
              )}
            </Pressable>
            {followError && <Text style={styles.errorText}>{followError}</Text>}
          </>
        )}
      </View>
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
  },
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    textAlign: 'center',
  },
  // Même carte que ProfileScreen.tsx (coins arrondis, ombre légère) — voir
  // le commentaire détaillé là-bas sur l'absence de token "ombre de carte".
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarCircle: {
    alignSelf: 'center',
    width: theme.spacing.xl * 3,
    height: theme.spacing.xl * 3,
    borderRadius: (theme.spacing.xl * 3) / 2,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    fontSize: theme.text.size.xxxl,
  },
  profileName: {
    textAlign: 'center',
    fontSize: theme.text.size.xl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  // 4 stats sur une seule ligne, flex: 1 chacune (pas de largeur en %) :
  // elles se partagent l'espace à parts égales sans jamais déborder, quelle
  // que soit la largeur de l'écran.
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
  },
  statValue: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  // État "je ne le suis pas" : plein, accent primary (même famille que les
  // autres boutons d'action de l'app, ex: "Ajouter des amis" de ProfileScreen.tsx).
  followButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  // État "je le suis déjà" : inversé (contour primary, fond neutre) plutôt
  // que la même couleur pleine que "Suivre" — la couleur seule suffit à
  // distinguer les 2 états sans dépendre uniquement du texte.
  followButtonActive: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  followButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
  followButtonLabelActive: {
    color: theme.colors.primary,
  },
});
