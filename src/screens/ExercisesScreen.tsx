import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ExercisesStackParamList } from '../navigation/ExercisesStack';
import { theme } from '../theme';
import { useProfile } from '../context/ProfileContext';

// Type du hook de navigation, restreint aux écrans de la pile Exercices.
type ExercisesNavigation = NativeStackNavigationProp<ExercisesStackParamList, 'ExercisesList'>;

// --- HEADER À 4 ONGLETS --------------------------------------------------
// Piloté par un simple state local (PAS un navigateur, comme la bannière de
// sous-navigation de l'accueil — voir HomeScreen.tsx/BANNER_TABS) : changer
// d'onglet ne fait donc jamais naviguer nulle part, seul le contenu affiché
// sous le header change (voir CARDS_BY_TAB plus bas).
type TabKey = 'jouer' | 'entrainer' | 'ecouter' | 'apprendre';

interface HeaderTab {
  key: TabKey;
  label: string;
}

const HEADER_TABS: HeaderTab[] = [
  { key: 'jouer', label: 'Jouer' },
  { key: 'entrainer', label: "S'entraîner" },
  { key: 'ecouter', label: 'Écouter' },
  { key: 'apprendre', label: 'Apprendre' },
];

// --- CARTES DE SECTION ----------------------------------------------------
// "disponible" : mène à un exercice réellement fonctionnel. "bientot" : mène
// à l'écran générique "À venir" (voir ComingSoon dans ExercisesStack.tsx) —
// aucune des cartes "bientot" ci-dessous n'implémente de vrai exercice à
// cette étape (demande explicite : structure + placeholders seulement).
type CardStatus = 'disponible' | 'bientot';

// Cible d'une carte : soit une route EXISTANTE de la pile Exercices (sans
// paramètre), soit l'écran placeholder "À venir" avec son propre titre.
type CardTarget =
  | { kind: 'route'; route: 'Impro' | 'Creation' }
  | { kind: 'comingSoon'; titre: string };

type SectionCard = {
  id: string;
  icon: string;
  title: string;
  description: string;
  status: CardStatus;
  target: CardTarget;
};

// Toutes les cartes vivent ici, groupées par onglet. Pour ajouter/retirer une
// carte, il suffit d'éditer ce tableau : le rendu est généré par .map() plus
// bas, aucun JSX à dupliquer.
const CARDS_BY_TAB: Record<TabKey, SectionCard[]> = {
  jouer: [
    {
      id: 'improvisation-guidee',
      icon: '🎹',
      title: 'Improvisation guidée',
      description: 'Improvise sur une progression choisie selon ton émotion du moment.',
      status: 'disponible',
      target: { kind: 'route', route: 'Impro' },
    },
    {
      id: 'composition-assistee',
      icon: '🎼',
      title: 'Composition assistée',
      description: 'Construis ta propre progression d’accords, degré par degré.',
      status: 'disponible',
      target: { kind: 'route', route: 'Creation' },
    },
    {
      id: 'backing-tracks',
      icon: '🥁',
      title: 'Backing tracks',
      description: 'Joue par-dessus des accompagnements enregistrés.',
      status: 'bientot',
      target: { kind: 'comingSoon', titre: 'Backing tracks' },
    },
  ],
  entrainer: [
    {
      id: 'flash-cards',
      icon: '🗂️',
      title: 'Flash cards - Gammes & accords',
      description: 'Révise gammes et accords sous forme de cartes rapides.',
      status: 'bientot',
      target: { kind: 'comingSoon', titre: 'Flash cards' },
    },
  ],
  // 4 cartes distinctes plutôt qu'une carte "Exercices d'oreille" unique :
  // donne une meilleure idée de ce qui arrivera, pour le même nombre
  // d'écrans placeholder derrière (voir la consigne, qui laissait le choix).
  ecouter: [
    {
      id: 'oreille-accords',
      icon: '🎧',
      title: "Reconnaissance d'accords",
      description: 'Identifie à l’oreille les accords joués.',
      status: 'bientot',
      target: { kind: 'comingSoon', titre: "Reconnaissance d'accords" },
    },
    {
      id: 'oreille-intervalles',
      icon: '👂',
      title: "Reconnaissance d'intervalles",
      description: 'Identifie l’intervalle entre deux notes jouées.',
      status: 'bientot',
      target: { kind: 'comingSoon', titre: "Reconnaissance d'intervalles" },
    },
    {
      id: 'oreille-tonalite',
      icon: '🔑',
      title: 'Reconnaissance de tonalité',
      description: 'Devine la tonalité d’un extrait joué.',
      status: 'bientot',
      target: { kind: 'comingSoon', titre: 'Reconnaissance de tonalité' },
    },
    {
      id: 'oreille-melodie',
      icon: '🎵',
      title: 'Reconnaissance de mélodie',
      description: 'Reproduis ou identifie une courte mélodie jouée.',
      status: 'bientot',
      target: { kind: 'comingSoon', titre: 'Reconnaissance de mélodie' },
    },
  ],
  apprendre: [
    {
      id: 'schemas-musicaux',
      icon: '🧩',
      title: 'Schémas musicaux',
      description: 'Explore les enchaînements d’accords les plus courants.',
      status: 'bientot',
      target: { kind: 'comingSoon', titre: 'Schémas musicaux' },
    },
    {
      id: 'tips-modulation',
      icon: '🔄',
      title: 'Tips de modulation',
      description: 'Des astuces pour changer de tonalité en douceur.',
      status: 'bientot',
      target: { kind: 'comingSoon', titre: 'Tips de modulation' },
    },
    {
      id: 'tips-enrichissement',
      icon: '✨',
      title: "Tips d'enrichissement",
      description: 'Des astuces pour enrichir tes accords (7e, 9e, sus...).',
      status: 'bientot',
      target: { kind: 'comingSoon', titre: "Tips d'enrichissement" },
    },
  ],
};

