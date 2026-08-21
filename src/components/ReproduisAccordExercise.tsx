// Exercice "Reproduis l'accord" — BRIQUE AUTONOME, sans dépendance à React
// Navigation ni à un ParamList précis : prend la gamme (tonique + mode) en
// PROPS, "onQuit" pour rendre la main à l'appelant, RIEN d'autre de
// contextuel. Pensé pour être monté depuis PLUSIEURS endroits (un cours, un
// onglet de pratique...) sans rien connaître de qui l'appelle — ne navigue
// jamais lui-même (voir onQuit), ne suppose rien sur le conteneur qui
// l'héberge (pas de flex:1/fond plein écran ici : c'est à l'écran hôte de
// fournir ce cadre, voir ReproduisAccordScreen.tsx pour un exemple).
//
// DÉROULÉ (2 étapes, toutes deux internes à ce composant — voir modePiano) :
// 1. "As-tu ton piano à disposition ?" tant que modePiano est null.
// 2. Un accord DIATONIQUE de la gamme courante, tiré au hasard :
//    - modePiano 'app' : clavier virtuel (InteractivePiano) affiché ;
//      validé quand les 3 dernières notes tapées, prises comme un ENSEMBLE
//      (pas une séquence), correspondent aux 3 classes de notes de l'accord
//      cible — peu importe l'ordre ou l'octave (comparaison par chroma, voir
//      isChordMatch). Succès → feedback bref → accord suivant, "à ton
//      rythme" (aucun chrono).
//    - modePiano 'personnel' : pas de clavier, pas de validation (aucune
//      détection audio dans cette app — décision assumée) : juste l'accord
//      affiché et un bouton "Suivant" qui en tire un nouveau au hasard.
//
// DEUX RÉGLAGES, tous deux modifiables SANS quitter l'exercice, visibles à
// l'étape 2 (les deux modes) — voir leur JSX plus bas :
// - GAMME (selectedTonique/selectedMode) : initialisée depuis les props
//   tonique/mode (valeur de DÉPART, pas figée — voir leur commentaire),
//   modifiable ensuite via les mêmes Dropdown que ChoisirGammeContent.tsx
//   (importés, pas dupliqués). Détermine QUELS accords existent.
// - FILTRE QUALITÉ (filtreQualite) : restreint QUELS accords, PARMI ceux de
//   la gamme, peuvent être tirés (Tous/Majeurs/Mineurs/Diminués). Les 2 se
//   combinent (voir accordsFiltres) — axes indépendants l'un de l'autre.
//
// Aucun score/XP dans cette brique (prévu pour plus tard).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Note } from 'tonal';

import { theme } from '../theme';
import { InteractivePiano } from './InteractivePiano';
import { Dropdown, MODES, TONIQUES } from './ChoisirGammeContent';
import { genererAccordsDiatoniques, type AccordDiatoniqueGamme } from '../lib/harmonyAnalysis';

export type ReproduisAccordExerciseProps = {
  // Ex: "Ré", "Do#/Réb" — même format que TONIQUES dans
  // ChoisirGammeContent.tsx (voir FRENCH_TONIC_TO_PITCH_CLASS plus bas).
  tonique: string;
  // 'majeur' | 'mineur', tel quel — voir scaleNameForMode plus bas.
  mode: string;
  // Appelé au tap sur "Quitter" — c'est l'APPELANT qui décide ce que
  // "quitter" signifie (retour de pile, fermeture de modale...), jamais ce
  // composant : c'est précisément ce qui le rend indépendant de son
  // contexte d'appel.
  onQuit: () => void;
};

