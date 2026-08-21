import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useSucces } from '../context/SuccesContext';
import { useSettingsDrawer } from '../context/SettingsDrawerContext';
import { chargerRelations, determinerTypeRelation, type RelationsUtilisateur } from '../lib/follows';
import { SUCCES } from '../dataset/succes';
import type { SocialStackParamList } from '../navigation/SocialStack';

// Cet écran est maintenant enregistré comme route "SocialMain" de
// SocialStack (voir SocialStack.tsx) — il remplace l'ancien SocialScreen.tsx
// (supprimé) : le bloc "Ajouter des amis" qui vivait là-bas est repris
// tel quel plus bas (voir la section BULLES), fusionné dans CETTE page.
type ProfileScreenNavigationProp = NativeStackNavigationProp<SocialStackParamList, 'SocialMain'>;

// Juste de quoi afficher/ouvrir une bulle — pas besoin du Profil complet
// (interface Profil, ProfileContext.tsx) pour cette liste.
type ProfileListItem = {
  id: string;
  nom_utilisateur: string | null;
};

// Combien de profils demander à Supabase au maximum — voir MAX_BUBBLES plus
// bas, cette section n'affiche de toute façon qu'UNE SEULE rangée.
const MAX_PROFILES_FETCHED = 50;

// Taille d'une bulle et espacement entre bulles — repris tels quels de
// l'ancien SocialScreen.tsx.
const BUBBLE_SIZE = theme.spacing.xl * 2;
const BUBBLE_GAP = theme.spacing.md;

type RecapItem = {
  id: string;
  icon: string;
  label: string;
  value: string;
};

