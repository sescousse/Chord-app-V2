import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import CourseParcoursScreen from './CourseParcoursScreen';
import LibraryScreen from './LibraryScreen';
import { useProfile } from '../context/ProfileContext';
import { GelSerieModal, GEL_SERIE_ICON } from '../components/GelSerieModal';
// TEMPORAIRE — test isolé de react-native-audio-api, voir
// src/audio/webAudioTest.ts (à retirer une fois le module natif validé).
import { testWebAudioPlayback } from '../audio/webAudioTest';
import type { HomeStackParamList } from '../navigation/HomeStack';

// Type du hook de navigation, restreint à la pile Accueil — même convention
// que CourseParcoursScreen.tsx (ce composant est, comme lui, monté DANS
// "HomeMain" et hérite donc du contexte de navigation de CETTE pile).
type HomeScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

// Icône flamme : @expo/vector-icons n'est pas installé dans ce projet
// (vérifié : absent de package.json et node_modules) — repli emoji, même
// convention déjà utilisée ailleurs dans l'app pour ce même besoin (ex: les
// cœurs de LessonCourseScreen, les icônes des boutons d'action de
// improResult.tsx).
const STREAK_ICON = '🔥';

// TODO: illustration jeton clé de sol — icône générique de pièce en
// attendant un vrai visuel dédié à la monnaie du jeu.
const JETON_ICON = '🪙';

// Statistiques PAS ENCORE branchées à une vraie source (xp et streak, elles,
// viennent maintenant du profil Supabase — voir useProfile() dans le
// composant plus bas) — données EN DUR, à remplacer plus tard une fois ces
// mesures réellement suivies.
const STATIC_STATS = {
  exercisesDone: 12,
  lessonsRead: 4,
  avgDailyPracticeMinutes: 18,
};

type StatDisplayItem = {
  id: string;
  icon: string;
  label: string;
  value: string;
};

// --- BANNIÈRE DE SOUS-NAVIGATION ---------------------------------------
// 3 onglets pilotés par un simple state local (PAS un navigateur : consigne
// explicite de ne pas ajouter de dépendance de navigation pour ça) — changer
// d'onglet ne fait donc jamais naviguer nulle part, seul le contenu rendu
// sous la bannière change (voir le switch dans le composant plus bas).
// BANNER_TABS pilote à la fois l'ordre et le libellé affiché : un seul
// tableau à modifier pour ajouter/renommer/réordonner un onglet.
//
// "Social" vivait ici (annuaire en bulles), puis a rejoint son propre onglet
// dans la barre du bas. "Profil" (mon profil personnel) vivait ICI aussi :
// il est maintenant FUSIONNÉ dans cette même page Social/Profil du bas (voir
// ProfileScreen.tsx, qui inclut désormais le bloc "Ajouter des amis") — un
// seul chemin vers mon profil, plus de doublon entre bannière et barre du bas.
type TabKey = 'parcours' | 'bibliotheque' | 'competences';

interface BannerTab {
  key: TabKey;
  label: string;
}

