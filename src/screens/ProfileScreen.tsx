import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { theme } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { compterAbonnes, compterAbonnements } from '../lib/follows';

type RecapItem = {
  id: string;
  icon: string;
  label: string;
  value: string;
};

// Formate une date Postgres (chaîne ISO renvoyée par Supabase pour
// "date_inscription") en "mois année" français — ex: "janvier 2026".
function formatMonthYear(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
    new Date(isoDate),
  );
}

type Achievement = {
  id: string;
  icon: string;
  title: string;
  // Débloqué ou non : pilote le style grisé/verrouillé du badge (voir
  // achievementIconCircleLocked/achievementTitleLocked plus bas) — données
  // en dur, à remplacer plus tard par une vraie logique de déblocage.
  unlocked: boolean;
};

// données en dur, à remplacer plus tard (vrais succès une fois le système de
// déblocage construit) — 2 débloqués + 2 verrouillés pour illustrer tout de
// suite les deux états.
const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-lesson', icon: '🎉', title: 'Première leçon', unlocked: true },
  { id: 'streak-7', icon: '🔥', title: '7 jours de suite', unlocked: true },
  { id: 'streak-30', icon: '🏆', title: '30 jours de suite', unlocked: false },
  { id: 'theory-master', icon: '📚', title: 'Maître de la théorie', unlocked: false },
];

