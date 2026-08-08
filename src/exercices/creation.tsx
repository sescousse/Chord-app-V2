import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';

import { theme } from '../theme';
import { degreeToChord, type ExtensionLevel, type ScaleChoice } from '../dataset/chordUtils';
import { SlidePanel } from '../components/SlidePanel';
// OUTILS RÉUTILISÉS depuis l'écran résultat de l'impro libre — EXPORTÉS
// spécialement pour cette réutilisation (voir leur commentaire dans
// improResult.tsx) : ce fichier ne redéfinit ni le rendu du clavier
// enrichi/voicing/renversements (ExpandedChordPanel, qui embarque déjà
// PianoChord), ni les 2 panneaux "Découvrir un accompagnement"/"Découvrir
// le voicing". Zéro duplication de logique.
import { ExpandedChordPanel, AccompanimentPanelContent, VoicingPanelContent } from './improResult';
import { useProfile } from '../context/ProfileContext';
import { useSucces } from '../context/SuccesContext';
import { XP_PROGRESSION, XP_FEEDBACK_DURATION_MS } from '../lib/xpRewards';

// Palette des degrés proposés. Modifie ce tableau pour ajouter/retirer des boutons.
const MAJEUR: string[] = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MINEURNAT: string[] = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

// Les 2 boutons de choix de gamme, affichés avant la palette de degrés.
const SCALES: { label: string; value: ScaleChoice }[] = [
  { label: 'Majeur', value: 'majeur' },
  { label: 'Mineur', value: 'mineur' },
];

// Associe chaque gamme choisie au tableau de degrés correspondant.
const DEGREES_BY_SCALE: Record<ScaleChoice, string[]> = {
  majeur: MAJEUR,
  mineur: MINEURNAT,
};

// Tonalités proposées pour le choix de tonique. Ajoute des notes ici pour étendre le choix.
const TONICS: string[] = ['C', 'G', 'D', 'A', 'E', 'F'];

// degreeToChord (degré + gamme + tonique → accord concret) vit maintenant
// dans chordUtils.ts, partagée avec improResult.tsx (voir son enrichissement
// par 7e diatonique) plutôt que dupliquée ici.