const BANNER_TABS: BannerTab[] = [
  { key: 'parcours', label: 'Parcours' },
  { key: 'bibliotheque', label: 'Bibliothèque' },
  { key: 'competences', label: 'Compétences' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HomeScreenNavigationProp>();

  // Onglet actif de la bannière. "competences" par défaut : c'est le contenu
  // d'accueil d'origine (streak + stats + TODO objectifs/arbre), inchangé
  // ci-dessous.
  const [activeTab, setActiveTab] = useState<TabKey>('competences');

  // Ouverture de la modale "Gel de série" (voir GelSerieModal.tsx), déclenchée
  // par l'icône gel du header plus bas — state LOCAL (pas un Context comme
  // SettingsDrawer) : cette modale n'est ouverte que depuis CET écran, pas
  // besoin de la rendre accessible ailleurs dans l'app.
  const [isGelModalOpen, setIsGelModalOpen] = useState(false);

  // 3 états exposés par ProfileContext (voir ProfileContext.tsx) : tant que
  // isProfileLoading est vrai, "profil" n'est pas encore fiable ; ensuite,
  // soit "profil" est rempli (succès), soit "profileError" l'est (échec).
  const { profil, isLoading: isProfileLoading, error: profileError } = useProfile();

  // "…" pendant le chargement, "—" en cas d'erreur — jamais un chiffre
  // périmé/inventé tant que le profil n'est pas confirmé chargé (même
  // logique que ProfileScreen.tsx, dupliquée ici car propre à CET écran :
  // pas de source commune à extraire pour 2 lignes de calcul).
  const streakDisplay = isProfileLoading ? '…' : profil ? String(profil.streak_actuelle) : '—';
  const totalXpDisplay = isProfileLoading ? '…' : profil ? profil.xp.toLocaleString('fr-FR') : '—';
  // Solde de jetons RÉEL (profil.jetons, table "profils") — même repli "…"/
  // "—" que streak/xp ci-dessus, remplace l'ancienne constante JETONS_EN_DUR.
  const jetonsDisplay = isProfileLoading ? '…' : profil ? String(profil.jetons) : '—';
  // Nombre de gels de série RÉEL (profil.gels_serie, table "profils") — même
  // repli "…"/"—" que le reste de cette bande.
  const gelsSerieDisplay = isProfileLoading ? '…' : profil ? String(profil.gels_serie) : '—';

  // Config d'AFFICHAGE de chaque statistique (icône + libellé + valeur déjà
  // mise en forme) — xp/streak dépendent du profil chargé ci-dessus, donc
  // calculées ICI (dans le composant), plus au niveau du module comme avant.
  const STAT_DISPLAY_ITEMS: StatDisplayItem[] = [
    { id: 'exercises', icon: '🏋️', label: 'Exercices faits', value: String(STATIC_STATS.exercisesDone) },
    { id: 'lessons', icon: '📖', label: 'Cours lus', value: String(STATIC_STATS.lessonsRead) },
    {
      id: 'avgTime',
      icon: '⏱️',
      label: 'Temps moyen / jour',
      value: `${STATIC_STATS.avgDailyPracticeMinutes} min`,
    },
    { id: 'xp', icon: '⭐', label: 'XP total', value: totalXpDisplay },
    { id: 'streak', icon: STREAK_ICON, label: 'Streak', value: `${streakDisplay} j` },
  ];

  return (
    <View style={styles.screen}>
      {/* BANDE STREAK/JETONS — remplace l'ancienne barre de titre "Accueil"
          (retirée, demande explicite d'une tâche précédente) : PAS de texte
          de titre ici, 3 statistiques cette fois : streak | gels | jetons
          (comme demandé), réparties à parts égales sur toute la largeur
          (voir statsStripItem, "flex: 1" sur chacune). Devient le tout
          premier élément en haut de l'écran, donc reprend la responsabilité
          de la safe area (paddingTop = insets.top + spacing, même principe
          que la topBar de LessonCourseScreen) — la bannière juste en dessous
          n'en a donc plus besoin. */}
      <View style={[styles.statsStrip, { paddingTop: insets.top + theme.spacing.md }]}>
        {/* GAUCHE — streak RÉELLE (profil.streak_actuelle via ProfileContext,
            voir streakDisplay plus haut : "…" pendant le chargement, "—" en
            cas d'erreur, jamais un chiffre inventé). */}
        <View style={styles.statsStripItem}>
          <Text style={styles.statsStripIcon}>{STREAK_ICON}</Text>
          <Text style={styles.statsStripValue}>{streakDisplay}</Text>
        </View>

        {/* MILIEU — gels de série RÉELS (profil.gels_serie via ProfileContext,
            voir gelsSerieDisplay plus haut). Cliquable : ouvre la modale
            d'achat (GelSerieModal.tsx) — affichage + achat seulement à cette
            étape, la CONSOMMATION automatique dans la logique de streak est
            une étape séparée à venir. */}
        <Pressable style={styles.statsStripItem} onPress={() => setIsGelModalOpen(true)}>
          <Text style={styles.statsStripIcon}>{GEL_SERIE_ICON}</Text>
          <Text style={styles.statsStripValue}>{gelsSerieDisplay}</Text>
        </Pressable>

        {/* DROITE — solde de jetons RÉEL (profil.jetons via ProfileContext,
            voir jetonsDisplay plus haut). Cliquable : ouvre la boutique de
            jetons (BoutiqueJetonsScreen, placeholder "Bientôt disponible"
            pour l'instant — voir HomeStack.tsx pour cette route). */}
        <Pressable style={styles.statsStripItem} onPress={() => navigation.navigate('BoutiqueJetons')}>
          <Text style={styles.statsStripIcon}>{JETON_ICON}</Text>
          <Text style={styles.statsStripValue}>{jetonsDisplay}</Text>
        </Pressable>
      </View>

      {/* BANNIÈRE — rangée de 3 onglets cliquables, l'onglet actif souligné
          avec l'accent du thème (theme.colors.primary, déjà la couleur
          "active" de la tab bar du bas, voir RootNavigator.tsx : cohérent
          avec ce que l'app utilise déjà pour "onglet sélectionné"). Pas de
          nouveau token nécessaire : composée à partir de tokens existants
          (surface/border/primary/textMuted), comme d'autres styles "sans
          équivalent direct" ailleurs dans l'app (ex: le bouton de
          LessonCourseScreen). Ne porte plus la safe area (voir la bande
          streak/jetons ci-dessus, qui l'a prise en charge). */}
      <View style={styles.banner}>
        {BANNER_TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              style={[styles.bannerTab, isActive && styles.bannerTabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.bannerTabLabel, isActive && styles.bannerTabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* REBRANCHEMENT Parcours / Bibliothèque : ces 2 onglets rendent les
          écrans existants DIRECTEMENT comme de simples composants enfants
          (pas de navigation.navigate) — c'est ce qui permet à la bannière de
          rester un simple state, sans navigateur dédié. CourseParcoursScreen
          garde malgré tout un accès normal à la navigation (useNavigation) :
          comme il est rendu ici, à l'intérieur de l'écran "HomeMain" de
          HomeStack (voir navigation/HomeStack.tsx), il hérite du contexte de
          navigation de CETTE pile, et son navigation.navigate('Lesson', ...)
          continue donc de fonctionner exactement comme avant (ouvre bien la
          leçon plein écran, tab bar masquée — voir RootNavigator.tsx). */}
      {activeTab === 'parcours' && <CourseParcoursScreen />}
      {activeTab === 'bibliotheque' && <LibraryScreen />}

      {activeTab === 'competences' && (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* TEMPORAIRE — bouton de test isolé pour react-native-audio-api
              (voir src/audio/webAudioTest.ts) : valide que le module natif
              est bien lié en jouant un sample existant via le nouveau moteur.
              N'touche pas au moteur expo-audio existant (src/lib/piano.ts) —
              à retirer une fois la validation faite. */}
          <Pressable style={styles.webAudioTestButton} onPress={() => testWebAudioPlayback()}>
            <Text style={styles.webAudioTestButtonLabel}>🧪 Test Web Audio</Text>
          </Pressable>

          {/* BLOC STREAK — tout en haut : l'accroche de la page (voir
              streakAccent dans colors.ts, un accent volontairement fort/
              détonnant pour cette seule carte). */}
          <View style={[styles.card, styles.streakCard]}>
            <Text style={styles.streakIcon}>{STREAK_ICON}</Text>
            <View style={styles.streakTextGroup}>
              <Text style={styles.streakValue}>{streakDisplay} jours</Text>
              <Text style={styles.streakLabel}>de connexion d'affilée</Text>
            </View>
          </View>

          {/* Message discret : affiché SEULEMENT si le chargement du profil
              a échoué — les valeurs concernées (xp, streak) retombent déjà
              chacune sur "—" ci-dessus/ci-dessous, ce message explique juste
              pourquoi, sans bloquer le reste de la page. */}
          {profileError && (
            <Text style={styles.profileErrorText}>Profil indisponible pour l'instant.</Text>
          )}

          {/* TODO: bloc objectifs */}

          {/* TODO: bloc arbre de compétences */}

          {/* BLOC STATISTIQUES */}
          <View style={styles.card}>
            <Text style={theme.text.title}>Statistiques</Text>

            {/* Grille 2 colonnes qui wrappe proprement (voir statsGrid/statTile
                dans la feuille de style pour le détail du calcul). */}
            <View style={styles.statsGrid}>
              {STAT_DISPLAY_ITEMS.map((item) => (
                <View key={item.id} style={styles.statTile}>
                  <Text style={styles.statIcon}>{item.icon}</Text>
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Modale d'achat d'un gel de série — voir GelSerieModal.tsx. Rendue
          en DERNIER ici (paint par-dessus le reste de l'écran, même
          convention que SuccesCelebrationOverlay/SettingsDrawer) mais state
          LOCAL à cet écran (pas de Context global) : elle n'est ouverte que
          depuis CETTE page, pas besoin de la rendre accessible ailleurs. */}
      <GelSerieModal isOpen={isGelModalOpen} onClose={() => setIsGelModalOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Conteneur racine de l'écran : la bannière et la zone de contenu (l'un
  // des 3 onglets) empilés verticalement, plein écran.
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // Même famille visuelle que la bannière juste en dessous (surface + bordure
  // basse) : les 2 se lisent comme un seul bloc de "chrome du haut" empilé,
  // comme l'ex-en-tête + bannière avant leur fusion.
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  // "flex: 1" sur CHAQUE item (pas de largeur fixe, pas de
  // justifyContent: 'space-between' sur le conteneur) : les items se
  // partagent TOUTE la largeur disponible à parts égales, quel que soit leur
  // nombre — 2 items prennent chacun 50%, 3 en prendraient 33% chacun sans
  // rien à changer ici. "justifyContent: 'center'" centre le contenu
  // (icône+valeur) À L'INTÉRIEUR de la part de CET item, au lieu de le
  // coller à un bord (streak collée à gauche, jetons collés à droite, comme
  // avant) — le rendu reste donc équilibré même si un item est ajouté ou
  // retiré.
  statsStripItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  statsStripIcon: {
    fontSize: theme.text.size.lg,
  },
  statsStripValue: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  bannerTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  bannerTabActive: {
    borderBottomColor: theme.colors.primary,
  },
  bannerTabLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    color: theme.colors.textMuted,
  },
  bannerTabLabelActive: {
    color: theme.colors.primary,
    fontWeight: theme.text.weight.bold,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // "Espacement généreux" entre les blocs, comme demandé : theme.spacing.xl,
  // le plus grand token d'espacement du thème.
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  // Carte de base réutilisée par tous les blocs (streak, stats, et les
  // futurs blocs objectifs/arbre de compétences) : fond de carte du thème,
  // coins arrondis, ombre légère.
  //
  // Pas de token "ombre de carte" dans le thème (à signaler) : shadowColor
  // en noir est la valeur standard/attendue pour ce type d'effet quelle que
  // soit la palette de couleurs (ce n'est pas vraiment un choix de TEINTE
  // thématique, contrairement à un fond ou un texte) — shadowOpacity/
  // shadowRadius/elevation réglés pour un effet volontairement LÉGER, pas
  // prononcé.
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.streakAccent,
  },
  streakIcon: {
    fontSize: theme.text.size.xxxl,
  },
  streakTextGroup: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  // Pas de token "texte sur fond coloré" dans le thème (theme.colors.text
  // est pensé pour du texte sur le fond neutre de l'app) : blanc en dur ici,
  // comme déjà fait ailleurs dans l'app pour ce même besoin (ex:
  // LessonCourseScreen, improResult.tsx).
  streakValue: {
    fontSize: theme.text.size.xxl,
    fontWeight: theme.text.weight.bold,
    color: '#FFFFFF',
  },
  streakLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.medium,
    color: '#FFFFFF',
  },
  profileErrorText: {
    color: theme.colors.danger,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    textAlign: 'center',
  },
  // flexDirection: 'row' + flexWrap: 'wrap' : les tuiles se placent côte à
  // côte et reviennent à la ligne automatiquement dès qu'il n'y a plus de
  // place, plutôt que de s'empiler en colonne. PAS de "gap" ici
  // (volontairement — voir le commentaire sur statTile.width juste en
  // dessous pour le pourquoi) : justifyContent: 'space-between' suffit à
  // espacer les 2 tuiles de chaque ligne, en calculant cet espace comme une
  // FRACTION de la largeur réelle du conteneur plutôt qu'une valeur fixe.
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  // Fond theme.colors.background (pas surface, la couleur de la carte
  // parente "Statistiques") : détache visuellement chaque tuile de la carte
  // qui la contient, plutôt que de se fondre dedans.
  //
  // width: '48%' (2 tuiles par ligne) SANS "gap" sur le conteneur parent :
  // un "gap" ajoute un espacement FIXE (en px) EN PLUS des largeurs déjà
  // spécifiées — combiné à des largeurs en pourcentage (48%+48% = 96% de la
  // largeur du conteneur), ce pixel supplémentaire peut dépasser les 100%
  // restants sur un écran étroit, ce qui forçait chaque tuile à revenir à la
  // ligne toute seule (le bug corrigé ici : un empilement en colonne au lieu
  // d'une grille 2 colonnes). marginBottom fournit l'espacement VERTICAL
  // entre les lignes qui reviennent à la ligne (justifyContent:
  // 'space-between', lui, ne gère que l'espacement HORIZONTAL au sein d'une
  // même ligne, jamais l'espace entre 2 lignes).
  statTile: {
    width: '48%',
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  statIcon: {
    fontSize: theme.text.size.xl,
  },
  statValue: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // TEMPORAIRE — voir le bouton "Test Web Audio" dans le JSX, à retirer avec
  // lui. Couleur "streakAccent" (pas primary) : le distingue visuellement du
  // reste des boutons de l'app, pour bien signaler que c'est un outil de
  // test, pas une fonctionnalité définitive.
  webAudioTestButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.streakAccent,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
  },
  webAudioTestButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.bold,
    color: '#FFFFFF',
  },
});
