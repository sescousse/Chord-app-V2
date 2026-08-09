import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import { useProfile } from '../context/ProfileContext';

// TODO: vraie boutique de jetons via achats intégrés (in-app purchases) —
// système lourd de fin de projet (StoreKit/Google Play Billing, dev build
// requis, comptes développeurs).

// Icône du bloc placeholder — même convention emoji que le reste de l'app
// (@expo/vector-icons n'est utilisé que pour la barre d'onglets).
const BOUTIQUE_ICON = '🏪';
const JETON_ICON = '🪙';

export default function BoutiqueJetonsScreen() {
  // Header natif (title "Boutique" + retour) fourni par HomeStack.tsx, pas
  // de safe area à gérer ici — voir le commentaire sur cette route dans
  // HomeStack.tsx.
  const { profil, isLoading: isProfileLoading } = useProfile();

  const soldeDisplay = isProfileLoading ? '…' : profil ? String(profil.jetons) : '—';

  return (
    <View style={styles.screen}>
      {/* Solde de jetons ACTUEL, réel (profil.jetons via ProfileContext) —
          seule donnée réelle de cet écran, tout le reste est un placeholder. */}
      <View style={styles.soldeRow}>
        <Text style={styles.soldeIcon}>{JETON_ICON}</Text>
        <Text style={styles.soldeValue}>{soldeDisplay}</Text>
      </View>

      <View style={styles.placeholderBlock}>
        <Text style={styles.placeholderIcon}>{BOUTIQUE_ICON}</Text>
        <Text style={styles.placeholderTitle}>Boutique bientôt disponible</Text>
        <Text style={styles.placeholderSubtitle}>
          Tu pourras bientôt obtenir des jetons ici.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  soldeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  soldeIcon: {
    fontSize: theme.text.size.xl,
  },
  soldeValue: {
    fontSize: theme.text.size.xl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  // Centré verticalement dans l'espace restant sous le solde — flex: 1 pour
  // occuper le reste de l'écran, justifyContent centre le contenu dedans.
  placeholderBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  placeholderIcon: {
    fontSize: theme.text.size.xxxl * 2,
  },
  placeholderTitle: {
    fontSize: theme.text.size.xl,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  placeholderSubtitle: {
    fontSize: theme.text.size.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