export default function CreationScreen() {
  const [scale, setScale] = useState<ScaleChoice | null>(null);
  const [tonic, setTonic] = useState<string>('C');
  const [progression, setProgression] = useState<string[]>([]);

  // --- CARROUSEL -------------------------------------------------------
  // Un SEUL accord visible à la fois (voir le rendu plus bas), contrairement
  // à l'ancienne liste empilée de tous les claviers : "isCarouselOpen"
  // affiche/masque le carrousel, "carouselIndex" indique quel accord de
  // "progression" y est actuellement affiché (0-based). NAVIGATION par
  // flèches précédent/suivant + indicateur "x/N" (voir goToPreviousChord/
  // goToNextChord et styles.carouselNavRow) — pas de swipe horizontal : cet
  // écran vit dans un ScrollView VERTICAL, et un geste horizontal fiable qui
  // ne rentre pas en conflit avec ce défilement nécessiterait
  // react-native-gesture-handler (nouvelle dépendance, hors périmètre —
  // "bonus seulement si faisable sans dépendance") ; les flèches seules
  // suffisent, comme prévu en repli.
  const [isCarouselOpen, setIsCarouselOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Toujours dans les bornes de "progression", même si elle a rétréci
  // pendant que le carrousel était ouvert (ex: "Retirer le dernier" alors
  // qu'il affichait justement le dernier accord) — calculé au rendu plutôt
  // que stocké : pas besoin d'un effet dédié pour "rattraper" carouselIndex
  // à chaque changement de progression.
  const safeCarouselIndex = Math.min(carouselIndex, Math.max(0, progression.length - 1));

  const handleToggleCarousel = () => {
    if (!isCarouselOpen) {
      // Repart toujours du 1er accord à l'ouverture : simple et prévisible,
      // plutôt que de retenir la position d'une précédente consultation.
      setCarouselIndex(0);
    }
    setIsCarouselOpen((current) => !current);
  };

  const goToPreviousChord = () => {
    setCarouselIndex((current) => Math.max(0, current - 1));
  };

  const goToNextChord = () => {
    setCarouselIndex((current) => Math.min(progression.length - 1, current + 1));
  };

  // STATE D'ENRICHISSEMENT PAR ACCORD : une Map index → niveau, comme
  // enrichmentLevels dans ResultScreen (voir son commentaire détaillé
  // là-bas) — seule différence, la clé est directement l'index numérique
  // dans "progression" (un seul tableau ici, pas plusieurs progressions à
  // distinguer comme dans l'autre mode). Un accord absent de la Map vaut 0
  // (triade), le niveau par défaut. Le voicing et les renversements, eux,
  // restent LOCAUX à ExpandedChordPanel/PianoChord (jamais remontés ici) :
  // exactement le même comportement que dans ResultScreen, où seul le
  // niveau d'enrichissement survit à un changement d'accord affiché (voir
  // le "key" posé sur ExpandedChordPanel plus bas).
  const [enrichmentLevels, setEnrichmentLevels] = useState<Map<number, ExtensionLevel>>(new Map());

  const getEnrichmentLevel = (index: number): ExtensionLevel => {
    return enrichmentLevels.get(index) ?? 0;
  };

  const setEnrichmentLevel = (index: number, level: ExtensionLevel) => {
    setEnrichmentLevels((current) => {
      const next = new Map(current);
      if (level === 0) {
        next.delete(index);
      } else {
        next.set(index, level);
      }
      return next;
    });
  };

  // Panneaux "Découvrir un accompagnement"/"Découvrir le voicing" — même
  // principe que dans ResultScreen (état d'ouverture ici, contenu +
  // animation fournis par SlidePanel/les composants importés).
  const [isAccompanimentPanelOpen, setIsAccompanimentPanelOpen] = useState(false);
  const [isVoicingPanelOpen, setIsVoicingPanelOpen] = useState(false);

  // --- XP : bouton "Enregistrer" ----------------------------------------
  const { addXp } = useProfile();
  const { debloquerSucces } = useSucces();
  const [xpFeedback, setXpFeedback] = useState<string | null>(null);
  const xpFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (xpFeedbackTimeoutRef.current) {
        clearTimeout(xpFeedbackTimeoutRef.current);
      }
    };
  }, []);

  // TODO: sauvegarder vraiment la progression (table Supabase) + éviter le
  // farming d'XP — pour l'instant, "Enregistrer" attribue l'XP sans rien
  // persister ; rien n'empêche encore de le taper en boucle pour cumuler de
  // l'XP indéfiniment (le farming sera géré plus tard, voir la consigne).
  const handleSaveProgression = async () => {
    const { error } = await addXp(XP_PROGRESSION);
    if (error) {
      Alert.alert('Erreur', error);
      return;
    }

    // SUCCÈS "Compositeur né" — appelé APRÈS l'XP de routine ci-dessus
    // (jamais en parallèle, même raison que dans LessonCourseScreen.tsx :
    // addXp() lit-puis-écrit l'xp de façon non atomique, voir son
    // commentaire dans ProfileContext.tsx). "void" (pas de await) : ne
    // bloque jamais le feedback ci-dessous — debloquerSucces() ne fait rien
    // si "compositeur_ne" est déjà débloqué (voir SuccesContext.tsx), donc
    // sûr à appeler à CHAQUE "Enregistrer", pas seulement le tout premier.
    void debloquerSucces('compositeur_ne');

    setXpFeedback(`+${XP_PROGRESSION} XP`);
    if (xpFeedbackTimeoutRef.current) {
      clearTimeout(xpFeedbackTimeoutRef.current);
    }
    xpFeedbackTimeoutRef.current = setTimeout(() => setXpFeedback(null), XP_FEEDBACK_DURATION_MS);
  };

  // Ajout immuable : on crée un nouveau tableau (spread + degré) au lieu de
  // faire progression.push(degree), qui modifierait l'ancien tableau en place.
  const addDegree = (degree: string) => {
    setProgression((prev) => [...prev, degree]);
  };

  // Même logique : slice() renvoie une copie tronquée, ne mute pas prev.
  const removeLast = () => {
    setProgression((prev) => prev.slice(0, -1));
  };

  const clearProgression = () => {
    setProgression([]);
    setEnrichmentLevels(new Map());
    setIsCarouselOpen(false);
    setCarouselIndex(0);
  };

  return (
    // Enveloppe supplémentaire (comme dans ResultScreen) : les 2 SlidePanel
    // doivent se positionner en "absolute" par rapport à TOUT l'écran, pas
    // seulement par rapport au contenu défilant du ScrollView — ils doivent
    // donc être des FRÈRES du ScrollView, pas des enfants.
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={theme.text.title}>Crée ta progression</Text>

        {/* Choix de la gamme : conditionne les degrés proposés ensuite. */}
        <View style={styles.scaleRow}>
          {SCALES.map((item) => {
            const isSelected = item.value === scale;
            return (
              <Pressable
                key={item.value}
                style={[styles.scaleButton, isSelected && styles.scaleButtonSelected]}
                onPress={() => setScale(item.value)}
              >
                <Text style={styles.scaleLabel} numberOfLines={1}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Choix de la tonalité : combiné à la gamme pour calculer les accords concrets. */}
        <View style={styles.scaleRow}>
          {TONICS.map((item) => {
            const isSelected = item === tonic;
            return (
              <Pressable
                key={item}
                style={[styles.scaleButton, isSelected && styles.scaleButtonSelected]}
                onPress={() => setTonic(item)}
              >
                <Text style={styles.scaleLabel} numberOfLines={1}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Palette des degrés disponibles, une fois la gamme et la tonalité choisies. */}
        {scale && tonic ? (
          <View style={styles.paletteRow}>
            {DEGREES_BY_SCALE[scale].map((degree) => (
              <Pressable key={degree} style={styles.degreeButton} onPress={() => addDegree(degree)}>
                <Text style={styles.degreeLabel}>{degree}</Text>
                <Text style={styles.chordLabel}>{degreeToChord(degree, scale, tonic)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={theme.text.subtitle}>Choisis une gamme et une tonalité pour voir les degrés</Text>
        )}

        {/* Progression en cours de construction : degré + accord concret pour chaque étape. */}
        <Text style={theme.text.subtitle}>
          {progression.length > 0 && scale
            ? progression.map((degree) => `${degree} (${degreeToChord(degree, scale, tonic)})`).join(' - ')
            : 'Ajoute des accords pour construire ta progression'}
        </Text>

        {/* Bouton "Afficher/Masquer la progression" : ouvre le carrousel
            ci-dessous (un accord à la fois, avec ses outils) — remplace
            l'ancienne liste empilée de tous les claviers, qui n'offrait
            aucun outil par accord. */}
        {progression.length > 0 && scale && (
          <Pressable style={styles.toggleCarouselButton} onPress={handleToggleCarousel}>
            <Text style={styles.toggleCarouselButtonLabel}>
              {isCarouselOpen ? 'Masquer la progression' : 'Afficher la progression'}
            </Text>
          </Pressable>
        )}

        {/* CARROUSEL — un seul accord affiché à la fois, avec ses outils. */}
        {isCarouselOpen && scale && progression.length > 0 && (
          <View style={styles.carouselCard}>
            <View style={styles.carouselNavRow}>
              <Pressable
                style={[
                  styles.carouselArrowButton,
                  safeCarouselIndex === 0 && styles.carouselArrowButtonDisabled,
                ]}
                onPress={goToPreviousChord}
                disabled={safeCarouselIndex === 0}
              >
                <Text style={styles.carouselArrowLabel}>‹</Text>
              </Pressable>

              <Text style={styles.carouselIndicator}>
                {safeCarouselIndex + 1} / {progression.length}
              </Text>

              <Pressable
                style={[
                  styles.carouselArrowButton,
                  safeCarouselIndex === progression.length - 1 && styles.carouselArrowButtonDisabled,
                ]}
                onPress={goToNextChord}
                disabled={safeCarouselIndex === progression.length - 1}
              >
                <Text style={styles.carouselArrowLabel}>›</Text>
              </Pressable>
            </View>

            {/* "key" force ExpandedChordPanel (et son PianoChord interne) à
                repartir de zéro à chaque changement d'accord affiché :
                voicing et renversement redémarrent donc à leur état par
                défaut à chaque navigation, EXACTEMENT comme dans
                ResultScreen (voir son commentaire sur
                "key={chordKey(selected)}") — seul le niveau d'enrichissement
                (enrichmentLevels ci-dessus) survit, lui, puisqu'il est
                remonté dans CE composant plutôt que local à
                ExpandedChordPanel. */}
            <ExpandedChordPanel
              key={safeCarouselIndex}
              degree={progression[safeCarouselIndex]}
              scale={scale}
              tonic={tonic}
              level={getEnrichmentLevel(safeCarouselIndex)}
              onSelectLevel={(level) => setEnrichmentLevel(safeCarouselIndex, level)}
            />

            {/* Mêmes 2 boutons "Découvrir..." que ResultScreen : montrent un
                PRINCIPE sur un accord d'exemple fixe (pas l'accord affiché
                ci-dessus), voir leur commentaire dans improResult.tsx. */}
            <View style={styles.discoverButtonsRow}>
              <Pressable style={styles.discoverButton} onPress={() => setIsAccompanimentPanelOpen(true)}>
                <Text style={styles.discoverButtonIcon}>🎵</Text>
                <Text style={styles.discoverButtonLabel}>Découvrir un accompagnement</Text>
              </Pressable>
              <Pressable style={styles.discoverButton} onPress={() => setIsVoicingPanelOpen(true)}>
                <Text style={styles.discoverButtonIcon}>🎹</Text>
                <Text style={styles.discoverButtonLabel}>Découvrir le voicing</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* "Enregistrer" — voir handleSaveProgression pour le TODO sauvegarde
            réelle/anti-farming. */}
        {progression.length > 0 && (
          <>
            <Pressable style={styles.saveButton} onPress={handleSaveProgression}>
              <Text style={styles.saveButtonLabel}>Enregistrer</Text>
            </Pressable>
            {xpFeedback && <Text style={styles.xpFeedbackText}>{xpFeedback}</Text>}
          </>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={removeLast}>
            <Text style={styles.actionLabel}>Retirer le dernier</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={clearProgression}>
            <Text style={styles.actionLabel}>Effacer</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* En dehors du ScrollView (frères, pas enfants) pour se positionner en
          "absolute" par rapport à l'écran entier — voir le commentaire
          équivalent dans ResultScreen (improResult.tsx). */}
      <SlidePanel isOpen={isAccompanimentPanelOpen} onClose={() => setIsAccompanimentPanelOpen(false)}>
        <AccompanimentPanelContent isOpen={isAccompanimentPanelOpen} />
      </SlidePanel>
      <SlidePanel isOpen={isVoicingPanelOpen} onClose={() => setIsVoicingPanelOpen(false)}>
        <VoicingPanelContent isOpen={isVoicingPanelOpen} />
      </SlidePanel>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  scaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  scaleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  scaleButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  scaleLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  degreeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  degreeLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  chordLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  // Pas de token "bouton contour pleine largeur" dans le thème : composé à
  // partir des tokens existants, comme d'autres boutons ailleurs dans l'app.
  toggleCarouselButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  toggleCarouselButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.primary,
  },
  // Carte englobant le carrousel : même recette que les cartes ailleurs dans
  // l'app (HomeScreen.tsx/ProfileScreen.tsx/SocialScreen.tsx) — pas de token
  // "ombre de carte" dans le thème, déjà signalé là-bas.
  carouselCard: {
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
  carouselNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carouselArrowButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  carouselArrowButtonDisabled: {
    opacity: 0.35,
  },
  carouselArrowLabel: {
    fontSize: theme.text.size.xl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  carouselIndicator: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.textMuted,
  },
  discoverButtonsRow: {
    gap: theme.spacing.md,
  },
  // Même recette que "actionButton" de ResultScreen (contour primary), fond
  // "background" plutôt que "surface" ici : ce bouton est niché DANS
  // carouselCard (déjà en surface) — le fond background le détache
  // visuellement de sa carte parente au lieu de s'y fondre, même logique que
  // statTile/recapTile ailleurs dans l'app.
  discoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    width: '100%',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  discoverButtonIcon: {
    fontSize: theme.text.size.lg,
  },
  discoverButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  // Pas de token "texte sur fond coloré" dans le thème : blanc en dur ici,
  // comme déjà fait ailleurs dans l'app pour ce même besoin.
  saveButtonLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
  xpFeedbackText: {
    textAlign: 'center',
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.achievementUnlocked,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.textMuted,
  },
  actionLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.textMuted,
  },
});
