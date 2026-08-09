import { useEffect, useRef } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { theme } from '../theme';
import { supabase } from '../lib/supabase';
import { useSettingsDrawer } from '../context/SettingsDrawerContext';
import { navigationRef } from '../navigation/navigationRef';
import type { AppStackParamList } from '../navigation/AppStack';

// MENU RÉGLAGES — drawer glissant depuis la GAUCHE, largeur PARTIELLE (façon
// Duolingo : chaque section dans un grand bloc à coins arrondis), fond
// assombri derrière, fermeture au tap sur ce fond assombri.
//
// PAS @react-navigation/drawer : ce package impose react-native-gesture-
// handler ET react-native-reanimated comme dépendances natives (rebuild du
// dev client nécessaire), que ce projet a jusqu'ici volontairement évitées
// (voir SlidePanel.tsx, déjà construit sur ce même principe). Ce composant
// est donc un Animated.View "fait maison", sur le MÊME modèle que
// SlidePanel.tsx (translateX au lieu de translateY, Animated.spring,
// toujours monté pour permettre une fermeture animée) plutôt qu'un nouveau
// navigateur — voir le commentaire détaillé de SlidePanel.tsx pour le
// raisonnement complet.
//
// POSITIONNEMENT : rendu comme FRÈRE de <NavigationContainer> dans App.tsx,
// APRÈS lui — même principe que SuccesCelebrationOverlay (peut donc s'ouvrir
// par-dessus N'IMPORTE QUEL écran, pas seulement ProfileScreen, même si seul
// son engrenage l'ouvre pour l'instant).
//
// NAVIGATION DEPUIS L'EXTÉRIEUR DE L'ARBRE D'ÉCRANS : ce composant n'est
// monté sous AUCUN écran (donc pas de useNavigation() disponible) — les taps
// sur une ligne du menu naviguent via navigationRef (voir
// src/navigation/navigationRef.ts), le mécanisme standard de React
// Navigation pour naviguer "depuis l'extérieur".

// Largeur du panneau : ~80% de l'écran, plafonnée à 320px (jamais tout
// l'écran, comme demandé) — recalculée à chaque rendu à partir de la
// fenêtre RÉELLE (useWindowDimensions), même principe que PianoChord/
// SlidePanel pour rester responsive.
const MAX_DRAWER_WIDTH = 320;
const DRAWER_WIDTH_RATIO = 0.8;

type SettingsRow = {
  key: string;
  label: string;
  // Toutes les routes PLACEHOLDER partagent le même type de params (voir
  // AppStack.tsx) — restreint ici aux 7 routes concernées (pas "MainTabs",
  // qui n'a pas sa place dans ce menu).
  route: Exclude<keyof AppStackParamList, 'MainTabs'>;
};

type SettingsSection = {
  title: string;
  rows: SettingsRow[];
};

// Structure du menu (labels + route de destination) — STRUCTURE SEULEMENT à
// cette étape : chaque route mène à PlaceholderScreen (titre + "À venir"),
// le contenu réel de chaque section viendra plus tard (voir AppStack.tsx).
const SECTIONS: SettingsSection[] = [
  {
    title: 'Compte',
    rows: [
      { key: 'preferences', label: 'Préférences', route: 'Preferences' },
      { key: 'profile', label: 'Profil', route: 'ProfileSettings' },
      { key: 'notifications', label: 'Notifications', route: 'Notifications' },
      { key: 'privacy', label: 'Paramètres de confidentialité', route: 'PrivacySettings' },
    ],
  },
  {
    title: 'Abonnement',
    rows: [{ key: 'subscription', label: 'Gérer mon abonnement', route: 'ManageSubscription' }],
  },
  {
    title: 'Assistance',
    rows: [
      { key: 'help', label: "Centre d'aide", route: 'HelpCenter' },
      { key: 'feedback', label: 'Remarque', route: 'Feedback' },
    ],
  },
];