// Formate une date Postgres (chaîne ISO renvoyée par Supabase pour
// "date_inscription") en ANNÉE seule — ex: "2026" (avant : "mois année" ;
// changé ici pour "Membre depuis {année}", demandé pour cette nouvelle page).
function formatYear(isoDate: string): string {
  return String(new Date(isoDate).getFullYear());
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const {
    profil,
    isLoading: isProfileLoading,
    error: profileError,
  } = useProfile();
  const { succesDebloques } = useSucces();
  // Ouvre le menu réglages (drawer glissant, voir SettingsDrawer.tsx) —
  // bouton engrenage plus bas.
  const { openDrawer } = useSettingsDrawer();

  // --- EN-TÊTE COLLANT (nom + boutons partage/réglages) ------------------
  // Principe (nouveau dans cette app, d'où le détail des commentaires) :
  // l'en-tête n'est PAS un enfant du ScrollView plus bas (ça, c'est ce qui le
  // ferait défiler avec le reste) — c'est un View à part, positionné en
  // "position: absolute" par-dessus, rendu APRÈS le ScrollView dans le JSX
  // (donc peint AU-DESSUS de lui, même technique que SlidePanel.tsx /
  // SuccesCelebrationOverlay.tsx). Il reste donc TOUJOURS à la même place à
  // l'écran, quel que soit le scroll : c'est ça qui le rend "collant". Le
  // personnage (styles.characterFrame), lui, reste un enfant normal du
  // ScrollView : il défile comme avant, rien ne change pour lui.
  //
  // Ce qui change avec le scroll, c'est UNIQUEMENT le fond de cet en-tête
  // (transparent en haut de page → teinte du thème une fois qu'on a scrollé),
  // pour rester lisible par-dessus le personnage/le contenu qui défile
  // dessous. Le nom et les boutons, eux, sont TOUJOURS visibles/cliquables,
  // scroll ou pas.
  //
  // scrollY : une "boîte" (Animated.Value) qui contient la position de scroll
  // actuelle (0 = tout en haut). Elle n'est PAS mise à jour par un
  // setState/re-render à chaque pixel scrollé (ce qui serait très coûteux) :
  // Animated la fait évoluer de son côté, en dehors du cycle de rendu React.
  const scrollY = useRef(new Animated.Value(0)).current;

  // Animated.event "branche" scrollY directement sur la position de scroll du
  // ScrollView : à chaque événement de scroll natif, nativeEvent.contentOffset.y
  // est écrit dans scrollY automatiquement (pas de setState à écrire à la main).
  // useNativeDriver: true : cette écriture, ET l'interpolation d'opacité qui en
  // dépend juste en dessous, tournent entièrement côté natif (thread UI),
  // sans repasser par JS à chaque frame — c'est possible ici car on n'anime
  // qu'une opacité (pas une couleur ou une largeur, que le driver natif ne
  // sait pas animer).
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  // Distance de scroll (en px) sur laquelle le fond de l'en-tête passe de
  // transparent à totalement opaque — valeur approximative choisie pour un
  // fondu DOUX répartie sur une partie du cadre du personnage (~192px de
  // haut, voir styles.characterFrame), pas un token du thème (c'est une
  // distance de scroll, pas un espacement visuel).
  const HEADER_OPACITY_SCROLL_DISTANCE = 120;

  // .interpolate() transforme la plage de scroll [0, 120] en une plage
  // d'opacité [0, 1] : à scrollY = 0 → opacité 0 (fond invisible), à
  // scrollY >= 120 → opacité 1 (fond plein). extrapolate: 'clamp' empêche
  // l'opacité de sortir de [0, 1] au-delà de cette plage (ex: pas d'opacité
  // négative si jamais scrollY devenait négatif via un effet de rebond iOS).
  const headerBackgroundOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_OPACITY_SCROLL_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // --- COMPTEURS (abonnés / abonnements / amis) + BULLES ------------------
  // Un SEUL chargement (useFocusEffect, relancé à chaque fois que cette page
  // redevient visible — ex: retour depuis UserProfileScreen après avoir
  // suivi quelqu'un) fournit TOUT ce dont cette section a besoin : la liste
  // de profils à afficher en bulles, ET mes relations dans les 2 sens (voir
  // chargerRelations, lib/follows.ts), dont sont dérivés les 3 compteurs ET
  // les badges "Amis"/"Suivi" de chaque bulle — pas de requête séparée pour
  // chacun.
  const [bubbleProfiles, setBubbleProfiles] = useState<ProfileListItem[]>([]);
  const [isBubblesLoading, setIsBubblesLoading] = useState(true);
  const [bubblesError, setBubblesError] = useState<string | null>(null);
  const [relations, setRelations] = useState<RelationsUtilisateur | null>(null);

  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  // AMIS = suivi RÉCIPROQUE, c'est-à-dire l'INTERSECTION de "qui je suis" et
  // "qui me suit" (même détection que le badge "Amis" des bulles plus bas,
  // voir determinerTypeRelation). Ces 3 compteurs (abonnés/abonnements/amis)
  // dérivent tous des 2 mêmes requêtes aujourd'hui, mais pourront évoluer
  // séparément plus tard (ex: si "amis" gagne sa propre notion de demande/
  // acceptation au lieu d'un simple suivi mutuel) — rien dans leur affichage
  // ci-dessous ne suppose qu'ils resteront calculés de la même façon.
  const [friendsCount, setFriendsCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      let isActive = true;

      setIsBubblesLoading(true);
      setBubblesError(null);

      async function load() {
        if (!user) return;

        // REQUÊTE DE LISTE — annuaire GLOBAL temporaire (voir l'ancien
        // SocialScreen.tsx) : tous les profils sauf le mien, sans filtre de
        // recherche. En parallèle avec chargerRelations() : 3 requêtes
        // TOTALES pour toute la section, pas une par bulle affichée.
        const [profilesResult, relationsResult] = await Promise.all([
          supabase
            .from('profils')
            .select('id, nom_utilisateur')
            .neq('id', user.id)
            .limit(MAX_PROFILES_FETCHED),
          chargerRelations(),
        ]);

        if (!isActive) return;

        if (profilesResult.error) {
          setBubblesError(profilesResult.error.message);
          setBubbleProfiles([]);
        } else {
          // Cast explicite (pas de schéma "Database" généré depuis
          // Supabase, même raison qu'ailleurs dans l'app) — jamais de "any".
          setBubbleProfiles(profilesResult.data as ProfileListItem[]);
        }

        const loadedRelations = relationsResult.relations;
        if (loadedRelations) {
          setRelations(loadedRelations);
          setFollowersCount(loadedRelations.meSuivent.size);
          setFollowingCount(loadedRelations.jeSuis.size);

          let mutualCount = 0;
          loadedRelations.jeSuis.forEach((id) => {
            if (loadedRelations.meSuivent.has(id)) {
              mutualCount += 1;
            }
          });
          setFriendsCount(mutualCount);
        }

        setIsBubblesLoading(false);
      }

      load();

      return () => {
        isActive = false;
      };
    }, [user]),
  );

  // COMBIEN DE BULLES TIENNENT SUR UNE SEULE LIGNE — même calcul que l'ancien
  // SocialScreen.tsx, mais avec UN SEUL niveau de padding horizontal (celui
  // de styles.section, theme.spacing.lg de chaque côté) : cette section n'a
  // plus de carte propre (pas de 2e padding à soustraire), voir la consigne
  // "sans démarcation visuelle avec le fond".
  const availableWidth = windowWidth - theme.spacing.lg * 2;
  const bubbleSlotWidth = BUBBLE_SIZE + BUBBLE_GAP;
  const maxBubbles = Math.max(1, Math.floor((availableWidth + BUBBLE_GAP) / bubbleSlotWidth));
  const visibleProfiles = bubbleProfiles.slice(0, Math.max(0, maxBubbles - 1));

  const handleSearchPress = () => {
    navigation.navigate('SearchUsers');
  };

  const displayName = isProfileLoading
    ? '…'
    : (profil?.nom_utilisateur ?? user?.email ?? 'Utilisateur');

  const memberSinceLabel = isProfileLoading
    ? 'Membre depuis…'
    : profil?.date_inscription
      ? `Membre depuis ${formatYear(profil.date_inscription)}`
      : "Date d'inscription indisponible";

  // "…" pendant le chargement, "—" si le profil n'a pas pu être chargé —
  // jamais de vraie valeur tant que "profil" n'est pas confirmé rempli.
  // "Série en cours" = streak_actuelle (PAS meilleure_streak, contrairement
  // à l'ancienne version de cette page) : demandé explicitement pour cette
  // nouvelle structure.
  const currentStreakValue = isProfileLoading ? '…' : profil ? `${profil.streak_actuelle} jours` : '—';
  const totalXpValue = isProfileLoading ? '…' : profil ? profil.xp.toLocaleString('fr-FR') : '—';

  const recapItems: RecapItem[] = [
    { id: 'streak', icon: '🔥', label: 'Série en cours', value: currentStreakValue },
    { id: 'totalXp', icon: '⭐', label: 'XP total', value: totalXpValue },
    // TODO: Ligue — pas encore de système de ligues.
    { id: 'league', icon: '🏅', label: 'Ligue', value: 'Ligue à venir' },
    // TODO: Exercice préféré — pas encore de suivi des exercices pratiqués.
    { id: 'favoriteExercise', icon: '🎹', label: 'Exercice préféré', value: 'Bientôt disponible' },
  ];

  return (
    <View style={styles.screen}>
      {/* Animated.ScrollView (pas un ScrollView normal) : nécessaire pour
          brancher handleScroll (Animated.event) dessus, voir le commentaire
          détaillé sur scrollY plus haut. scrollEventThrottle={16} : ~60
          événements de scroll par seconde (1000ms / 16 ≈ 60fps), même valeur
          que le précédent déjà utilisée dans CourseParcoursScreen.tsx pour ce
          même type d'animation liée au scroll — sans ça, l'opacité de
          l'en-tête ne se mettrait à jour que par à-coups. */}
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* PARTIE 1 — seul le personnage vit encore ici, dans le flux normal
            du ScrollView : il défile donc normalement avec le reste de la
            page. Le nom + les boutons partage/réglages ont été déplacés dans
            l'en-tête collant rendu plus bas (en dehors de ce ScrollView) —
            voir le commentaire sur scrollY plus haut pour le pourquoi. */}
        <View style={styles.characterSection}>
          {/* TODO: illustration du personnage — silhouette emoji en attendant,
              ANCRÉE EN BAS du cadre (justifyContent: 'flex-end') pour simuler
              un cadrage "du bassin à la tête" (le bassin du personnage centré
              en bas de la zone, comme demandé) — un vrai visuel viendra
              remplacer ce placeholder plus tard. */}
          <View style={styles.characterFrame}>
            <Text style={styles.characterPlaceholderIcon}>🧍</Text>
          </View>
        </View>

        {/* Message discret : affiché SEULEMENT si le chargement du profil a
            échoué — les champs concernés retombent déjà chacun sur un repli
            neutre ci-dessous, ce message explique juste pourquoi. */}
        {profileError && <Text style={styles.errorText}>Profil indisponible pour l'instant.</Text>}

        {/* PARTIE 2 — reste scrollable, blocs pleine largeur (un seul scroll,
            celui de l'Animated.ScrollView racine ci-dessus — aucun scroll
            imbriqué). Ces blocs défilent normalement SOUS l'en-tête collant
            (rendu plus bas, en dehors de ce ScrollView) : comportement
            normal/attendu pour un en-tête collant. */}
        <View style={styles.section}>
          <Text style={styles.memberSince}>{memberSinceLabel}</Text>

          <View style={styles.countsRow}>
            <View style={styles.countItem}>
              <Text style={styles.countValue}>{followersCount ?? '…'}</Text>
              <Text style={styles.countLabel}>Abonnés</Text>
            </View>
            <View style={styles.countItem}>
              <Text style={styles.countValue}>{followingCount ?? '…'}</Text>
              <Text style={styles.countLabel}>Abonnements</Text>
            </View>
            <View style={styles.countItem}>
              <Text style={styles.countValue}>{friendsCount ?? '…'}</Text>
              <Text style={styles.countLabel}>Amis</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* BULLES "Ajouter des amis" — structure IDENTIQUE à l'ancien
            SocialScreen.tsx (requête, calcul de maxBubbles, badges Amis/Suivi,
            bulle "+" en dernière position vers la recherche), mais SANS fond
            ni bordure de carte distincte : elle se fond directement dans la
            page, comme demandé — seul le visuel change, pas la structure. */}
        <View style={styles.section}>
          <Text style={theme.text.title}>Ajouter des amis</Text>

          {isBubblesLoading && <ActivityIndicator size="large" color={theme.colors.primary} />}
          {bubblesError && <Text style={styles.errorText}>{bubblesError}</Text>}

          {!isBubblesLoading && !bubblesError && (
            <View style={styles.bubbleRow}>
              {visibleProfiles.map((item) => {
                const typeRelation = relations ? determinerTypeRelation(item.id, relations) : null;

                return (
                  <Pressable
                    key={item.id}
                    style={styles.bubbleItem}
                    onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                  >
                    <View style={styles.bubbleCircle}>
                      <Text style={styles.bubbleInitial}>
                        {item.nom_utilisateur?.trim()
                          ? item.nom_utilisateur.trim().charAt(0).toUpperCase()
                          : '👤'}
                      </Text>
                    </View>
                    <Text style={styles.bubbleLabel} numberOfLines={1}>
                      {item.nom_utilisateur ?? 'Utilisateur'}
                    </Text>

                    {typeRelation && (
                      <View
                        style={[
                          styles.badgePill,
                          typeRelation === 'ami' ? styles.badgePillAmi : styles.badgePillSuivi,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeLabel,
                            typeRelation === 'ami' ? styles.badgeLabelAmi : styles.badgeLabelSuivi,
                          ]}
                        >
                          {typeRelation === 'ami' ? 'Amis' : 'Suivi'}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}

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
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
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
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={theme.text.title}>Succès</Text>
          {/* SUCCES (dataset/succes.ts) : TOUTE la liste, y compris les succès
              pas encore branchés (restent verrouillés indéfiniment). Débloqué/
              verrouillé = succesDebloques.has(succes.id) (SuccesContext.tsx). */}
          <View style={styles.tileGrid}>
            {SUCCES.map((succes) => {
              const isUnlocked = succesDebloques.has(succes.id);
              return (
                <View key={succes.id} style={styles.achievementTile}>
                  <View
                    style={[
                      styles.achievementIconCircle,
                      isUnlocked
                        ? styles.achievementIconCircleUnlocked
                        : styles.achievementIconCircleLocked,
                    ]}
                  >
                    <Text style={styles.achievementIcon}>{succes.icone}</Text>
                  </View>
                  <Text
                    style={[styles.achievementTitle, !isUnlocked && styles.achievementTitleLocked]}
                  >
                    {succes.titre}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </Animated.ScrollView>

      {/* EN-TÊTE COLLANT — sibling rendu APRÈS l'Animated.ScrollView (donc
          peint PAR-DESSUS lui), position: 'absolute' pour rester fixe à
          l'écran quel que soit le scroll (voir styles.stickyHeader). Voir le
          commentaire détaillé sur scrollY/handleScroll/headerBackgroundOpacity
          plus haut pour le mécanisme complet de l'animation.
          pointerEvents="box-none" sur ce conteneur : lui-même ne capte aucun
          toucher (laisse passer vers le contenu qui défile dessous, ex: en
          haut de page quand le fond est transparent), mais ses ENFANTS (le
          nom, les 2 boutons) restent normalement cliquables. */}
      <View style={styles.stickyHeader} pointerEvents="box-none">
        {/* Fond de l'en-tête, animé séparément du contenu : un View seul dédié
            au fond (couleur fixe du thème) dont on anime uniquement l'OPACITÉ
            (0 = invisible/transparent, 1 = pleine couleur) — plus simple et
            plus robuste qu'interpoler une couleur directement (ça éviterait de
            devoir convertir à la main la couleur du thème en rgba avec alpha).
            pointerEvents="none" : ce calque est purement visuel, ne doit
            jamais intercepter un toucher. */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.stickyHeaderBackground, { opacity: headerBackgroundOpacity }]}
        />
        <View style={[styles.headerTopRow, { paddingTop: insets.top + theme.spacing.md }]}>
          <Text style={styles.headerName}>{displayName}</Text>
          <View style={styles.headerActionsRow}>
            <Pressable
              style={styles.iconButton}
              onPress={() => {
                // TODO: action partage
              }}
            >
              <Text style={styles.iconButtonLabel}>📤</Text>
            </Pressable>
            <Pressable style={styles.iconButton} onPress={openDrawer}>
              <Text style={styles.iconButtonLabel}>⚙️</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Conteneur racine : contient l'Animated.ScrollView ET l'en-tête collant,
  // l'un À CÔTÉ DE L'AUTRE (siblings), pas l'un dans l'autre — c'est cette
  // structure qui permet à l'en-tête de rester fixe pendant que le
  // ScrollView défile (voir le commentaire sur styles.stickyHeader).
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  // Bloc du personnage, pleine largeur : même fond que la page
  // (theme.colors.background, pas "surface") et SANS bordure — demande
  // explicite pour que ce bloc ne se voie pas comme un encart séparé, qu'il
  // se fonde directement dans le fond de l'écran (characterFrame ci-dessous
  // utilise déjà cette même couleur, donc les deux se confondent). paddingTop
  // fixe (pas insets.top) : ce bloc n'est plus le tout premier élément visuel
  // de l'écran, c'est l'en-tête collant qui gère maintenant la safe area
  // (voir styles.headerTopRow) — un padding généreux suffit ici, purement
  // pour l'esthétique.
  characterSection: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  // L'EN-TÊTE COLLANT LUI-MÊME : position 'absolute' + top/left/right à 0,
  // SANS "bottom" ni "height" fixés — sa hauteur se déduit naturellement de
  // son contenu (styles.headerTopRow ci-dessous), exactement comme un View
  // en flux normal ; seul son POSITIONNEMENT est sorti du flux. zIndex :
  // au-dessus de l'Animated.ScrollView par précaution sur Android (l'ordre
  // de rendu des enfants suffit déjà sur iOS).
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  // Calque de fond de l'en-tête collant, dont on anime l'opacité (voir
  // headerBackgroundOpacity) — StyleSheet.absoluteFill (appliqué dans le
  // JSX) l'étire pour couvrir exactement la zone occupée par headerTopRow.
  stickyHeaderBackground: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  // Contenu (toujours pleinement visible) de l'en-tête collant : nom +
  // boutons partage/réglages. paddingTop = insets.top + spacing géré via un
  // style inline dans le JSX (dépend de useSafeAreaInsets(), pas statique) —
  // c'est CE bloc qui porte maintenant la safe area, plus characterSection.
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerName: {
    fontSize: theme.text.size.xl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  headerActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  // Pas de token "bouton icône" dans le thème : composé à partir des tokens
  // existants, comme ailleurs dans l'app.
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    // "background" (pas "surface") : ce bouton est niché dans l'en-tête
    // collant (fond "surface" une fois opaque, voir stickyHeaderBackground) —
    // le fond background le détache visuellement de son conteneur au lieu de
    // s'y fondre, y compris quand le fond de l'en-tête est encore transparent.
    backgroundColor: theme.colors.background,
  },
  iconButtonLabel: {
    fontSize: theme.text.size.lg,
  },
  // Cadre du personnage : hauteur fixe composée à partir de spacing (pas de
  // token de taille dédié dans le thème). Même fond "background" que
  // characterSection (son conteneur) : volontairement AUCUN contraste, le
  // cadre doit rester invisible/confondu avec la page (voir characterSection
  // ci-dessus). justifyContent: 'flex-end' + overflow: 'hidden' : ancre le
  // contenu tout en bas du cadre et coupe ce qui dépasserait — c'est ce qui
  // simule le cadrage "bassin centré en bas" demandé, en attendant la vraie
  // illustration (voir le TODO dans le JSX).
  characterFrame: {
    width: '100%',
    height: theme.spacing.xl * 6,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    paddingBottom: theme.spacing.sm,
  },
  characterPlaceholderIcon: {
    fontSize: theme.text.size.xxxl * 2,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  // Chaque section de la PARTIE 2 : pleine largeur, SON PROPRE padding
  // horizontal (pas de padding global sur le ScrollView — c'est ça qui
  // permet aux séparateurs/à l'en-tête de rester edge-to-edge alors que le
  // TEXTE, lui, garde de l'air par rapport aux bords de l'écran).
  section: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: theme.colors.border,
  },
  memberSince: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  countsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  // "surface" (pas "background") : sans carte parente ici (page en
  // "background" directement), c'est "surface" qui fait ressortir la tuile
  // du fond de la page — inverse de l'ancienne version de cette page, qui
  // nichait ces tuiles DANS une carte "surface" et utilisait donc
  // "background" pour trancher dessus.
  countItem: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  countValue: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  countLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  // flexWrap: 'nowrap' explicite (déjà la valeur par défaut, mais clarifie
  // l'intention) : cette rangée ne doit jamais passer à la ligne, voir le
  // calcul de visibleProfiles/maxBubbles plus haut.
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
  // "surface" ici aussi, même raison que countItem ci-dessus.
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
  badgePill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.xl,
  },
  badgePillAmi: {
    backgroundColor: theme.colors.friendBadge,
  },
  // "surface" (pas "background", contrairement à l'ancien SocialScreen.tsx
  // où ce badge vivait dans une carte "surface") — même bascule que
  // countItem/bubbleCircle ci-dessus.
  badgePillSuivi: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  badgeLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
  },
  badgeLabelAmi: {
    color: '#FFFFFF',
  },
  badgeLabelSuivi: {
    color: theme.colors.primary,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  // "surface" (pas "background") : même bascule que countItem ci-dessus.
  recapTile: {
    width: '48%',
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
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
  achievementIconCircleUnlocked: {
    backgroundColor: theme.colors.achievementUnlocked,
  },
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
});
