import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import { useSucces } from '../context/SuccesContext';

// Overlay plein écran, monté UNE SEULE FOIS à la racine de l'app (voir
// App.tsx) — se rend lui-même invisible (renvoie null) tant qu'aucun succès
// n'est en cours de célébration (voir succesEnCelebration, SuccesContext.tsx).
//
// POSITIONNEMENT : rendu comme FRÈRE de <NavigationContainer> dans App.tsx,
// APRÈS lui dans le JSX — comme les <SlidePanel> de improResult.tsx/
// creation.tsx (un élément plus tard dans l'arbre se peint par-dessus ses
// frères précédents), mais ICI à l'échelle de l'app ENTIÈRE : ce succès peut
// être débloqué depuis n'importe quel écran (leçon dans HomeStack, "Crée ta
// progression" dans ExercisesStack...), l'overlay doit donc vivre au-dessus
// de TOUTE la navigation, pas dans un écran en particulier.
export function SuccesCelebrationOverlay() {
  const { succesEnCelebration, fermerCelebration } = useSucces();

  if (!succesEnCelebration) {
    return null;
  }

  return (
    <Pressable style={styles.overlay} onPress={fermerCelebration}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Succès obtenu !</Text>

        {/* TODO: illustration du badge — icône générique en attendant (voir
            le champ "icone" de Succes, dataset/succes.ts). */}
        <View style={styles.badgeCircle}>
          <Text style={styles.badgeIcon}>{succesEnCelebration.icone}</Text>
        </View>

        <Text style={styles.title}>{succesEnCelebration.titre}</Text>
        <Text style={styles.xpLabel}>+{succesEnCelebration.recompense_xp} XP</Text>

        <Text style={styles.hint}>Appuie pour continuer</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Scrim d'assombrissement : noir semi-transparent en dur, comme
    // shadowColor ailleurs dans l'app — ce n'est pas un choix de TEINTE de
    // marque, juste la valeur universelle attendue pour ce genre d'effet
    // (assombrir ce qu'il y a derrière), indépendante de la palette.
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    // zIndex + elevation : garantit d'être au-dessus de TOUT le reste
    // (navigation, tab bar, éventuel autre SlidePanel ouvert...), y compris
    // sur Android où le rendu natif s'appuie sur "elevation" plutôt que
    // zIndex seul pour l'empilement.
    zIndex: 999,
    elevation: 999,
  },
  // Carte "festive" : bordure dorée (achievementUnlocked) qui tranche sur le
  // fond assombri, plutôt qu'une carte neutre comme le reste de l'app — ici
  // seulement, car ce moment doit se démarquer de tout le reste.
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 2,
    borderColor: theme.colors.achievementUnlocked,
  },
  kicker: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.achievementUnlocked,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badgeCircle: {
    width: theme.spacing.xl * 3,
    height: theme.spacing.xl * 3,
    borderRadius: (theme.spacing.xl * 3) / 2,
    backgroundColor: theme.colors.achievementUnlocked,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: {
    fontSize: theme.text.size.xxxl,
  },
  title: {
    textAlign: 'center',
    fontSize: theme.text.size.xxl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  xpLabel: {
    fontSize: theme.text.size.xl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.primary,
  },
  hint: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
});