export function SettingsDrawer() {
  const { isOpen, closeDrawer } = useSettingsDrawer();
  const { width: windowWidth } = useWindowDimensions();
  const drawerWidth = Math.min(MAX_DRAWER_WIDTH, windowWidth * DRAWER_WIDTH_RATIO);

  // ANIMATION DE GLISSEMENT (translateX) : même principe que SlidePanel.tsx
  // (translateY) — un Animated.Value hors du state React, animé frame par
  // frame côté natif sans re-render à chaque étape. Valeur INITIALE :
  // -drawerWidth, le panneau entièrement à gauche de l'écran, hors champ.
  const translateX = useRef(new Animated.Value(-drawerWidth)).current;

  // Le fond assombri suit la MÊME valeur que le glissement (interpolée, pas
  // un 2e Animated.Value séparé à synchroniser à la main) : opacité 0 quand
  // le panneau est hors champ (-drawerWidth), 1 une fois complètement
  // ouvert (0) — le fond s'assombrit donc progressivement AVEC le
  // glissement, jamais indépendamment de lui.
  const backdropOpacity = translateX.interpolate({
    inputRange: [-drawerWidth, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: isOpen ? 0 : -drawerWidth,
      // Mêmes réglages que SlidePanel.tsx, pour une cohérence de "feel"
      // entre les 2 panneaux glissants de l'app.
      friction: 9,
      tension: 60,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, drawerWidth]);

  const handleRowPress = (row: SettingsRow) => {
    closeDrawer();
    // isReady() : le container de navigation peut ne pas encore être monté
    // au tout premier rendu de l'app — navigationRef.navigate() avant ça
    // lèverait une erreur. Ne peut concrètement pas arriver ici (il faut
    // avoir ouvert le drawer, donc être déjà quelque part dans l'app), mais
    // le vérifier reste la façon correcte d'utiliser cette réf.
    if (navigationRef.isReady()) {
      navigationRef.navigate(row.route, { titre: row.label });
    }
  };

  // Déplacée depuis ProfileScreen (bouton mal placé) — logique inchangée :
  // pas de navigation manuelle après la déconnexion, signOut() vide la
  // session Supabase, ce qui déclenche onAuthStateChange dans AuthContext et
  // fait basculer tout seul l'aiguillage racine (App.tsx) vers AuthStack.
  const handleSignOut = async () => {
    closeDrawer();
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Erreur', error.message);
    }
  };

  return (
    <View style={styles.overlayContainer} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Fond assombri : occupe TOUT l'écran (pas seulement la largeur du
          panneau), un tap dessus ferme le drawer — même Pressable "vide
          derrière" que SlidePanel.tsx pour la fermeture au tap. */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>

      <Animated.View style={[styles.panel, { width: drawerWidth, transform: [{ translateX }] }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>

              {/* Bloc à coins arrondis façon Duolingo : toutes les lignes de
                  la section empilées dans UNE SEULE carte, séparées par un
                  simple liseré (pas une carte par ligne). */}
              <View style={styles.sectionCard}>
                {section.rows.map((row, index) => (
                  <Pressable
                    key={row.key}
                    style={[styles.row, index > 0 && styles.rowDivider]}
                    onPress={() => handleRowPress(row)}
                  >
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text style={styles.rowChevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          {/* "Se déconnecter" : hors des sections (zone dédiée tout en bas),
              comme demandé — pas dans un bloc "Compte" au même titre que les
              autres lignes. */}
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonLabel}>Se déconnecter</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Au-dessus de toute la navigation (tab bar incluse), même famille de
    // valeur que SuccesCelebrationOverlay pour cette même raison (zIndex ET
    // elevation, Android s'appuyant sur elevation pour l'empilement).
    zIndex: 1000,
    elevation: 1000,
  },
  // Même remarque que SuccesCelebrationOverlay.tsx : noir semi-transparent
  // en dur (pas un token du thème) — convention d'assombrissement
  // universelle, indépendante de la palette de couleurs de l'app.
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  // Titre de section AU-DESSUS du bloc (pas dedans) : majuscules + espacement
  // de lettres, même traitement que "kicker" dans SuccesCelebrationOverlay
  // pour un petit texte d'en-tête, mais en textMuted (pas un accent) — ce
  // n'est ici qu'un simple repère de section, pas un moment à mettre en
  // avant.
  sectionTitle: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.medium,
    color: theme.colors.text,
  },
  rowChevron: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.textMuted,
  },
  // Même style que l'ancien bouton de ProfileScreen (repris tel quel, juste
  // déplacé) : contour "danger", pas de fond plein — reste secondaire
  // visuellement face aux sections au-dessus.
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