// Traduit le libellé FR de tonique (mêmes 12 valeurs EXACTES que TONIQUES
// dans ChoisirGammeContent.tsx) vers la classe de note que tonal attend.
// Dupliqué plutôt qu'importé : ce composant reste autonome, sans dépendance
// vers l'écran qui construit la gamme — même principe de petite duplication
// déjà suivi ailleurs dans l'app pour rester isolé (ex: harmonyAnalysis.ts
// duplique FRENCH_NOTE_LETTERS plutôt que d'importer toFrenchNoteName de
// chordUtils.ts).
const FRENCH_TONIC_TO_PITCH_CLASS: Record<string, string> = {
  Do: 'C',
  'Do#/Réb': 'C#',
  Ré: 'D',
  'Ré#/Mib': 'D#',
  Mi: 'E',
  Fa: 'F',
  'Fa#/Solb': 'F#',
  Sol: 'G',
  'Sol#/Lab': 'G#',
  La: 'A',
  'La#/Sib': 'A#',
  Si: 'B',
};

// Nombre de notes d'une triade — taille de la fenêtre glissante des
// dernières touches tapées (voir handleNotePlayed).
const NOMBRE_NOTES_TRIADE = 3;

// Pause avant de passer à l'accord suivant après un succès — assez longue
// pour lire le feedback, assez courte pour ne pas casser le rythme ("à ton
// rythme" ne veut pas dire "avec des pauses interminables").
const DELAI_FEEDBACK_SUCCES_MS = 900;

// AXE 2 — filtre par qualité (voir le commentaire en haut de fichier).
// "toutes" : aucun filtre, tous les accords de la gamme sont tirables.
// PAS d'option "augmentés" : une gamme majeure ou mineure naturelle
// diatonique n'en produit jamais (voir genererAccordsDiatoniques/
// triadSuffixFromNotes dans harmonyAnalysis.ts) — inutile de proposer un
// filtre qui donnerait systématiquement 0 résultat.
type FiltreQualite = 'toutes' | 'majeurs' | 'mineurs' | 'diminues';

const FILTRE_QUALITE_OPTIONS: { value: FiltreQualite; label: string }[] = [
  { value: 'toutes', label: 'Tous' },
  { value: 'majeurs', label: 'Majeurs' },
  { value: 'mineurs', label: 'Mineurs' },
  { value: 'diminues', label: 'Diminués' },
];

// Correspondance filtre → qualité tonal attendue (AccordDiatoniqueGamme.
// qualite, voir harmonyAnalysis.ts) — "toutes" n'y figure pas, géré à part
// dans accordsFiltres (aucune comparaison à faire, tout passe).
const QUALITE_ATTENDUE_PAR_FILTRE: Record<Exclude<FiltreQualite, 'toutes'>, AccordDiatoniqueGamme['qualite']> = {
  majeurs: 'Major',
  mineurs: 'Minor',
  diminues: 'Diminished',
};

// Choisit un index au hasard parmi [0, length), en évitant de retomber sur
// "excludeIndex" (l'accord actuel) quand c'est possible — évite le même
// accord 2 fois d'affilée, sans boucle de tirage (juste un décalage d'un cran
// si le tirage retombe sur l'exclu).
function pickRandomIndex(length: number, excludeIndex?: number): number {
  if (length <= 1) return 0;
  const index = Math.floor(Math.random() * length);
  return index === excludeIndex ? (index + 1) % length : index;
}

// Compare les DERNIÈRES notes tapées (avec octave, ex: "D4") aux classes de
// notes attendues (sans octave, ex: "D") — par CHROMA (0-11), donc
// indépendant de l'octave ET de l'ordre de jeu : exactement la même
// technique que harmonyAnalysis.ts (Note.chroma) pour un problème
// équivalent (comparer des notes sans se soucier de leur orthographe/octave).
function isChordMatch(tappedNotes: string[], targetNoteClasses: readonly string[]): boolean {
  if (tappedNotes.length < targetNoteClasses.length) return false;

  const tappedChroma = new Set(tappedNotes.map((note) => Note.chroma(note)));
  const targetChroma = new Set(targetNoteClasses.map((note) => Note.chroma(note)));

  if (tappedChroma.size !== targetChroma.size) return false;
  for (const chroma of targetChroma) {
    if (!tappedChroma.has(chroma)) return false;
  }
  return true;
}

