import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import { supabase } from '../lib/supabase';

// --- DONNÉES EN DUR — BLOC 1 (en-tête profil) -------------------------------
// données en dur, à remplacer plus tard (vraie identité une fois l'auth/
// la persistance branchée).
const USER_PROFILE = {
  name: 'Thomas',
};

// --- DONNÉES EN DUR — BLOC 2 (infos & récap) --------------------------------
// données en dur, à remplacer plus tard (vraie date d'inscription une fois
// la persistance branchée).
const MEMBER_SINCE_LABEL = 'Membre depuis janvier 2026';

// données en dur, à remplacer plus tard (vrai graphe social une fois cette
// fonctionnalité construite).
const SOCIAL_STATS = {
  followers: 0,
  following: 0,
};

type RecapItem = {
  id: string;
  icon: string;
  label: string;
  value: string;
};

// données en dur, à remplacer plus tard (vraies valeurs calculées une fois
// la persistance branchée) — un seul tableau, une entrée par item affiché :
// en ajouter/retirer une suffit à mettre à jour la grille plus bas, sans
// toucher au rendu.
const RECAP_ITEMS: RecapItem[] = [
  { id: 'bestStreak', icon: '🔥', label: 'Meilleur streak', value: '12 jours' },
  { id: 'favoriteExercise', icon: '🎹', label: 'Exercice préféré', value: "Reconnaissance d'accords" },
  { id: 'league', icon: '🏅', label: 'Ligue', value: 'Ligue à venir' },
  { id: 'totalXp', icon: '⭐', label: 'XP total', value: '1 240' },
];

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
  // Pas de navigation manuelle après la déconnexion : signOut() vide la
  // session Supabase, ce qui déclenche onAuthStateChange dans AuthContext
  // et fait basculer tout seul l'aiguillage racine (App.tsx) vers AuthStack.
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Erreur', error.message);
    }
  };

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

        <Text style={styles.profileName}>{USER_PROFILE.name}</Text>
      </View>

      {/* BLOC 2 — INFOS & RÉCAP : date d'inscription, abonnés/abonnements +
          ajout d'amis, récapitulatif (streak/exercice préféré/ligue/XP), et
          succès (débloqués/verrouillés). Une seule carte : ce sont toutes
          des informations "à propos de ce profil", au même niveau, à la
          différence du bloc 1 qui est l'en-tête d'identité. */}
      <View style={styles.card}>
        <Text style={styles.memberSince}>{MEMBER_SINCE_LABEL}</Text>

        {/* flex: 1 sur chaque stat (pas de largeur en %) : les 2 se partagent
            l'espace disponible à parts égales sans jamais déborder, quelle
            que soit la largeur de l'écran — une seule ligne, jamais de
            retour à la ligne à gérer ici (contrairement à tileGrid plus
            bas). */}
        <View style={styles.socialRow}>
          <View style={styles.socialStat}>
            <Text style={styles.socialValue}>{SOCIAL_STATS.followers}</Text>
            <Text style={styles.socialLabel}>Abonnés</Text>
          </View>
          <View style={styles.socialStat}>
            <Text style={styles.socialValue}>{SOCIAL_STATS.following}</Text>
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
          {RECAP_ITEMS.map((item) => (
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
