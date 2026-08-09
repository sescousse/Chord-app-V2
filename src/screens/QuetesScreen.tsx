import { ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { useQuetes } from '../context/QuetesContext';

// --- BARRE DE PROGRESSION ---------------------------------------------
// Même piste arrondie que LessonCourseScreen ; le remplissage change de
// couleur une fois la quête "complete" (achievementUnlocked, même famille
// "récompense" que le cercle de droite) plutôt que de rester "primary" —
// c'est ce qui, avec la coche du libellé plus bas (voir queteRow), rend une
// quête terminée visuellement distincte d'une quête encore en cours.
type ProgressBarProps = {
  progression: number;
  objectif: number;
  complete: boolean;
};

function ProgressBar({ progression, objectif, complete }: ProgressBarProps) {
  const fraction = objectif > 0 ? Math.min(1, progression / objectif) : 0;

  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          complete && styles.progressFillComplete,
          { width: `${fraction * 100}%` },
        ]}
      />
    </View>
  );
}

// TODO: illustration récompense — même emoji placeholder pour les 3 quêtes
// en attendant (aucune donnée de récompense réelle par quête à cette étape).
const RECOMPENSE_ICONE_PLACEHOLDER = '🎁';

// Minuteur factice affiché en haut de "Quêtes du jour" : texte fixe, aucun
// state/interval — le vrai décompte (avant réinitialisation quotidienne)
// viendra avec la vraie mécanique.
const MINUTEUR_FACTICE = '3 h';