// Icônes des statistiques — mêmes emoji que HomeScreen (STREAK_ICON et
// l'icône "xp" de STAT_DISPLAY_ITEMS) : même sens visuel dans toute l'app.
const XP_ICON = '⭐';
const STREAK_ICON = '🔥';
const CONSEIL_ICON = '💡';

// TODO: conseils personnalisés — une vraie logique de recommandation (quoi
// travailler en priorité selon l'historique/les points faibles de
// l'utilisateur) est hors périmètre de cette étape (demande explicite : pas
// de logique de conseil intelligente ici). Un seul conseil STATIQUE en
// attendant, affiché tel quel à tout le monde.
const CONSEIL_STATIQUE =
  "Varie tes exercices : un peu d'impro, un peu d'oreille, un peu de théorie chaque semaine.";

export default function ExercisesScreen() {
  // Hook de navigation typé sur la pile Exercices (pas de "any").
  const navigation = useNavigation<ExercisesNavigation>();
  // Le header natif de cet écran est masqué (voir ExercisesStack.tsx,
  // headerShown: false sur "ExercisesList") : c'est donc CET écran qui doit
  // gérer lui-même la safe area en haut (paddingTop = insets.top +
  // spacing), même principe que HomeScreen.tsx/LessonCourseScreen.
  const insets = useSafeAreaInsets();

  // "jouer" par défaut : c'est l'onglet qui contient les 2 exercices
  // réellement fonctionnels de l'app, le plus utile à voir en premier.
  const [activeTab, setActiveTab] = useState<TabKey>('jouer');

  // 2 états exposés par ProfileContext à gérer (voir useProfile()) : tant que
  // isProfileLoading est vrai, "profil" n'est pas encore fiable. "…" pendant
  // le chargement, "—" en cas d'échec — jamais un chiffre périmé/inventé,
  // même convention que HomeScreen.tsx.
  const { profil, isLoading: isProfileLoading } = useProfile();
  const xpDisplay = isProfileLoading ? '…' : profil ? profil.xp.toLocaleString('fr-FR') : '—';
  const streakDisplay = isProfileLoading ? '…' : profil ? String(profil.streak_actuelle) : '—';

  const handleCardPress = (card: SectionCard) => {
    if (card.target.kind === 'route') {
      navigation.navigate(card.target.route);
    } else {
      navigation.navigate('ComingSoon', { titre: card.target.titre });
    }
  };

  const activeCards = CARDS_BY_TAB[activeTab];

  return (
    <View style={styles.screen}>
      {/* ZONE STATS/CONSEILS — fixe en haut (comme la bande streak/jetons de
          HomeScreen) : XP + streak RÉELS (profil via ProfileContext) sur une
          rangée, puis l'emplacement conseils juste en dessous. Porte la
          safe area (premier élément de l'écran). */}
      <View style={[styles.statsConseils, { paddingTop: insets.top + theme.spacing.md }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>{XP_ICON}</Text>
            <Text style={styles.statValue}>{xpDisplay} XP</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>{STREAK_ICON}</Text>
            <Text style={styles.statValue}>{streakDisplay} j</Text>
          </View>
        </View>

        <View style={styles.conseilRow}>
          <Text style={styles.conseilIcon}>{CONSEIL_ICON}</Text>
          <Text style={styles.conseilText}>{CONSEIL_STATIQUE}</Text>
        </View>
      </View>

      {/* HEADER À 4 ONGLETS — state local, pas de navigateur (voir TabKey plus
          haut). Onglet actif souligné avec l'accent du thème, même recette
          que la bannière de l'accueil (theme.colors.primary). */}
      <View style={styles.tabHeader}>
        {HEADER_TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* CONTENU DE L'ONGLET ACTIF — cartes de section, voir CARDS_BY_TAB. */}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {activeCards.map((card) => (
          <Pressable
            key={card.id}
            style={[styles.card, card.status === 'bientot' && styles.cardSoon]}
            onPress={() => handleCardPress(card)}
          >
            <View style={[styles.iconBadge, card.status === 'disponible' && styles.iconBadgeAvailable]}>
              <Text style={styles.cardIcon}>{card.icon}</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    card.status === 'disponible' ? styles.statusBadgeAvailable : styles.statusBadgeSoon,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeLabel,
                      card.status === 'disponible'
                        ? styles.statusBadgeLabelAvailable
                        : styles.statusBadgeLabelSoon,
                    ]}
                  >
                    {card.status === 'disponible' ? 'Disponible' : 'Bientôt'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDescription}>{card.description}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // Même famille visuelle que le header à onglets juste en dessous (surface +
  // bordure basse) : les 2 se lisent comme un seul bloc de "chrome du haut",
  // même principe que statsStrip+banner de HomeScreen.
  statsConseils: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
  },
  // "flex: 1" sur chaque item (pas de largeur fixe) : les 2 stats se
  // partagent toute la largeur à parts égales, même recette que
  // statsStripItem de HomeScreen.
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  statIcon: {
    fontSize: theme.text.size.lg,
  },
  statValue: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  conseilRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  conseilIcon: {
    fontSize: theme.text.size.md,
  },
  conseilText: {
    flex: 1,
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    color: theme.colors.textMuted,
  },
  tabLabelActive: {
    color: theme.colors.primary,
    fontWeight: theme.text.weight.bold,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  // Carte élevée (surface + ombre légère), comme les cartes de
  // HomeScreen/creation.tsx — pas de token "ombre de carte" dans le thème
  // (déjà signalé ailleurs) : shadowColor en noir, valeurs volontairement
  // légères.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
  // Cartes "bientôt" légèrement atténuées : reste lisible/cliquable (mène à
  // "À venir"), mais se lit visuellement en retrait par rapport aux cartes
  // disponibles.
  cardSoon: {
    opacity: 0.85,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  // Accent "exercice" (teal) réservé aux cartes DISPONIBLES : attire l'œil
  // vers ce qui est réellement jouable, les badges "bientôt" gardent le fond
  // neutre "background" défini juste au-dessus.
  iconBadgeAvailable: {
    backgroundColor: theme.colors.exercice,
  },
  cardIcon: {
    fontSize: theme.text.size.xl,
  },
  cardBody: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  cardDescription: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  statusBadgeAvailable: {
    backgroundColor: theme.colors.exercice,
  },
  // Fond neutre + bordure (pas de fond "locked" plein) : theme.colors.locked
  // est pensé comme une couleur de TEXTE sur fond sombre (voir son
  // commentaire dans colors.ts), pas comme un fond de badge — on respecte
  // cet usage prévu plutôt que de le détourner en arrière-plan.
  statusBadgeSoon: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusBadgeLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
  },
  // Pas de token "texte sur fond coloré" dans le thème (déjà signalé
  // ailleurs, ex: HomeScreen streakValue) : blanc en dur ici.
  statusBadgeLabelAvailable: {
    color: '#FFFFFF',
  },
  statusBadgeLabelSoon: {
    color: theme.colors.locked,
  },
});