export default function ProfileScreen() {
  const { user } = useAuth();
  // 3 états exposés par ProfileContext : tant que isProfileLoading est vrai,
  // "profil" n'est pas encore fiable ; ensuite, soit "profil" est rempli
  // (succès), soit "profileError" l'est (échec) — voir ProfileContext.tsx.
  const { profil, isLoading: isProfileLoading, error: profileError } = useProfile();

  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);

  // useFocusEffect (pas un simple useEffect) : cet écran est rendu comme un
  // onglet de la bannière de HomeScreen (voir HomeScreen.tsx), pas démonté
  // quand on pousse UserProfileScreen par-dessus pour suivre quelqu'un —
  // sans ça, revenir ici après avoir suivi/plus suivi quelqu'un depuis cet
  // écran-là afficherait des compteurs périmés. useFocusEffect relance donc
  // ce chargement à CHAQUE fois que cet écran redevient visible, pas
  // seulement à son premier montage.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      let isActive = true;

      Promise.all([compterAbonnes(user.id), compterAbonnements(user.id)]).then(
        ([followersResult, followingResult]) => {
          if (!isActive) return;
          setFollowersCount(followersResult.count);
          setFollowingCount(followingResult.count);
        },
      );

      return () => {
        isActive = false;
      };
    }, [user]),
  );

  // Pas de navigation manuelle après la déconnexion : signOut() vide la
  // session Supabase, ce qui déclenche onAuthStateChange dans AuthContext
  // et fait basculer tout seul l'aiguillage racine (App.tsx) vers AuthStack.
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Erreur', error.message);
    }
  };

  // Nom affiché : nom_utilisateur si renseigné — pas encore le cas
  // aujourd'hui, ce champ sera rempli lors d'une prochaine étape
  // (nom d'utilisateur demandé à l'inscription) — sinon repli sur l'email du
  // compte connecté (toujours disponible via AuthContext), puis un dernier
  // repli générique si même l'email manquait.
  const displayName = isProfileLoading
    ? '…'
    : (profil?.nom_utilisateur ?? user?.email ?? 'Utilisateur');

  // Pendant le chargement : "Membre depuis…" (pas de saut de mise en page
  // une fois la vraie date connue). En erreur, ou si la colonne était vide :
  // un texte neutre plutôt qu'une date inventée.
  const memberSinceLabel = isProfileLoading
    ? 'Membre depuis…'
    : profil?.date_inscription
      ? `Membre depuis ${formatMonthYear(profil.date_inscription)}`
      : "Date d'inscription indisponible";

  // "…" pendant le chargement, "—" si le profil n'a pas pu être chargé
  // (erreur) — jamais de vraie valeur numérique tant que "profil" n'est pas
  // confirmé rempli, pour ne jamais afficher un XP/streak périmé ou inventé.
  const bestStreakValue = isProfileLoading ? '…' : (profil ? `${profil.meilleure_streak} jours` : '—');
  const totalXpValue = isProfileLoading ? '…' : (profil ? profil.xp.toLocaleString('fr-FR') : '—');

  // Récap : bestStreak/totalXp viennent maintenant du profil Supabase ;
  // favoriteExercise/league restent EN DUR (hors périmètre de cette étape,
  // voir la consigne — pas encore de données réelles pour ces 2-là).
  const recapItems: RecapItem[] = [
    { id: 'bestStreak', icon: '🔥', label: 'Meilleur streak', value: bestStreakValue },
    { id: 'favoriteExercise', icon: '🎹', label: 'Exercice préféré', value: "Reconnaissance d'accords" },
    { id: 'league', icon: '🏅', label: 'Ligue', value: 'Ligue à venir' },
    { id: 'totalXp', icon: '⭐', label: 'XP total', value: totalXpValue },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* BLOC 1 — EN-TÊTE PROFIL : avatar (placeholder), nom, actions
          partage/réglages. Carte à part (styles.card), distincte du bloc
          infos/récap ci-dessous : c'est l'identité de la page, pas une
          "info" parmi d'autres. */}
      <View style={styles.card}>
        <View style={styles.headerActionsRow}>
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              // TODO: action partage
            }}
          >
            <Text style={styles.iconButtonLabel}>📤</Text>
          </Pressable>
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              // TODO: réglages
            }}
          >
            <Text style={styles.iconButtonLabel}>⚙️</Text>
          </Pressable>
        </View>

        {/* TODO: illustration du personnage — rond uni + icône générique en
            attendant (@expo/vector-icons n'est pas installé dans ce projet,
            voir plus bas dans ce fichier ; repli emoji comme partout
            ailleurs dans l'app pour ce même besoin). */}
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarIcon}>👤</Text>
        </View>

        <Text style={styles.profileName}>{displayName}</Text>
      </View>

      {/* Message discret : affiché SEULEMENT si le chargement du profil a
          échoué (ex: pas de réseau) — les champs concernés retombent déjà
          chacun sur un repli neutre ("—") ci-dessus/ci-dessous, ce message
          explique juste pourquoi en un mot, sans bloquer le reste de l'écran. */}
      {profileError && <Text style={styles.profileErrorText}>Profil indisponible pour l'instant.</Text>}

      {/* BLOC 2 — INFOS & RÉCAP : date d'inscription, abonnés/abonnements +
          ajout d'amis, récapitulatif (streak/exercice préféré/ligue/XP), et
          succès (débloqués/verrouillés). Une seule carte : ce sont toutes
          des informations "à propos de ce profil", au même niveau, à la
          différence du bloc 1 qui est l'en-tête d'identité. */}
      <View style={styles.card}>
        <Text style={styles.memberSince}>{memberSinceLabel}</Text>

        {/* flex: 1 sur chaque stat (pas de largeur en %) : les 2 se partagent
            l'espace disponible à parts égales sans jamais déborder, quelle
            que soit la largeur de l'écran — une seule ligne, jamais de
            retour à la ligne à gérer ici (contrairement à tileGrid plus
            bas). */}
        <View style={styles.socialRow}>
          <View style={styles.socialStat}>
            <Text style={styles.socialValue}>{followersCount ?? '…'}</Text>
            <Text style={styles.socialLabel}>Abonnés</Text>
          </View>
          <View style={styles.socialStat}>
            <Text style={styles.socialValue}>{followingCount ?? '…'}</Text>
            <Text style={styles.socialLabel}>Abonnements</Text>
          </View>
        </View>

        <Pressable
          style={styles.addFriendsButton}
          onPress={() => {
            // TODO: action ajout d'amis
          }}
        >
          <Text style={styles.addFriendsButtonLabel}>Ajouter des amis</Text>
        </Pressable>

        <View style={styles.divider} />

        <Text style={theme.text.title}>Récapitulatif</Text>
        <View style={styles.tileGrid}>
          {recapItems.map((item) => (
            <View key={item.id} style={styles.recapTile}>
              <Text style={styles.recapIcon}>{item.icon}</Text>
              <Text style={styles.recapValue}>{item.value}</Text>
              <Text style={styles.recapLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={theme.text.title}>Succès</Text>
        <View style={styles.tileGrid}>
          {ACHIEVEMENTS.map((achievement) => (
            <View key={achievement.id} style={styles.achievementTile}>
              <View
                style={[
                  styles.achievementIconCircle,
                  achievement.unlocked
                    ? styles.achievementIconCircleUnlocked
                    : styles.achievementIconCircleLocked,
                ]}
              >
                <Text style={styles.achievementIcon}>{achievement.icon}</Text>
              </View>
              <Text
                style={[
                  styles.achievementTitle,
                  !achievement.unlocked && styles.achievementTitleLocked,
                ]}
              >
                {achievement.title}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Déconnexion — placée ici (accessible depuis l'onglet bannière
          "Profil" de l'accueil) pour pouvoir tester le socle d'auth de bout
          en bout. Bouton "danger" hors des 2 cartes ci-dessus : ce n'est ni
          une info de profil ni un récap, une action de compte à part. */}
      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutButtonLabel}>Se déconnecter</Text>
      </Pressable>
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
    gap: theme.spacing.xl,
  },
  // Carte de base des 2 blocs (coins arrondis, ombre légère) — mêmes tokens
  // et même ombre "légère" que les cartes de HomeScreen.tsx (pas de token
  // "ombre de carte" dans le thème, déjà signalé là-bas : shadowColor noir
  // reste la valeur standard attendue pour ce type d'effet, indépendante de
  // la palette de couleurs).
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
  headerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  // Pas de token "bouton icône" dans le thème : composé à partir des tokens
  // existants, comme le bouton principal de LessonCourseScreen.
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  iconButtonLabel: {
    fontSize: theme.text.size.lg,
  },
  // Avatar rond PLACEHOLDER (voir le TODO dans le JSX) : taille composée à
  // partir de spacing.xl (pas de token de taille d'avatar dans le thème),
  // fond theme.colors.background pour trancher sur la carte (surface), et
  // une bordure pour un contour net.
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
  memberSince: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  profileErrorText: {
    color: theme.colors.danger,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    textAlign: 'center',
  },
  socialRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  socialStat: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  socialValue: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  socialLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  // Pas de token "bouton secondaire" dans le thème : composé comme le
  // bouton de LessonCourseScreen, en pleine largeur (bouton d'action de
  // bloc, pas un bouton de barre).
  addFriendsButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  addFriendsButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
  // Séparateur fin entre les sous-sections de ce bloc (infos / récap /
  // succès) : theme.colors.border, déjà la couleur de séparation utilisée
  // ailleurs dans l'app (bordures de carte, topBar/bottomBar de
  // LessonCourseScreen...).
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  // Grille 2 colonnes qui wrappe proprement, réutilisée pour le récap ET les
  // succès : MÊME technique que statsGrid dans HomeScreen.tsx (voir le
  // commentaire détaillé là-bas pour le pourquoi) — largeurs en % SANS "gap"
  // sur le conteneur, marginBottom sur chaque tuile pour l'espacement
  // vertical entre les lignes qui reviennent à la ligne.
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  recapTile: {
    width: '48%',
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  recapIcon: {
    fontSize: theme.text.size.xl,
  },
  recapValue: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  recapLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Tuile de succès : contrairement à recapTile, PAS de fond propre — c'est
  // la pastille (achievementIconCircle) qui porte la couleur (doré/gris),
  // la tuile elle-même ne fait que centrer icône + titre, façon "badge"
  // plutôt que "carte de stat".
  achievementTile: {
    width: '48%',
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  achievementIconCircle: {
    width: theme.spacing.xl * 2,
    height: theme.spacing.xl * 2,
    borderRadius: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Débloqué : accent doré dédié (theme.colors.achievementUnlocked, voir le
  // commentaire sur ce token dans colors.ts).
  achievementIconCircleUnlocked: {
    backgroundColor: theme.colors.achievementUnlocked,
  },
  // Verrouillé : réutilise theme.colors.locked, déjà le gris neutre dédié à
  // "verrouillé/désactivé" ailleurs dans l'app (ex: étapes verrouillées de
  // CourseParcoursScreen) — pas besoin d'un second token pour ce même sens.
  achievementIconCircleLocked: {
    backgroundColor: theme.colors.locked,
  },
  achievementIcon: {
    fontSize: theme.text.size.xl,
  },
  achievementTitle: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    color: theme.colors.text,
    textAlign: 'center',
  },
  achievementTitleLocked: {
    color: theme.colors.locked,
  },
  // Bordure "danger" plutôt qu'un fond plein : une action de déconnexion
  // n'est pas une erreur, mais reste une action qu'on ne veut pas confondre
  // visuellement avec le bouton primaire "Ajouter des amis" ci-dessus.
  signOutButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  signOutButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.danger,
  },
});