export default function QuetesScreen() {
  // Header natif masqué pour cet onglet (voir RootNavigator.tsx, même
  // convention que Home/Exercices/Profil) : cet écran gère donc lui-même la
  // safe area en haut.
  const insets = useSafeAreaInsets();

  // Quêtes du jour ET quête du mois, chargées/créées UNE FOIS par
  // QuetesProvider (voir QuetesContext.tsx) et tenues à jour EN MÉMOIRE par
  // avancerQuete, appelé depuis n'importe quel écran (LessonCourseScreen,
  // improResult.tsx, creation.tsx, UserProfileScreen.tsx, PianoChord.tsx) —
  // cet écran ne fait qu'AFFICHER l'état partagé, aucun chargement propre à
  // lui. isLoading/error couvrent LES DEUX chargements (voir leur commentaire
  // dans QuetesContext.tsx).
  const { quetesDuJour, queteMois, isLoading, error } = useQuetes();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* QUÊTE DU MOIS — zone pleine largeur, SANS cadre (pas de bordure/
          ombre) : juste un fond (surface) différent de celui de la zone du
          bas (background), pour une séparation nette entre les deux zones
          sans les encadrer chacune séparément. */}
      <View style={[styles.moisSection, { paddingTop: insets.top + theme.spacing.lg }]}>
        <View style={styles.moisHeaderRow}>
          <Text style={styles.moisIcon}>🗓️</Text>
          <Text style={theme.text.title}>Quête du mois</Text>
        </View>

        {isLoading && (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loadingIndicator} />
        )}
        {!isLoading && error && <Text style={styles.errorText}>{error}</Text>}

        {!isLoading && !error && queteMois && (
          <>
            <View style={styles.moisEnonceRow}>
              {/* Coche "terminé" — même convention que les quêtes du jour
                  (voir queteEnonceRow plus bas). */}
              {queteMois.complete && <Text style={styles.queteCompleteIcon}>✅</Text>}
              <Text style={[styles.moisDescription, queteMois.complete && styles.queteEnonceComplete]}>
                {queteMois.enonce}
              </Text>
            </View>
            <ProgressBar
              progression={queteMois.progression}
              objectif={queteMois.objectif}
              complete={queteMois.complete}
            />
            <Text
              style={[
                styles.moisProgressionLabel,
                queteMois.complete && styles.queteProgressionLabelComplete,
              ]}
            >
              {queteMois.complete
                ? 'Terminée !'
                : `${queteMois.progression} / ${queteMois.objectif}`}
            </Text>
          </>
        )}
      </View>

      {/* QUÊTES DU JOUR — zone pleine largeur elle aussi, son fond (background)
          EST le seul bloc visuel de cette zone : les 3 quêtes sont de simples
          rangées à l'intérieur (séparées par un liseré), pas des cartes
          indépendantes chacune avec son propre fond. */}
      <View style={styles.jourSection}>
        <View style={styles.jourHeader}>
          <Text style={theme.text.title}>Quêtes du jour</Text>
          {/* Minuteur factice, pas de vrai décompte (voir MINUTEUR_FACTICE). */}
          <View style={styles.minuteurPill}>
            <Text style={styles.minuteurLabel}>⏱️ {MINUTEUR_FACTICE}</Text>
          </View>
        </View>

        {isLoading && (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loadingIndicator} />
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {!isLoading &&
          !error &&
          quetesDuJour.map((quete, index) => (
            <View key={quete.id} style={[styles.queteRow, index > 0 && styles.queteRowDivider]}>
              <View style={styles.queteInfo}>
                <View style={styles.queteEnonceRow}>
                  {/* Coche "terminé" — avec le remplissage de barre qui passe
                      à achievementUnlocked (voir ProgressBar), c'est ce qui
                      distingue une quête complète d'une quête en cours. */}
                  {quete.complete && <Text style={styles.queteCompleteIcon}>✅</Text>}
                  <Text style={[styles.queteEnonce, quete.complete && styles.queteEnonceComplete]}>
                    {quete.enonce}
                  </Text>
                </View>
                <ProgressBar
                  progression={quete.progression}
                  objectif={quete.objectif}
                  complete={quete.complete}
                />
                <Text
                  style={[
                    styles.queteProgressionLabel,
                    quete.complete && styles.queteProgressionLabelComplete,
                  ]}
                >
                  {quete.complete ? 'Terminée !' : `${quete.progression} / ${quete.objectif}`}
                </Text>
              </View>

              {/* TODO: illustration récompense — cercle + emoji en attendant. */}
              <View style={styles.recompenseCircle}>
                <Text style={styles.recompenseIcon}>{RECOMPENSE_ICONE_PLACEHOLDER}</Text>
              </View>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // Pas de padding/gap horizontal ici : les 2 zones (moisSection/jourSection)
  // gèrent chacune leur propre fond ET leur propre padding, pleine largeur
  // (edge-to-edge) — c'est ce qui permet à leur couleur de fond de couvrir
  // TOUTE la largeur de l'écran plutôt que de s'arrêter à une marge commune.
  content: {
    paddingBottom: theme.spacing.xl,
  },
  // Zone du haut : fond "surface", pleine largeur, sans bordure ni ombre —
  // la différence de fond avec jourSection (background) juste en dessous
  // suffit à séparer nettement les deux zones, pas besoin d'un cadre en plus.
  moisSection: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  moisHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  moisIcon: {
    fontSize: theme.text.size.xl,
  },
  moisEnonceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  moisDescription: {
    fontSize: theme.text.size.md,
    color: theme.colors.textMuted,
  },
  moisProgressionLabel: {
    alignSelf: 'flex-end',
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  // Zone du bas : fond "background" (celui de l'écran) — EST le bloc visuel
  // unique de cette zone, les rangées de quêtes ci-dessous n'ont plus leur
  // propre fond/bordure (voir queteRow).
  jourSection: {
    width: '100%',
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  jourHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loadingIndicator: {
    marginVertical: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    textAlign: 'center',
  },
  minuteurPill: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  minuteurLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.medium,
    color: theme.colors.textMuted,
  },
  // Simple rangée (pas de fond/bordure propre) : les 3 quêtes se lisent
  // comme un seul bloc continu (celui de jourSection), séparées entre elles
  // par un liseré (voir queteRowDivider) plutôt que chacune dans sa carte.
  queteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  queteRowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  queteInfo: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  queteEnonceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  queteCompleteIcon: {
    fontSize: theme.text.size.md,
  },
  queteEnonce: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Texte muté (pas barré) une fois complète : reste lisible, mais se
  // distingue des quêtes encore en cours sans nécessiter un 2e passage de
  // lecture — la coche + le "Terminée !" ci-dessous suffisent déjà à le dire
  // explicitement, cette couleur est juste un renfort visuel discret.
  queteEnonceComplete: {
    color: theme.colors.textMuted,
  },
  queteProgressionLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  queteProgressionLabelComplete: {
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.achievementUnlocked,
  },
  // Même piste/remplissage que LessonCourseScreen (progressTrack/progressFill) :
  // hauteur spacing.sm, coins radius.sm (pilule), remplissage "primary".
  progressTrack: {
    height: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
  },
  // Remplacement de couleur (pas un style additif) une fois la quête
  // complète : même token que le cercle récompense (achievementUnlocked),
  // pour une cohérence visuelle "ceci est terminé / récompensé".
  progressFillComplete: {
    backgroundColor: theme.colors.achievementUnlocked,
  },
  // "achievementUnlocked" (or, famille chaude "récompense" déjà utilisée pour
  // les succès débloqués, voir ProfileScreen) : même sens visuel réutilisé
  // ici pour cet emplacement récompense, pas de nouveau token nécessaire.
  recompenseCircle: {
    width: theme.spacing.xl * 2,
    height: theme.spacing.xl * 2,
    borderRadius: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.achievementUnlocked,
  },
  recompenseIcon: {
    fontSize: theme.text.size.xl,
  },
});
