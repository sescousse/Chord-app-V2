import { Animated, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

// Amplitude du "soulèvement" en pixels : quelques pixels seulement (effet
// demandé : subtil), vers le HAUT (valeur négative). C'est CE composant qui
// décide de cette amplitude — le parent (CourseParcoursScreen) ne fait que
// piloter "à quel point on est soulevé" via liftAnim (0 à 1), sans connaître
// le détail en pixels.
const LIFT_TRANSLATE_Y = -8;

interface UnitHeaderProps {
  unitNumber: number;
  title: string;
  // Valeur PARTAGÉE par toutes les UnitHeader de l'écran (une par unité) :
  // 0 = repos, 1 = "soulevée". Pilotée par le scroll du ScrollView parent
  // (voir CourseParcoursScreen), pas par chaque en-tête individuellement —
  // tous les en-têtes affichés se soulèvent donc ENSEMBLE dès que
  // l'utilisateur scrolle, peu importe leur position à l'écran.
  liftAnim: Animated.Value;
  // Unité verrouillée (ex: UNIT_2) : en-tête légèrement atténuée, cohérente
  // avec ses bulles grisées (voir CourseParcoursScreen).
  dimmed?: boolean;
}

export function UnitHeader({ unitNumber, title, liftAnim, dimmed = false }: UnitHeaderProps) {
  // interpolate() traduit liftAnim (une simple quantité abstraite, 0 à 1) en
  // un déplacement RÉEL en pixels (0 à LIFT_TRANSLATE_Y) : c'est ce qui
  // permet au parent de piloter juste "soulevée ou non", sans se soucier de
  // l'amplitude visuelle exacte.
  const translateY = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, LIFT_TRANSLATE_Y],
  });

  return (
    <Animated.View
      style={[styles.card, dimmed && styles.cardDimmed, { transform: [{ translateY }] }]}
    >
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{unitNumber}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // "Carte qui flotte" : coins très arrondis (radius.xl) + ombre légère et
  // STATIQUE (pas animée — seul translateY l'est, voir le commentaire sur
  // liftAnim dans CourseParcoursScreen pour le pourquoi). shadow* = iOS,
  // elevation = Android : React Native n'a pas de prop d'ombre unifiée.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  // Unité verrouillée : remplace le fond "primary" par le gris neutre
  // theme.colors.locked, cohérent avec les bulles grisées de cette unité
  // (voir CourseParcoursScreen) — un vrai token de couleur plutôt qu'une
  // simple opacité réduite.
  cardDimmed: {
    backgroundColor: theme.colors.locked,
  },
  // Pas de token "fond translucide sur couleur d'accent" dans le thème :
  // blanc semi-transparent en dur ici, juste pour détacher légèrement le
  // badge du fond de la carte.
  numberBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.spacing.xl,
    height: theme.spacing.xl,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  // Pas de token "texte sur fond coloré" dans le thème : blanc en dur ici,
  // comme déjà fait ailleurs dans l'app pour ce même besoin (ex:
  // CourseParcoursScreen, LessonCourseScreen).
  numberText: {
    fontSize: theme.text.size.xl,
    fontWeight: theme.text.weight.bold,
    color: '#FFFFFF',
  },
  title: {
    flex: 1,
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: '#ef0000',
  },
});