export function ReproduisAccordExercise({ tonique, mode, onQuit }: ReproduisAccordExerciseProps) {
  // null = étape 1 ("As-tu ton piano ?") pas encore répondue — voir le
  // rendu plus bas, qui bascule sur cette seule valeur.
  const [modePiano, setModePiano] = useState<'app' | 'personnel' | null>(null);

  // AXE 1 (gamme) — "tonique"/"mode" (props) ne servent plus qu'à
  // initialiser cet état interne : l'exercice reste autonome (il reçoit une
  // gamme de DÉPART), mais peut ensuite la changer lui-même sans jamais
  // redemander à l'appelant (voir le contrôle "Gamme" dans le JSX plus bas).
  const [selectedTonique, setSelectedTonique] = useState(tonique);
  const [selectedMode, setSelectedMode] = useState(mode);
  // État d'ouverture des 2 Dropdown (Tonique/Mode) réutilisés de
  // ChoisirGammeContent.tsx — propre à CET affichage, indépendant de tout
  // état équivalent qui pourrait exister côté modale d'origine.
  const [isToniqueOuverte, setIsToniqueOuverte] = useState(false);
  const [isModeOuvert, setIsModeOuvert] = useState(false);

  // AXE 2 (filtre qualité) — indépendant de l'axe 1, voir le commentaire en
  // haut de fichier.
  const [filtreQualite, setFiltreQualite] = useState<FiltreQualite>('toutes');

  // Recalculé seulement si selectedTonique/selectedMode changent — useMemo
  // évite de refaire l'appel tonal à chaque re-render (ex: à chaque tap sur
  // le clavier).
  const accordsDeLaGamme = useMemo(() => {
    const pitchClass = FRENCH_TONIC_TO_PITCH_CLASS[selectedTonique] ?? 'C';
    const scaleName = selectedMode === 'mineur' ? 'minor' : 'major';
    return genererAccordsDiatoniques(`${pitchClass} ${scaleName}`);
  }, [selectedTonique, selectedMode]);

  // Applique l'AXE 2 par-dessus l'AXE 1 — les 2 se combinent naturellement
  // en filtrant simplement la liste déjà réduite à LA gamme choisie (voir
  // le commentaire en haut de fichier : "Ré majeur + Mineurs" ne garde donc
  // QUE Mi min/Fa# min/Si min, exactement les 3 accords mineurs DE Ré
  // majeur, jamais un accord mineur d'une autre gamme).
  const accordsFiltres = useMemo(() => {
    if (filtreQualite === 'toutes') return accordsDeLaGamme;
    const qualiteAttendue = QUALITE_ATTENDUE_PAR_FILTRE[filtreQualite];
    return accordsDeLaGamme.filter((accord) => accord.qualite === qualiteAttendue);
  }, [accordsDeLaGamme, filtreQualite]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [recentTaps, setRecentTaps] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  // Identifiant du minuteur de pause post-succès, pour l'annuler si le
  // composant est démonté avant qu'il se déclenche — même principe que
  // activeKeyTimeoutRef dans InteractivePiano.tsx.
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // Régénère un accord aléatoire dès que la liste FILTRÉE change — que ce
  // soit un changement de gamme (AXE 1) ou de filtre (AXE 2), voir le
  // commentaire en haut de fichier. Tourne aussi au tout premier montage
  // (choix de l'accord de départ), remplaçant l'ancien initialiseur
  // paresseux de currentIndex — un seul endroit responsable du tirage,
  // plutôt que 2 mécanismes séparés à garder synchronisés. Annule aussi un
  // éventuel succès/minuteur en attente : changer de réglages EN PLEIN
  // feedback de succès ne doit pas laisser un ancien minuteur retomber sur
  // un index invalide pour la NOUVELLE liste.
  useEffect(() => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setIsSuccess(false);
    setCurrentIndex(pickRandomIndex(accordsFiltres.length));
    setRecentTaps([]);
  }, [accordsFiltres]);

  const currentAccord = accordsFiltres[currentIndex] ?? null;

  const goToNextAccord = () => {
    setCurrentIndex((previous) => pickRandomIndex(accordsFiltres.length, previous));
    setRecentTaps([]);
  };

  // Appelé par InteractivePiano à CHAQUE tap (voir sa prop onNotePlayed).
  // Ignoré pendant l'affichage du feedback de succès (isSuccess) : évite
  // qu'un tap pendant la pause ne redéclenche quoi que ce soit avant que
  // l'accord suivant soit en place.
  const handleNotePlayed = (noteWithOctave: string) => {
    if (!currentAccord || isSuccess) return;

    const updatedTaps = [...recentTaps, noteWithOctave].slice(-NOMBRE_NOTES_TRIADE);
    setRecentTaps(updatedTaps);

    if (isChordMatch(updatedTaps, currentAccord.classesDeNotes)) {
      setIsSuccess(true);
      successTimeoutRef.current = setTimeout(() => {
        setIsSuccess(false);
        goToNextAccord();
      }, DELAI_FEEDBACK_SUCCES_MS);
    }
  };

  // Étape 1 : question préalable, tant que modePiano n'est pas choisi.
  if (modePiano === null) {
    return (
      <View style={styles.wrapper}>
        <Pressable style={styles.quitButton} onPress={onQuit}>
          <Text style={styles.quitButtonLabel}>← Quitter</Text>
        </Pressable>

        <Text style={theme.text.title}>As-tu ton piano à disposition ?</Text>
        <Text style={styles.subtitle}>Ça change la façon dont l'exercice se déroule.</Text>

        <Pressable style={styles.choiceButton} onPress={() => setModePiano('personnel')}>
          <Text style={styles.choiceButtonLabel}>Oui, j'ai mon piano</Text>
        </Pressable>
        <Pressable style={styles.choiceButton} onPress={() => setModePiano('app')}>
          <Text style={styles.choiceButtonLabel}>Non, utiliser le piano de l'app</Text>
        </Pressable>
      </View>
    );
  }

  if (accordsDeLaGamme.length === 0) {
    // Filet théorique (voir genererAccordsDiatoniques) : ne devrait pas
    // arriver en pratique, selectedTonique/selectedMode viennent d'une
    // liste fermée (TONIQUES/MODES). Distinct du cas "filtre trop
    // restrictif" plus bas : ICI, la gamme elle-même n'a produit AUCUN
    // accord — les contrôles n'aideraient donc à rien, inutile de les
    // afficher.
    return (
      <View style={styles.wrapper}>
        <Pressable style={styles.quitButton} onPress={onQuit}>
          <Text style={styles.quitButtonLabel}>← Quitter</Text>
        </Pressable>
        <Text style={theme.text.subtitle}>Impossible de générer les accords de cette gamme.</Text>
      </View>
    );
  }

  // Étape 2 : l'exercice lui-même. Les contrôles Gamme/Filtre sont TOUJOURS
  // affichés ici (avant même de savoir si currentAccord existe) : c'est
  // justement ce qui permet à l'utilisateur de sortir du cas "aucun accord
  // de ce type" plus bas, en changeant l'un ou l'autre réglage.
  return (
    <View style={styles.wrapper}>
      <Pressable style={styles.quitButton} onPress={onQuit}>
        <Text style={styles.quitButtonLabel}>← Quitter</Text>
      </Pressable>

      <View style={styles.controlsBlock}>
        <Text style={styles.controlsSectionLabel}>Gamme</Text>
        <View style={styles.gammeRow}>
          <View style={styles.gammeDropdown}>
            <Dropdown
              label="Tonique"
              placeholder="Ex : Do"
              options={TONIQUES}
              value={selectedTonique}
              isExpanded={isToniqueOuverte}
              onToggle={() => {
                setIsToniqueOuverte((ouverte) => !ouverte);
                setIsModeOuvert(false);
              }}
              onSelect={(value) => {
                setSelectedTonique(value);
                setIsToniqueOuverte(false);
              }}
            />
          </View>
          <View style={styles.gammeDropdown}>
            <Dropdown
              label="Mode"
              placeholder="Choisis un mode"
              options={MODES}
              value={selectedMode}
              isExpanded={isModeOuvert}
              onToggle={() => {
                setIsModeOuvert((ouvert) => !ouvert);
                setIsToniqueOuverte(false);
              }}
              onSelect={(value) => {
                setSelectedMode(value);
                setIsModeOuvert(false);
              }}
            />
          </View>
        </View>

        <Text style={styles.controlsSectionLabel}>Filtrer par qualité</Text>
        <View style={styles.filtreRow}>
          {FILTRE_QUALITE_OPTIONS.map((option) => {
            const isSelected = option.value === filtreQualite;
            return (
              <Pressable
                key={option.value}
                style={[styles.filtreChip, isSelected && styles.filtreChipSelected]}
                onPress={() => setFiltreQualite(option.value)}
              >
                <Text style={[styles.filtreChipLabel, isSelected && styles.filtreChipLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {currentAccord ? (
        <>
          <View style={styles.chordBlock}>
            <Text style={styles.chordLabel}>{currentAccord.qualiteEnClair}</Text>
          </View>

          {modePiano === 'app' ? (
            <>
              <InteractivePiano onNotePlayed={handleNotePlayed} />
              <Text style={styles.feedbackText}>
                {isSuccess ? '✅ Bravo !' : 'Joue les 3 notes de l’accord, dans n’importe quel ordre.'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.instructionText}>
                Joue cet accord sur ton piano, à ton rythme, puis passe au suivant.
              </Text>
              <Pressable style={styles.nextButton} onPress={goToNextAccord}>
                <Text style={styles.nextButtonLabel}>Suivant</Text>
              </Pressable>
            </>
          )}
        </>
      ) : (
        // Cas limite explicite (voir le commentaire en haut de fichier) : la
        // GAMME a bien des accords (accordsDeLaGamme non vide), mais le
        // FILTRE actuel n'en garde aucun — les contrôles ci-dessus restent
        // visibles pour permettre de changer de filtre ou de gamme.
        <Text style={styles.subtitle}>Aucun accord de ce type dans cette gamme.</Text>
      )}
    </View>
  );
}

// PAS de flex:1/backgroundColor ici (contrairement à un écran) : ce
// composant ne possède pas tout l'écran, l'appelant fournit son propre
// conteneur (voir le commentaire en haut de fichier).
const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  quitButton: {
    alignSelf: 'flex-start',
  },
  quitButtonLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
  },
  subtitle: {
    fontSize: theme.text.size.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  choiceButton: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
  },
  choiceButtonLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
  // Bloc des 2 réglages (gamme + filtre qualité) — fond "surface" pour bien
  // le distinguer du reste, même famille visuelle que chordBlock plus bas.
  controlsBlock: {
    width: '100%',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
  },
  // Même recette que sectionLabel de HarmonyTestScreen.tsx/dropdownLabel de
  // ChoisirGammeContent.tsx (caption discrète au-dessus d'un contrôle) —
  // cohérence entre tous les écrans de sélection de l'app.
  controlsSectionLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  gammeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  gammeDropdown: {
    flex: 1,
  },
  filtreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  // Même recette que tonaliteChip/tonaliteChipSelected de
  // HarmonyTestScreen.tsx : contour + fond surface au repos, fond primary
  // uni une fois sélectionné.
  filtreChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filtreChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filtreChipLabel: {
    fontSize: theme.text.size.sm,
    color: theme.colors.text,
  },
  filtreChipLabelSelected: {
    fontWeight: theme.text.weight.semibold,
  },
  chordBlock: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.xl,
  },
  chordLabel: {
    fontSize: theme.text.size.xxl,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.text,
  },
  feedbackText: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.medium,
    color: theme.colors.text,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: theme.text.size.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  nextButton: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
  },
  nextButtonLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
});
