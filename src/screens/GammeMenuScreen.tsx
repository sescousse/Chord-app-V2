// Page-menu du module "Les bases de l'improvisation", pour LA GAMME choisie
// dans la modale "Choisis ta gamme" (voir ChoisirGammeContent.tsx) — ouverte
// au tap sur "Démarre" (voir ExercisesScreen.tsx). L'en-tête (titre natif de
// la pile, voir ExercisesStack.tsx) rappelle la gamme ; le corps présente les
// 4 blocs du module, empilés pleine largeur.
//
// "Découvrir les accords" est désormais ACTIF (statut 'disponible') : mène à
// l'exercice "Reproduis l'accord" — un composant AUTONOME (voir
// src/components/ReproduisAccordExercise.tsx) monté ici via un écran-hôte
// TEMPORAIRE de test (ReproduisAccordScreen.tsx, voir son commentaire). Les
// 3 autres blocs restent 'bientot' → ComingSoon (même patron que TOUTES les
// destinations non construites de l'app), inchangés.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ExercisesStackParamList } from '../navigation/ExercisesStack';
import { theme } from '../theme';

type GammeMenuRoute = RouteProp<ExercisesStackParamList, 'GammeMenu'>;
type GammeMenuNavigation = NativeStackNavigationProp<ExercisesStackParamList, 'GammeMenu'>;

// Même principe que CardStatus/CardTarget dans ExercisesScreen.tsx : un bloc
// 'disponible' mène à une VRAIE route (avec tonique/mode transmis), un bloc
// 'bientot' mène toujours à ComingSoon.
type ModuleBlock =
  | {
      id: string;
      icon: string;
      title: string;
      description: string;
      status: 'disponible';
      target: 'ReproduisAccord';
    }
  | {
      id: string;
      icon: string;
      title: string;
      description: string;
      status: 'bientot';
    };

// Les 4 blocs, dans l'ordre demandé — un tableau + .map() plutôt que du JSX
// répété 4 fois, même convention que CARDS_BY_TAB dans ExercisesScreen.tsx.
// Pour les blocs "bientot", "title" sert aussi de "titre" transmis à
// ComingSoon (voir handlePressBlock) : même principe que les cartes
// "bientot" d'ExercisesScreen, où le titre de la carte EST le titre de
// l'écran "À venir" qu'elle ouvre.
const MODULE_BLOCKS: ModuleBlock[] = [
  {
    id: 'decouvrir-gamme',
    icon: '🎼',
    title: 'Découvrir la gamme',
    description: 'Explore les notes de la gamme choisie.',
    status: 'bientot',
  },
  {
    id: 'decouvrir-accords',
    icon: '🎹',
    title: 'Découvrir les accords',
    description: 'Reproduis les accords de cette gamme au clavier.',
    status: 'disponible',
    target: 'ReproduisAccord',
  },
  {
    id: 'apprendre-accompagner',
    icon: '🥁',
    title: 'Apprendre à accompagner',
    description: 'Des accompagnements adaptés à cette gamme.',
    status: 'bientot',
  },
  {
    id: 'progressions',
    icon: '🧩',
    title: 'Progressions',
    description: "Des enchaînements d'accords à improviser dans cette gamme.",
    status: 'bientot',
  },
];

export default function GammeMenuScreen() {
  // "tonique"/"mode" servent maintenant à 2 choses : le titre natif (lu
  // directement par ExercisesStack.tsx, indépendamment d'ici) ET à les
  // transmettre au bloc "Découvrir les accords" (voir handlePressBlock) —
  // ce composant a donc de nouveau besoin de useRoute() ici.
  const route = useRoute<GammeMenuRoute>();
  const navigation = useNavigation<GammeMenuNavigation>();
  const { tonique, mode } = route.params;

  const handlePressBlock = (block: ModuleBlock) => {
    if (block.status === 'disponible') {
      navigation.navigate(block.target, { tonique, mode });
    } else {
      navigation.navigate('ComingSoon', { titre: block.title });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {MODULE_BLOCKS.map((block) => (
        <Pressable
          key={block.id}
          style={[styles.card, block.status === 'bientot' && styles.cardSoon]}
          onPress={() => handlePressBlock(block)}
        >
          <View style={[styles.iconBadge, block.status === 'disponible' && styles.iconBadgeAvailable]}>
            <Text style={styles.cardIcon}>{block.icon}</Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{block.title}</Text>
              <View
                style={[
                  styles.statusBadge,
                  block.status === 'disponible' ? styles.statusBadgeAvailable : styles.statusBadgeSoon,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeLabel,
                    block.status === 'disponible'
                      ? styles.statusBadgeLabelAvailable
                      : styles.statusBadgeLabelSoon,
                  ]}
                >
                  {block.status === 'disponible' ? 'Disponible' : 'Bientôt'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardDescription}>{block.description}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// Recette IDENTIQUE aux cartes de la section Apprendre (ExercisesScreen.tsx)
// — dupliquée ici plutôt qu'importée : aucun écran de l'app ne partage ses
// styles avec un autre (chaque écran définit son propre StyleSheet.create()
// local), c'est la convention déjà établie partout ailleurs (ex:
// HarmonyTestScreen a sa propre recette de "carte de résultat", distincte
// mais visuellement cohérente). Les 2 variantes disponible/bientôt
// reprennent exactement les mêmes tokens qu'ExercisesScreen.tsx.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
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
  statusBadgeSoon: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusBadgeLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
  },
  statusBadgeLabelAvailable: {
    color: '#FFFFFF',
  },
  statusBadgeLabelSoon: {
    color: theme.colors.locked,
  },
});
