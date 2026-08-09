import { StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { theme } from '../theme';

// Forme des params attendus par CET écran : un simple titre à afficher.
// Exportée ICI (source canonique) plutôt que dans une pile en particulier —
// ce composant est monté par PLUSIEURS piles (AppStack, pour les 7 entrées
// du menu réglages ; ExercisesStack, pour les cartes "Bientôt" de la page
// Apprentissage — voir ComingSoon dans ExercisesStack.tsx) : chacune importe
// ce type pour typer sa propre route plutôt que de le dupliquer.
export type PlaceholderParams = { titre: string };

// RouteProp générique, PAS lié à une ParamList précise (contrairement à
// avant, où ce composant dépendait uniquement d'AppStackParamList) :
// "Record<string, PlaceholderParams>" accepte n'importe quel nom de route du
// moment que ses params ont la forme PlaceholderParams — reste TYPÉ (pas de
// "any") tout en permettant à ce même composant d'être réutilisé par
// plusieurs piles différentes.
type PlaceholderRoute = RouteProp<Record<string, PlaceholderParams>, string>;

// Écran générique "À venir" : un titre + "À venir", rien d'autre à cette
// étape. Un seul composant réutilisé par toutes les routes placeholder de
// l'app plutôt que dupliqué par destination.
export default function PlaceholderScreen() {
  const route = useRoute<PlaceholderRoute>();
  const { titre } = route.params;

  return (
    <View style={styles.container}>
      <Text style={theme.text.title}>{titre}</Text>
      <Text style={styles.subtitle}>À venir</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  subtitle: {
    fontSize: theme.text.size.md,
    color: theme.colors.textMuted,
  },
});
