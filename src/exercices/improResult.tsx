import { useEffect, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import { PianoChord } from '../components/PianoChord';
import {
  bassAndClusterVoicing,
  buildExtendedChord,
  buildSecondaryDominantOfV,
  dropTwoVoicing,
  SECONDARY_DOMINANT_OF_V_DEGREE,
  toFlatPreferredSpelling,
  toFrenchNoteName,
  type ExtensionLevel,
  type ScaleChoice,
} from '../dataset/chordUtils';
import { ACCOMPANIMENTS, resolveStepNotes, type TriadNotes } from '../dataset/accompaniments';
import { PROGRESSIONS } from '../dataset/progression';
import type { ExercisesStackParamList } from '../navigation/ExercisesStack';
// improEmotion.tsx a été supprimé (fusionné avec l'ancien improStyle.tsx dans
// improChoices.tsx, la nouvelle page unique émotion+style) : MOODS vit
// désormais là.
import { MOODS } from './improChoices';

// Les 2 modes choisissables dans le panneau "Tonalité" (voir TonalityModal) :
// "value" est directement le ScaleChoice attendu par degreeToChord/
// buildExtendedChord, "label" le texte du bouton.
const MODE_OPTIONS: { value: ScaleChoice; label: string }[] = [
  { value: 'majeur', label: 'Majeur' },
  { value: 'mineur', label: 'Mineur' },
];

// Les 12 toniques choisissables (grille du panneau "Tonalité"), dans l'ordre
// chromatique en partant de Do. "value" reste TOUJOURS orthographié en dièse
// (ex: "C#") : c'est la convention déjà utilisée partout ailleurs dans l'app
// pour les touches noires (voir BLACK_KEY_PATTERN dans PianoChord.tsx), et
// c'est ce qui est réellement transmis à degreeToChord/buildExtendedChord.
// "label" (affiché sur le bouton) montre les 2 orthographes pour les 5
// touches noires (ex: "C♯/D♭"), sa version bémol calculée avec
// toFlatPreferredSpelling (Tonal) plutôt que tapée à la main.
const TONIC_OPTIONS: { value: string; label: string }[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
].map((value) => {
  if (!value.includes('#')) {
    return { value, label: value };
  }
  const sharpLabel = value.replace('#', '♯');
  const flatLabel = toFlatPreferredSpelling(value).replace('b', '♭');
  return { value, label: `${sharpLabel}/${flatLabel}` };
});

// Niveaux d'enrichissement proposés, en escalier : chaque niveau ajoute sa
// note au précédent (9 implique 7, qui implique la triade). L'ORDRE de ce
// tableau est aussi l'ordre d'affichage des boutons du sélecteur.
const ENRICHMENT_LEVELS: { label: string; value: ExtensionLevel }[] = [
  { label: 'Triade', value: 0 },
  { label: '7e', value: 7 },
  { label: '9e', value: 9 },
  { label: '11e', value: 11 },
  { label: '13e', value: 13 },
];

type ImproResultRoute = RouteProp<ExercisesStackParamList, 'ImproResult'>;

// Identifie UN degré précis affiché à l'écran : sa progression (son index
// dans filteredProgressions) et sa position dans cette progression (son
// index dans "degrees"). Nécessaire car plusieurs progressions peuvent être
// affichées pour la même émotion (ex: "happy" en a 2) : un simple index de
// degré ne suffirait pas à identifier lequel, sur laquelle, est visé.
type ChordPosition = {
  progressionIndex: number;
  chordIndex: number;
};

function samePosition(a: ChordPosition | null, b: ChordPosition): boolean {
  return a !== null && a.progressionIndex === b.progressionIndex && a.chordIndex === b.chordIndex;
}

// Clé texte dérivée d'une position, utilisée pour indexer l'état
// d'enrichissement (voir enrichmentLevels dans le composant).
function chordKey(position: ChordPosition): string {
  return `${position.progressionIndex}-${position.chordIndex}`;
}

// Insère SECONDARY_DOMINANT_OF_V_DEGREE ("V/V") juste avant le PREMIER "V"
// des degrés reçus, si isVOfVAdded est actif ET que ces degrés contiennent
// bien un V — sinon renvoie les degrés INCHANGÉS (aucune erreur si la
// progression n'a pas de V, elle reste simplement telle quelle).
//
// RÈGLE si plusieurs "V" existent dans la même progression : indexOf
// s'arrête au premier trouvé, donc seul CE premier V reçoit son V/V juste
// avant — choix simple et prévisible plutôt que d'en insérer un devant
// chaque occurrence (périmètre strict : "insère devant le premier").
function withSecondaryDominantOfV(degrees: string[], isVOfVAdded: boolean): string[] {
  if (!isVOfVAdded) return degrees;

  const vIndex = degrees.indexOf('V');
  if (vIndex === -1) return degrees;

  const degreesWithSecondaryDominant = [...degrees];
  degreesWithSecondaryDominant.splice(vIndex, 0, SECONDARY_DOMINANT_OF_V_DEGREE);
  return degreesWithSecondaryDominant;
}

// Panneau "déplié" d'UN accord : son nom concret, son piano (avec
// renversements ET débordement clavier déjà gérés par PianoChord) et le
// sélecteur de niveau d'enrichissement (triade/7/9/11/13) qui s'applique à
// CET accord précis. Isolé dans son propre composant pour calculer
// chordName/chordNotes avec de vraies déclarations plutôt que dans une
// expression JSX (un ternaire ne permet pas de "const").
type ExpandedChordPanelProps = {
  degree: string;
  scale: ScaleChoice;
  // Tonique de référence (ex: "C", "F#"), choisie via le panneau "Tonalité"
  // de ResultScreen (voir son state tonic/mode) — remplace l'ancienne
  // constante fixe TONIC : recevoir tonic/scale en props, plutôt qu'une
  // valeur fixe, permet à ResultScreen de recalculer TOUT accord affiché
  // (n'importe quel degré, n'importe quel niveau d'enrichissement) dès que
  // l'utilisateur change la tonique ou le mode dans ce panneau.
  tonic: string;
  level: ExtensionLevel;
  onSelectLevel: (level: ExtensionLevel) => void;
};

function ExpandedChordPanel({ degree, scale, tonic, level, onSelectLevel }: ExpandedChordPanelProps) {
  // STATE DU VOICING : vue alternative de CET accord — false = position
  // théorique (empilée en tierces, l'affichage historique), true = voicing
  // "basse + accord groupé" (voir bassAndClusterVoicing). Local à ce
  // panneau, pas remonté au parent : ResultScreen pose un "key" sur
  // <ExpandedChordPanel> (voir plus bas) pour que ce state reparte à false
  // à chaque nouvel accord sélectionné, plutôt que de rester collé à
  // l'ancien choix en changeant simplement d'accord.
  const [voicingMode, setVoicingMode] = useState(false);

  // La dominante secondaire du V (voir SECONDARY_DOMINANT_OF_V_DEGREE,
  // insérée dans la progression par le bouton "Enrichir la progression" de
  // ResultScreen) n'est PAS un vrai chiffre romain diatonique : elle
  // n'existe pas dans ROMAN_TO_INDEX, donc buildExtendedChord ne peut pas la
  // résoudre. On la détecte ici et on bascule sur buildSecondaryDominantOfV
  // (voir son commentaire dans chordUtils.ts pour le calcul) à la place.
  const isSecondaryDominant = degree === SECONDARY_DOMINANT_OF_V_DEGREE;

  // Nom, notes fondamentales (empilées) et éventuelle altération idiomatique
  // pour le niveau choisi — voir buildExtendedChord dans chordUtils.ts pour
  // le calcul des extensions diatoniques ET la lecture/application des
  // règles d'altération (ex: ♯11 sur un accord majeur, voir
  // alterationRules.ts pour le format d'une règle). Le NOM ne change pas
  // avec le voicing : c'est le même accord, seule sa disposition sur le
  // clavier change.
  const { chordName, notes: stackedNotes, appliedRule, alteredChroma } = isSecondaryDominant
    ? buildSecondaryDominantOfV(scale, tonic, 3)
    : buildExtendedChord(degree, scale, tonic, level, 3);

  // RENDU CONDITIONNEL DU PIANO ne s'applique pas qu'à cet écran : ici,
  // c'est la DISPOSITION du piano qui est conditionnelle. En voicing, on
  // réutilise EXACTEMENT les mêmes notes (aucune omise ni ajoutée, périmètre
  // strict) : bassAndClusterVoicing ne fait que les réorganiser grave/aigu.
  const chordNotes = voicingMode ? bassAndClusterVoicing(stackedNotes) : stackedNotes;

  // APPLICATION DE LA RÈGLE D'ALTÉRATION, côté affichage : buildExtendedChord
  // a déjà remplacé la note diatonique brute par sa version altérée dans
  // "chordNotes" (la bonne touche s'allume donc automatiquement, aucun
  // travail supplémentaire ici) — il ne reste qu'à dire à PianoChord
  // d'afficher le libellé "♯11" (plutôt que le calcul générique) sur CETTE
  // note précise, retrouvée par son chroma (alteredChroma, voir son
  // commentaire dans ExtendedChordResult) puisque le voicing peut avoir
  // changé son octave/sa position dans le tableau.
  const functionLabelOverrides =
    appliedRule && alteredChroma !== null
      ? new Map([[alteredChroma, appliedRule.alteredLabel]])
      : undefined;

  return (
    <View style={styles.expandedPanel}>
      <Text style={styles.expandedLabel}>{degree} · {chordName}</Text>
      {/* "key" force PianoChord à repartir de zéro (renversement à 0) quand
          le voicing change : sans ça, un renversement déjà en cours sur la
          position théorique s'appliquerait par-dessus les notes du voicing
          fraîchement reçues, ce qui n'a pas de sens (voir aussi le
          verrouillage des renversements dans PianoChord pour un voicing). */}
      {/* showArpeggioButton={false} : l'accompagnement (arpège) se découvre
          désormais uniquement via la modale "Découvrir un accompagnement"
          (voir AccompanimentModal plus bas) — ce panneau garde ses
          contrôles de renversement (showInversionControls par défaut,
          inchangé) mais n'affiche plus son propre bouton d'arpège. */}
      <PianoChord
        key={voicingMode ? 'voicing' : 'theoretical'}
        notes={chordNotes}
        functionLabelOverrides={functionLabelOverrides}
        showArpeggioButton={false}
      />

      {/* Explication de la règle d'altération active, affichée SOUS le
          clavier, seulement quand une altération est réellement appliquée
          (rien à expliquer sinon). */}
      {appliedRule && (
        <View style={styles.alterationExplanation}>
          <Text style={styles.alterationExplanationText}>{appliedRule.explanation}</Text>
        </View>
      )}

      {/* TODO: son / extrait à ajouter plus tard */}

      {/* Pas de sélecteur de niveau pour la dominante secondaire : elle est
          TOUJOURS une 7e de dominante, ce n'est pas un choix (voir le
          commentaire sur isSecondaryDominant plus haut) — les extensions
          diatoniques 9e/11e/13e n'ont de toute façon pas de sens pour un
          accord emprunté, hors de la gamme de la tonalité de référence. */}
      {!isSecondaryDominant && (
        <View style={styles.levelRow}>
          {ENRICHMENT_LEVELS.map((item) => {
            const isActive = item.value === level;
            return (
              <Pressable
                key={item.value}
                style={[styles.levelButton, isActive && styles.levelButtonSelected]}
                onPress={() => onSelectLevel(item.value)}
              >
                <Text style={styles.levelButtonLabel}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Bouton Voicing : à la fois le déclencheur ("Voicing") et le retour
          à la position théorique (son libellé et son état "actif" reflètent
          le mode courant). */}
      <Pressable
        style={[styles.voicingButton, voicingMode && styles.voicingButtonSelected]}
        onPress={() => setVoicingMode((current) => !current)}
      >
        <Text style={styles.voicingButtonLabel}>
          {voicingMode ? 'Position théorique' : 'Voicing'}
        </Text>
      </Pressable>
    </View>
  );
}

// Triade d'exemple FIXE utilisée pour illustrer accompagnement/voicing dans
// les modales ci-dessous : Do majeur, indépendante de l'accord actuellement
// sélectionné à l'écran. Volontairement fixe : le but de ces modales est
// d'enseigner un PRINCIPE transposable par l'utilisateur lui-même à
// n'importe quel accord, pas d'illustrer l'accord en cours. Sous forme
// {root, third, fifth} (pas juste un tableau de notes) pour pouvoir résoudre
// les fonctions ('root'/'third'/'fifth'/'root_octave') d'un accompagnement
// de la table (voir resolveStepNotes, ../dataset/accompaniments.ts).
const EXAMPLE_TRIAD: TriadNotes = { root: 'C3', third: 'E3', fifth: 'G3' };

// Définition GÉNÉRALE du voicing, affichée en haut de VoicingModal quel que
// soit le voicing sélectionné (voir VOICING_OPTIONS plus bas pour
// l'explication SPÉCIFIQUE à chacun).
const VOICING_EXPLANATION =
  "Un voicing, c'est une façon de répartir les notes d'un accord sur le clavier — leur ordre et leur répartition entre les octaves, sans jamais changer les notes elles-mêmes. Le même accord peut ainsi sonner plus serré ou plus ouvert, plus grave ou plus équilibré entre les deux mains.";

// Accord d'exemple FIXE de VoicingModal : Cmaj7 empilé (Do-Mi-Sol-Si), à
// l'état fondamental. Les 3 voicings de VOICING_OPTIONS ci-dessous en sont
// tous dérivés (via dropTwoVoicing/bassAndClusterVoicing, ../dataset/
// chordUtils.ts) plutôt que d'avoir chacun leurs notes tapées à la main :
// une seule source de vérité pour "quel est l'accord de base".
const EXAMPLE_CMAJ7_NOTES = ['C3', 'E3', 'G3', 'B3'];

type VoicingOption = {
  id: string;
  label: string;
  // Explication SPÉCIFIQUE à ce voicing (en plus de la définition générale
  // ci-dessus) : ce que CE voicing précis fait à l'accord, en des termes
  // transposables à n'importe quel accord (jamais "Cmaj7" ou "Do" en dur).
  explanation: string;
  notes: string[];
};

// Les 3 voicings proposés dans VoicingModal. Choisis manuellement via des
// boutons (voir VoicingModal) plutôt qu'animés automatiquement : chaque
// voicing est une DISPOSITION différente du MÊME accord fixe
// (EXAMPLE_CMAJ7_NOTES), jamais un accord différent.
const VOICING_OPTIONS: VoicingOption[] = [
  {
    id: 'closed',
    label: 'Position fermée',
    explanation:
      "Les notes de l'accord sont empilées et rapprochées, dans le même registre : la position de référence, la plus simple, souvent le point de départ avant d'ouvrir l'accord avec un autre voicing.",
    notes: EXAMPLE_CMAJ7_NOTES,
  },
  {
    id: 'drop2',
    label: 'Drop 2',
    explanation:
      "On part de la position fermée et on descend la 2e note en partant du haut d'une octave, sans changer aucune autre note. L'accord s'ouvre : le son devient plus large et plus équilibré — un voicing très utilisé au piano et à la guitare jazz.",
    notes: dropTwoVoicing(EXAMPLE_CMAJ7_NOTES),
  },
  {
    id: 'bass-cluster',
    label: 'Basse + accord',
    explanation:
      "La fondamentale reste seule dans le grave (main gauche), et le reste de l'accord est regroupé plus haut (main droite). Même accord, mais réparti entre les 2 mains — idéal pour un accompagnement clair et confortable à jouer.",
    notes: bassAndClusterVoicing(EXAMPLE_CMAJ7_NOTES),
  },
];

type AccompanimentModalProps = {
  onClose: () => void;
};

// Modale "Découvrir un accompagnement" : montre le PRINCIPE de PLUSIEURS
// accompagnements (voir ACCOMPANIMENTS, ../dataset/accompaniments.ts) sur un
// accord d'exemple fixe, indépendamment de l'accord sélectionné ailleurs sur
// l'écran. Navigation par ONGLETS (un par accompagnement de la table) :
// compact, et montre d'un coup d'œil combien d'accompagnements existent —
// plus adapté ici que des flèches < > (qui ne montrent qu'un voisin à la
// fois) pour une table appelée à grandir.
//
// USAGE DE Modal (react-native) : "transparent" laisse voir le fond assombri
// (styles.modalBackdrop) derrière la carte plutôt qu'un fond opaque plein
// écran ; "animationType='fade'" pour une apparition douce ; "onRequestClose"
// est OBLIGATOIRE sur Android (bouton matériel/geste retour) — sans lui,
// Android planterait ou ignorerait ce bouton ; on lui donne le même
// gestionnaire que la fermeture normale.
//
// Fermeture en tapant HORS de la carte : le fond (modalBackdrop) est lui-même
// un Pressable plein écran avec onPress={onClose}, et la carte au centre est
// un SECOND Pressable avec un onPress vide — un tap sur la carte est ainsi
// "consommé" par ce second Pressable et ne déclenche jamais le onPress du
// fond en dessous (les Pressable de React Native ne laissent pas un tap
// traverser vers un Pressable parent une fois qu'un Pressable enfant l'a
// géré), donc taper DANS la carte ne ferme pas la modale, seulement en dehors.
//
// NETTOYAGE DES TIMERS (IMPORTANT) : ce composant n'est monté QUE lorsque
// isAccompanimentModalOpen est vrai côté ResultScreen (voir
// `{isAccompanimentModalOpen && <AccompanimentModal .../>}`), plutôt que
// d'être toujours monté avec seulement la prop "visible" du Modal basculée.
// Ce choix est déterminant pour le nettoyage : le composant Modal de React
// Native garde son contenu MONTÉ en React même quand sa prop "visible" est
// fausse (seule sa présentation NATIVE change) — si on se contentait de ça,
// le séquenceur ci-dessous resterait monté et continuerait de tourner EN
// ARRIÈRE-PLAN une fois la modale "fermée", sans jamais être nettoyé. En
// démontant réellement toute la modale à la fermeture, le useEffect de
// nettoyage du séquenceur (clearTimeout, voir plus bas) s'exécute
// automatiquement — exactement comme au démontage de l'écran.
function AccompanimentModal({ onClose }: AccompanimentModalProps) {
  // Onglet actif : un INDEX dans ACCOMPANIMENTS plutôt qu'un id — plus
  // simple ici puisque cette table est un tableau fixe local, pas besoin
  // d'une recherche par id. 0 = "Arpège montant", le même accompagnement
  // qu'avant l'ajout des onglets.
  const [selectedAccompanimentIndex, setSelectedAccompanimentIndex] = useState(0);

  // Pas actuellement affiché DE L'ACCOMPAGNEMENT SÉLECTIONNÉ, piloté par le
  // séquenceur ci-dessous.
  const [stepIndex, setStepIndex] = useState(0);

  // SÉQUENCEUR : généralise le principe déjà utilisé par l'arpège de
  // PianoChord (des setTimeout ENCHAÎNÉS, chaque pas programmant lui-même le
  // suivant) pour lire N'IMPORTE QUELLE séquence de la table, avec la durée
  // PROPRE À CHAQUE PAS (steps[i].durationMs) plutôt qu'une durée fixe.
  //
  // Dépend de selectedAccompanimentIndex (pas de l'objet accompaniment
  // lui-même) : ACCOMPANIMENTS est un tableau CONSTANT au niveau module,
  // jamais recréé, donc ACCOMPANIMENTS[i] reste la MÊME référence tant que i
  // ne change pas — un simple index suffit ici comme dépendance stable
  // (contrairement à l'arpège de PianoChord, qui doit dériver une clé texte
  // à partir d'un tableau de notes recalculé, lui, à chaque rendu de
  // l'appelant).
  //
  // CHANGER D'ACCOMPAGNEMENT (donc changer selectedAccompanimentIndex)
  // redéclenche cet effet : React exécute D'ABORD la fonction de nettoyage
  // de l'exécution PRÉCÉDENTE (clearTimeout du timer en attente de l'ANCIEN
  // accompagnement) AVANT de lancer ce nouveau corps d'effet — l'animation
  // en cours s'arrête donc TOUJOURS avant que la nouvelle ne démarre, jamais
  // les deux à la fois.
  useEffect(() => {
    const accompaniment = ACCOMPANIMENTS[selectedAccompanimentIndex];
    let currentStepIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    // Rend le pas "index" actif. C'est ICI qu'il faudra déclencher le son de
    // ce pas plus tard (accompaniment.steps[index].functions donne les
    // notes à jouer).
    const activateStep = (index: number) => {
      setStepIndex(index);
      // TODO: son du pas courant
    };

    const scheduleNextStep = () => {
      timeoutId = setTimeout(() => {
        currentStepIndex = (currentStepIndex + 1) % accompaniment.steps.length;
        activateStep(currentStepIndex);
        scheduleNextStep();
      }, accompaniment.steps[currentStepIndex].durationMs);
    };

    activateStep(0);
    scheduleNextStep();

    // NETTOYAGE : React appelle cette fonction AUTOMATIQUEMENT avant toute
    // ré-exécution de cet effet (donc à chaque changement d'accompagnement,
    // voir ci-dessus) ET au démontage du composant (fermeture de la modale).
    // clearTimeout annule le SEUL timer en attente à cet instant (timeoutId
    // est réassigné à chaque pas par scheduleNextStep, donc toujours le bon,
    // quel que soit le pas en cours à ce moment-là) : aucune fuite de timer
    // possible, quelle que soit la façon dont la modale se ferme ou dont
    // l'accompagnement change.
    return () => clearTimeout(timeoutId);
  }, [selectedAccompanimentIndex]);

  const selectedAccompaniment = ACCOMPANIMENTS[selectedAccompanimentIndex];

  // "?? steps[0]" : garde-fou pour l'unique rendu TRANSITOIRE où
  // selectedAccompanimentIndex vient de changer mais où l'effet ci-dessus
  // (qui remet stepIndex à 0 via activateStep) n'a pas encore pu s'exécuter
  // — les mises à jour de state ne s'appliquent qu'au rendu SUIVANT, jamais
  // pendant celui qui les déclenche. Sans ce garde-fou, un stepIndex hérité
  // de l'ancien accompagnement pourrait dépasser la longueur du nouveau (ex:
  // passer d'un accompagnement à 4 pas, arrêté sur le pas 3, à un
  // accompagnement à 3 pas) et planter sur un accès hors tableau.
  const currentStep = selectedAccompaniment.steps[stepIndex] ?? selectedAccompaniment.steps[0];
  const activeNotes = resolveStepNotes(currentStep, EXAMPLE_TRIAD);

  // "visible" est toujours vrai ici : ce composant n'est monté QUE quand la
  // modale doit être affichée (voir son commentaire ci-dessus et son
  // utilisation dans ResultScreen) — pas besoin de le faire remonter en
  // prop, la présence même du composant dans l'arbre EST le signal de
  // visibilité.
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Pressable style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonLabel}>✕</Text>
          </Pressable>

          {/* Onglets : un bouton par accompagnement de la table — ajouter un
              accompagnement à ACCOMPANIMENTS lui donne automatiquement un
              onglet ici, sans autre changement de code. flexWrap pour rester
              compact même si la table grandit encore. */}
          <View style={styles.accompanimentTabsRow}>
            {ACCOMPANIMENTS.map((accompaniment, index) => {
              const isSelected = index === selectedAccompanimentIndex;
              return (
                <Pressable
                  key={accompaniment.id}
                  style={[styles.accompanimentTab, isSelected && styles.accompanimentTabSelected]}
                  onPress={() => setSelectedAccompanimentIndex(index)}
                >
                  <Text style={styles.accompanimentTabLabel}>{accompaniment.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.modalTitle}>{selectedAccompaniment.name}</Text>

          {/* "key" force PianoChord à remonter ENTIÈREMENT à chaque pas
              (accompagnement + pas combinés dans la clé) : les pas n'ont pas
              tous le même nombre de notes (1 pour une note isolée, 3 pour un
              accord plaqué façon Valse), un remontage complet évite tout
              état interne de PianoChord hérité d'un pas ou d'un
              accompagnement à l'autre — même précaution que dans
              VoicingModal (voir son commentaire).
              showInversionControls={false} / showArpeggioButton={false} :
              comme les autres modales, celle-ci montre un PRINCIPE sur un
              accord d'exemple fixe qui s'anime tout seul, pas un accord à
              manipuler ni un 2e arpège à déclencher manuellement. */}
          <PianoChord
            key={`${selectedAccompanimentIndex}-${stepIndex}`}
            notes={activeNotes}
            showInversionControls={false}
            showArpeggioButton={false}
          />

          <Text style={styles.modalExplanation}>{selectedAccompaniment.explanation}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type VoicingModalProps = {
  onClose: () => void;
};

// Modale "Découvrir le voicing" : montre 3 voicings différents (voir
// VOICING_OPTIONS) du MÊME accord d'exemple fixe (Cmaj7, EXAMPLE_CMAJ7_NOTES),
// indépendamment de l'accord sélectionné ailleurs sur l'écran — même
// justification que pour l'arpège : enseigner un principe transposable, pas
// illustrer l'accord en cours.
//
// Nom du bouton déclencheur : "Découvrir le voicing" (voir ResultScreen),
// PAS "Voicing" tout court — ExpandedChordPanel a DÉJÀ un bouton "Voicing"
// qui bascule l'accord RÉELLEMENT affiché entre position théorique et
// voicing (state voicingMode, conservé tel quel : c'est la "façon de voir
// le voicing sur l'accord réel" demandée). Réutiliser le même libellé pour
// ce nouveau bouton, différent par nature (il ouvre une modale explicative
// sur un accord FIXE, il ne change rien à l'accord réel), aurait prêté à
// confusion : "Découvrir le voicing" reprend donc le même gabarit que
// "Découvrir un accompagnement", son équivalent pour l'arpège.
//
// CHOIX MANUEL, PAS D'ANIMATION : contrairement à la version précédente de
// cette modale (qui alternait automatiquement entre 2 états via un
// setInterval), le voicing affiché est maintenant choisi par l'utilisateur
// via les 3 boutons de VOICING_OPTIONS, et reste FIXE tant qu'il ne change
// pas de choix. Il n'y a donc plus aucun minuteur dans ce composant — rien
// ne tourne en arrière-plan, et rien à nettoyer à la fermeture de la modale
// ou au démontage (contrairement à AccompanimentModal, qui anime toujours
// automatiquement et a donc encore besoin de ce nettoyage).
function VoicingModal({ onClose }: VoicingModalProps) {
  // Voicing actuellement sélectionné : son "id" (voir VOICING_OPTIONS),
  // "Position fermée" au départ — la disposition de référence, la plus
  // simple, avant d'explorer les 2 autres.
  const [selectedVoicingId, setSelectedVoicingId] = useState('closed');

  const selectedVoicing =
    VOICING_OPTIONS.find((voicing) => voicing.id === selectedVoicingId) ?? VOICING_OPTIONS[0];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Pressable style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonLabel}>✕</Text>
          </Pressable>

          <Text style={styles.modalTitle}>Voicing</Text>

          {/* Définition générale (voir VOICING_EXPLANATION), affichée QUEL
              QUE SOIT le voicing choisi ci-dessous. */}
          <Text style={styles.modalExplanation}>{VOICING_EXPLANATION}</Text>

          {/* Boutons de voicing : un par entrée de VOICING_OPTIONS, sélection
              unique, celui sélectionné mis en évidence — même convention
              visuelle que les onglets d'accompagnement ci-dessus. */}
          <View style={styles.voicingOptionsRow}>
            {VOICING_OPTIONS.map((voicing) => {
              const isSelected = voicing.id === selectedVoicingId;
              return (
                <Pressable
                  key={voicing.id}
                  style={[styles.voicingOptionButton, isSelected && styles.voicingOptionButtonSelected]}
                  onPress={() => setSelectedVoicingId(voicing.id)}
                >
                  <Text style={styles.voicingOptionButtonLabel}>{voicing.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* "key" force PianoChord à remonter entièrement à chaque
              changement de voicing (donc à repartir avec un renversement à
              0) plutôt que de simplement recevoir de nouvelles notes en prop
              — même précaution que dans ExpandedChordPanel/AccompanimentModal
              (voir leurs commentaires sur "key") : les 3 voicings n'ont pas
              la même étendue (Position fermée tient sur 1 octave, Drop 2 et
              Basse + accord s'étalent bien plus).
              showInversionControls={false} / showArpeggioButton={false} :
              comme les autres modales, celle-ci montre un PRINCIPE sur un
              accord d'exemple fixe — pas un accord à manipuler, pas d'arpège
              à déclencher manuellement ici. La largeur du clavier reste
              adaptative (PianoChord mesure son conteneur et calcule lui-même
              le nombre d'octaves nécessaires, voir son commentaire sur
              computeOctaveCount) : Drop 2/Basse + accord, plus étalés,
              s'affichent donc automatiquement sur plus d'octaves sans jamais
              déborder ni recadrage manuel de ma part ici. */}
          <PianoChord
            key={selectedVoicing.id}
            notes={selectedVoicing.notes}
            showInversionControls={false}
            showArpeggioButton={false}
          />

          {/* TODO: son */}

          {/* Explication SPÉCIFIQUE au voicing sélectionné, sous le clavier —
              distincte de la définition générale affichée plus haut. */}
          <Text style={styles.voicingDetailExplanation}>{selectedVoicing.explanation}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type TonalityModalProps = {
  tonic: string;
  mode: ScaleChoice;
  onSelectTonic: (tonic: string) => void;
  onSelectMode: (mode: ScaleChoice) => void;
  onClose: () => void;
};

// Panneau "Tonalité" : choix du MODE (majeur/mineur) et de la TONIQUE (12
// boutons), remplace l'ancien texte statique "Gamme : ..." affiché au-dessus
// de chaque progression — désormais UN SEUL réglage global s'applique à
// TOUTES les progressions affichées (voir tonic/mode dans ResultScreen).
//
// Application IMMÉDIATE au tap (pas de bouton "Valider" séparé, le choix le
// plus simple des deux proposés) : chaque tap sur un bouton mode/tonique
// mémorise directement ce choix côté ResultScreen (onSelectMode/onSelectTonic),
// qui se re-rend aussitôt avec la nouvelle valeur. Le panneau reste ouvert
// après un tap (l'utilisateur peut choisir mode ET tonique avant de fermer),
// et ne se ferme que via son bouton ✕ ou un tap hors de la carte — même
// mécanisme que AccompanimentModal ci-dessus (voir son commentaire pour le
// détail de ce choix de fermeture).
//
// Contrairement à AccompanimentModal, ce panneau ne monte aucun <PianoChord>
// (pas de minuteur d'arpège à nettoyer) : sa présence/absence dans l'arbre
// (pilotée par isTonalityModalOpen côté ResultScreen) peut donc rester une
// simple question d'affichage, sans contrainte de démontage particulière.
function TonalityModal({ tonic, mode, onSelectTonic, onSelectMode, onClose }: TonalityModalProps) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.tonalityCard} onPress={() => {}}>
          <Pressable style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonLabel}>✕</Text>
          </Pressable>

          <Text style={styles.modalTitle}>Tonalité</Text>

          <View style={styles.modeRow}>
            {MODE_OPTIONS.map((option) => {
              const isSelected = option.value === mode;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.modeButton, isSelected && styles.modeButtonSelected]}
                  onPress={() => onSelectMode(option.value)}
                >
                  <Text style={styles.modeButtonLabel}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Grille compacte des 12 toniques (voir TONIC_OPTIONS) : flexWrap
              plutôt qu'une rangée unique, pour que le panneau reste COMPACT
              (largeur bornée par tonalityCard) au lieu de s'étirer sur toute
              la largeur de l'écran. */}
          <View style={styles.tonicGrid}>
            {TONIC_OPTIONS.map((option) => {
              const isSelected = option.value === tonic;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.tonicButton, isSelected && styles.tonicButtonSelected]}
                  onPress={() => onSelectTonic(option.value)}
                >
                  <Text style={styles.tonicButtonLabel}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Définition GÉNÉRALE des dominantes secondaires, affichée en haut
// d'EnrichmentModal quelle que soit l'option choisie en dessous (même
// principe que VOICING_EXPLANATION pour VoicingModal).
const SECONDARY_DOMINANT_EXPLANATION =
  "Une dominante secondaire est un accord emprunté qui « vise » un degré de la progression en créant une tension vers lui, avant de s'y résoudre — comme si ce degré devenait, le temps d'un accord, une tonique temporaire.";

// Une option de dominante secondaire proposée dans EnrichmentModal. STRUCTURE
// EXTENSIBLE (voir la consigne) : le composant EnrichmentModal se contente de
// .map() un tableau de ces options, donc ajouter un futur V/IV, V/vi... plus
// tard ne demande aucun changement à EnrichmentModal lui-même — seulement une
// nouvelle entrée ici, ET (côté ResultScreen) sa propre logique d'état et
// d'insertion, analogue à isVOfVAdded/withSecondaryDominantOfV : chaque
// dominante secondaire vise un degré DIFFÉRENT (donc une règle d'insertion
// différente), rien de plus générique n'est donc tenté ici pour l'instant —
// seul le V/V, seul cas demandé, a sa logique réellement câblée.
type SecondaryDominantOption = {
  id: string;
  label: string;
  explanation: string;
  isEnabled: boolean;
  // false → bouton désactivé/grisé, "disabledMessage" affiché à la place.
  canEnable: boolean;
  disabledMessage: string;
  onToggle: () => void;
};

type EnrichmentModalProps = {
  options: SecondaryDominantOption[];
  onClose: () => void;
};

// Modale "Enrichir la progression" : explique les dominantes secondaires en
// général, puis propose de les ajouter/retirer une par une (voir "options",
// une seule entrée câblée pour l'instant : le V/V).
//
// RÉVERSIBILITÉ : chaque option est un simple INTERRUPTEUR (son bouton
// affiche "Ajouter un X" ou "Retirer le X" selon option.isEnabled, comme le
// bouton Voicing de ExpandedChordPanel) — activer puis désactiver la même
// option revient exactement à la progression d'origine, l'état vivant chez
// ResultScreen (isVOfVAdded), pas ici (voir son commentaire pour le détail
// de ce qui est mémorisé et pourquoi).
function EnrichmentModal({ options, onClose }: EnrichmentModalProps) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Pressable style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonLabel}>✕</Text>
          </Pressable>

          <Text style={styles.modalTitle}>Dominantes secondaires</Text>
          <Text style={styles.modalExplanation}>{SECONDARY_DOMINANT_EXPLANATION}</Text>

          {options.map((option) => {
            // Désactivé UNIQUEMENT si l'option n'est pas déjà active ET
            // qu'elle ne peut pas l'être (ex: pas de V dans la progression) :
            // une option déjà activée reste toujours retirable, même si la
            // condition qui avait permis de l'ajouter ne tenait plus.
            const isDisabled = !option.isEnabled && !option.canEnable;

            return (
              <View key={option.id} style={styles.enrichmentOptionCard}>
                <Text style={styles.enrichmentOptionLabel}>{option.label}</Text>
                <Text style={styles.enrichmentOptionExplanation}>{option.explanation}</Text>

                <Pressable
                  style={[
                    styles.enrichmentToggleButton,
                    option.isEnabled && styles.enrichmentToggleButtonSelected,
                    isDisabled && styles.enrichmentToggleButtonDisabled,
                  ]}
                  onPress={option.onToggle}
                  disabled={isDisabled}
                >
                  <Text style={styles.enrichmentToggleButtonLabel}>
                    {option.isEnabled ? `Retirer le ${option.label}` : `Ajouter un ${option.label}`}
                  </Text>
                </Pressable>

                {isDisabled && (
                  <Text style={styles.enrichmentDisabledMessage}>{option.disabledMessage}</Text>
                )}
              </View>
            );
          })}

          {/* TODO: navigation vers le cours sur les dominantes secondaires */}
          <Pressable style={styles.learnMoreButton} onPress={() => {}}>
            <Text style={styles.learnMoreButtonLabel}>En savoir plus</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ResultScreen() {
  // Émotion + style choisis sur les deux écrans précédents, reçus via les params de route.
  const { emotion, style } = useRoute<ImproResultRoute>().params;

  const emotionLabel = MOODS.find((mood) => mood.value === emotion)?.label ?? emotion;

  // Filtrage par ÉMOTION uniquement, comme avant : le style n'est pas encore
  // utilisé pour filtrer (le champ `style` n'existe pas dans Progression), et
  // les données/le filtrage eux-mêmes ne changent pas ici — seul l'affichage
  // ci-dessous change.
  const filteredProgressions = PROGRESSIONS.filter(
    (progression) => progression.emotion === emotion
  );

  // STATE DE LA MODALE "DÉCOUVRIR UN ACCOMPAGNEMENT" : ouverte/fermée,
  // indépendante de tout accord sélectionné (voir AccompanimentModal,
  // rendue uniquement quand ce booléen est vrai — c'est ce démontage complet
  // à la fermeture qui garantit le nettoyage du minuteur d'arpège, voir son
  // commentaire).
  const [isAccompanimentModalOpen, setIsAccompanimentModalOpen] = useState(false);

  // STATE DE LA MODALE "DÉCOUVRIR LE VOICING" : même principe que
  // isAccompanimentModalOpen ci-dessus (voir son commentaire) — montée
  // uniquement quand ce booléen est vrai, ce qui garantit le nettoyage du
  // minuteur d'alternance de VoicingModal à la fermeture.
  const [isVoicingModalOpen, setIsVoicingModalOpen] = useState(false);

  // STATE DE LA TONALITÉ DE RÉFÉRENCE : tonique + mode utilisés pour
  // convertir TOUS les degrés affichés (toutes progressions confondues) en
  // accords concrets. Remplace l'ancienne constante fixe TONIC ('C') et
  // l'ancien texte statique "Gamme : {progression.gamme}" — un SEUL réglage
  // global (choisi via TonalityModal) s'applique désormais à l'écran entier,
  // quelle que soit la gamme d'origine de chaque progression dans le
  // dataset. Départ : Do majeur, comme le comportement précédent (TONIC='C',
  // et toutes les progressions actuelles sont déjà en gamme "majeur" ou
  // "mineur" par défaut — voir progression.ts).
  //
  // RECALCUL : ces 2 valeurs sont passées telles quelles à ExpandedChordPanel
  // (props scale/tonic), qui les transmet à buildExtendedChord — aucune
  // copie/mise en cache des accords n'existe ailleurs, donc changer tonic ou
  // mode ici redéclenche automatiquement le calcul de l'accord actuellement
  // déplié (et de tout autre accord qu'on dépliera ensuite) sans code
  // supplémentaire : React re-rend ExpandedChordPanel avec les nouvelles
  // props dès que ce state change.
  const [tonic, setTonic] = useState('C');
  const [mode, setMode] = useState<ScaleChoice>('majeur');
  const [isTonalityModalOpen, setIsTonalityModalOpen] = useState(false);

  // Libellé lisible de la tonalité actuelle pour le bouton déclencheur (ex:
  // "Ré♭ majeur") : toFlatPreferredSpelling (Tonal) choisit l'orthographe la
  // plus propre pour une tonique sur touche noire (bémol plutôt que dièse),
  // toFrenchNoteName la traduit en français ; "mode" ('majeur'/'mineur') est
  // déjà le mot français attendu, pas besoin de le retraduire.
  const tonalityLabel = `${toFrenchNoteName(toFlatPreferredSpelling(tonic))} ${mode}`;

  // STATE DU DEGRÉ SÉLECTIONNÉ : lequel des degrés affichés est actuellement
  // "déplié" (un seul à la fois, tous progressions confondues), ou null si
  // aucun. Piloté uniquement par les clics sur les chips ci-dessous :
  // recliquer sur le degré déjà sélectionné le désélectionne (replie le
  // piano), cliquer un autre degré déplace la sélection vers celui-ci.
  const [selected, setSelected] = useState<ChordPosition | null>(null);

  const toggleSelection = (position: ChordPosition) => {
    setSelected((current) => (samePosition(current, position) ? null : position));
  };

  // STATE D'ENRICHISSEMENT PAR ACCORD : le niveau (triade/7/9/11/13) de
  // CHAQUE accord, chacun indépendamment des autres (et indépendamment du
  // fait qu'ils soient actuellement dépliés ou non — un accord enrichi le
  // reste même une fois replié). Une Map de clé "progressionIndex-chordIndex"
  // vers son niveau suffit ; un accord absent de la Map vaut 0 (triade),
  // c'est le niveau par défaut (voir getLevel).
  const [enrichmentLevels, setEnrichmentLevels] = useState<Map<string, ExtensionLevel>>(new Map());

  const getLevel = (position: ChordPosition): ExtensionLevel => {
    return enrichmentLevels.get(chordKey(position)) ?? 0;
  };

  const setLevel = (position: ChordPosition, level: ExtensionLevel) => {
    setEnrichmentLevels((current) => {
      const next = new Map(current);
      // Niveau 0 (triade) = état par défaut : autant retirer la clé plutôt
      // que stocker explicitement "0", la Map reste plus petite.
      if (level === 0) {
        next.delete(chordKey(position));
      } else {
        next.set(chordKey(position), level);
      }
      return next;
    });
  };

  // STATE DU V/V : un SEUL booléen global, appliqué à TOUTES les
  // progressions affichées à la fois (pas une Map par progression) — chaque
  // progression qui contient un "V" reçoit son V/V juste avant (voir
  // withSecondaryDominantOfV) ; celles qui n'en ont pas restent simplement
  // inchangées. C'est ce qui rend l'ajout RÉVERSIBLE : repasser isVOfVAdded
  // à false retrouve exactement les degrés d'origine (withSecondaryDominantOfV
  // renvoie alors "degrees" tel quel, sans aucune copie/mutation permanente
  // des données de PROGRESSIONS).
  const [isVOfVAdded, setIsVOfVAdded] = useState(false);
  const [isEnrichmentModalOpen, setIsEnrichmentModalOpen] = useState(false);

  // Condition d'activation de l'option "Ajouter un V/V" (voir
  // EnrichmentModal) : au moins UNE des progressions actuellement affichées
  // doit contenir un "V", sinon l'activer n'aurait absolument aucun effet
  // visible nulle part sur cet écran.
  const anyProgressionHasV = filteredProgressions.some((progression) =>
    progression.degrees.includes('V'),
  );

  const toggleVOfV = () => {
    setIsVOfVAdded((current) => !current);
    // Insérer/retirer le V/V DÉCALE les index de tous les accords situés
    // après le point d'insertion dans chaque progression concernée (voir
    // ChordPosition.chordIndex) : un niveau d'enrichissement ou un accord
    // "déplié" mémorisé PAR INDEX pourrait donc se retrouver associé au
    // MAUVAIS accord après le décalage (ex: le niveau "7e" du Ier degré
    // resterait sur l'index où il était, mais cet index pointe désormais
    // vers le V/V ou un autre accord). Réinitialiser sélection et niveaux
    // ici est le choix le plus simple et le plus sûr pour l'éviter — la
    // progression change de forme, il est normal qu'on reparte d'un état
    // propre plutôt que de tenter de "réaligner" les anciens index.
    setSelected(null);
    setEnrichmentLevels(new Map());
  };

  const secondaryDominantOptions: SecondaryDominantOption[] = [
    {
      id: 'v-of-v',
      label: 'V/V',
      explanation:
        "Le V/V est la dominante du Vème degré : il annonce et renforce l'arrivée du V.",
      isEnabled: isVOfVAdded,
      canEnable: anyProgressionHasV,
      disabledMessage: 'Ajoute un V à ta progression pour utiliser un V/V.',
      onToggle: toggleVOfV,
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={theme.text.title}>Résultat</Text>
      {/* "style" est désormais optionnel (voir ExercisesStackParamList) :
          ImproChoicesScreen laisse voir les progressions sans en choisir un.
          Sans ce garde, "undefined" s'afficherait littéralement à l'écran. */}
      <Text style={theme.text.subtitle}>{style ? `${emotionLabel} · ${style}` : emotionLabel}</Text>

      {/* Rangée compacte des 4 boutons indépendants de l'accord sélectionné :
          "Tonalité" (affiche le choix courant, ouvre TonalityModal),
          "Découvrir un accompagnement" (ouvre AccompanimentModal),
          "Découvrir le voicing" (ouvre VoicingModal) et "Enrichir la
          progression" (ouvre EnrichmentModal) — tous quatre toujours
          accessibles, pas seulement quand un accord est déplié. flexWrap
          pour rester lisible si l'écran est étroit. */}
      <View style={styles.topButtonsRow}>
        <Pressable style={styles.tonalityButton} onPress={() => setIsTonalityModalOpen(true)}>
          <Text style={styles.tonalityButtonLabel}>{tonalityLabel}</Text>
        </Pressable>

        <Pressable
          style={styles.accompanimentButton}
          onPress={() => setIsAccompanimentModalOpen(true)}
        >
          <Text style={styles.accompanimentButtonLabel}>Découvrir un accompagnement</Text>
        </Pressable>

        <Pressable
          style={styles.voicingDiscoveryButton}
          onPress={() => setIsVoicingModalOpen(true)}
        >
          <Text style={styles.voicingDiscoveryButtonLabel}>Découvrir le voicing</Text>
        </Pressable>

        <Pressable
          style={styles.enrichmentButton}
          onPress={() => setIsEnrichmentModalOpen(true)}
        >
          <Text style={styles.enrichmentButtonLabel}>Enrichir la progression</Text>
        </Pressable>
      </View>

      {isTonalityModalOpen && (
        <TonalityModal
          tonic={tonic}
          mode={mode}
          onSelectTonic={setTonic}
          onSelectMode={setMode}
          onClose={() => setIsTonalityModalOpen(false)}
        />
      )}

      {isAccompanimentModalOpen && (
        <AccompanimentModal onClose={() => setIsAccompanimentModalOpen(false)} />
      )}

      {isVoicingModalOpen && (
        <VoicingModal onClose={() => setIsVoicingModalOpen(false)} />
      )}

      {isEnrichmentModalOpen && (
        <EnrichmentModal
          options={secondaryDominantOptions}
          onClose={() => setIsEnrichmentModalOpen(false)}
        />
      )}

      {filteredProgressions.length > 0 ? (
        filteredProgressions.map((progression, progressionIndex) => {
          // Degrés RÉELLEMENT affichés pour cette progression : ceux
          // d'origine, ou avec le V/V inséré juste avant son premier V si
          // isVOfVAdded est actif ET que cette progression contient un V
          // (voir withSecondaryDominantOfV) — une progression sans V n'est
          // pas affectée, même si isVOfVAdded est actif pour l'écran entier.
          const displayedDegrees = withSecondaryDominantOfV(progression.degrees, isVOfVAdded);

          return (
            <View key={progressionIndex} style={styles.progressionBlock}>
              {/* Par défaut : seulement les degrés, en chips cliquables — pas
                  de piano visible tant qu'aucun n'est sélectionné. */}
              <View style={styles.degreeChipsRow}>
                {displayedDegrees.map((degree, chordIndex) => {
                  const position: ChordPosition = { progressionIndex, chordIndex };
                  const isSelected = samePosition(selected, position);

                  return (
                    <Pressable
                      key={chordIndex}
                      style={[styles.degreeChip, isSelected && styles.degreeChipSelected]}
                      onPress={() => toggleSelection(position)}
                    >
                      <Text style={styles.degreeChipLabel}>{degree}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* RENDU CONDITIONNEL DU PIANO : seulement pour LE degré
                  sélectionné, et seulement sous SA progression (pas sous les
                  autres) — jamais plus d'un piano affiché à la fois.
                  scale/tonic viennent maintenant du panneau "Tonalité" (voir
                  tonic/mode dans ResultScreen), plus de la gamme d'origine de
                  CETTE progression (progression.gamme, qui n'est plus utilisée
                  pour le calcul) : "mode" est toujours un ScaleChoice valide
                  (2 boutons seulement dans le panneau), donc plus besoin du
                  garde-fou isKnownScale d'avant (et de son "Affichage piano non
                  disponible pour cette gamme.", devenu inatteignable).
                  degree vient de displayedDegrees (pas progression.degrees) :
                  selected.chordIndex indexe le tableau AFFICHÉ (qui peut
                  contenir le V/V inséré), pas les degrés d'origine. */}
              {selected !== null && selected.progressionIndex === progressionIndex ? (
                <ExpandedChordPanel
                  // "key" (voir le commentaire dans ExpandedChordPanel) :
                  // change de composant React à chaque accord différent,
                  // donc son state local (voicingMode) repart à zéro.
                  key={chordKey(selected)}
                  degree={displayedDegrees[selected.chordIndex]}
                  scale={mode}
                  tonic={tonic}
                  level={getLevel(selected)}
                  onSelectLevel={(level) => setLevel(selected, level)}
                />
              ) : null}
            </View>
          );
        })
      ) : (
        <Text style={theme.text.subtitle}>Aucune progression trouvée</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  progressionBlock: {
    gap: theme.spacing.md,
  },
  degreeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  degreeChip: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  // Mise en évidence du degré sélectionné : fond plein en couleur d'accent
  // du thème (primary), la même convention que moodButtonSelected/
  // scaleButtonSelected ailleurs dans l'app pour un état "sélectionné".
  degreeChipSelected: {
    backgroundColor: theme.colors.primary,
  },
  degreeChipLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Pas de alignItems: 'center' ici (volontairement) : PianoChord, à
  // l'intérieur, mesure la largeur réellement disponible dans SON conteneur
  // parent direct (ce View) via onLayout pour ne jamais déborder — ça
  // suppose que ce parent le laisse s'étirer sur toute sa largeur
  // (comportement par défaut), plutôt que le recroqueviller sur son contenu
  // comme le ferait alignItems: 'center'. Voir le commentaire de
  // styles.container dans PianoChord.tsx pour le détail.
  expandedPanel: {
    gap: theme.spacing.md,
    backgroundColor: theme.colors.backGroundExercice,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  expandedLabel: {
    textAlign: 'center',
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Encart d'explication d'une règle d'altération active (ex: ♯11) : un
  // fond légèrement distinct de expandedPanel pour bien le détacher du
  // reste du panneau, avec le texte en plus petit (secondaire) comme
  // theme.text.subtitle ailleurs dans l'app pour du texte explicatif.
  alterationExplanation: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  alterationExplanationText: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Sélecteur de niveau d'enrichissement (triade/7/9/11/13) : une rangée de
  // chips, même convention visuelle que degreeChipsRow/degreeChip plus haut.
  levelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  levelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  levelButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  levelButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Bouton Voicing : même famille visuelle que levelButton, mais seul et
  // centré (ce n'est pas un choix parmi plusieurs, juste un interrupteur).
  voicingButton: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  voicingButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  voicingButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Rangée des 2 boutons indépendants de l'accord sélectionné (Tonalité +
  // Découvrir un accompagnement) : centrée et capable de passer à la ligne
  // (flexWrap) sur un écran étroit plutôt que de déborder.
  topButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  accompanimentButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  accompanimentButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Même famille visuelle que accompanimentButton : affiche la tonalité
  // actuelle (ex: "Ré♭ majeur", voir tonalityLabel dans ResultScreen), ouvre
  // TonalityModal au tap.
  tonalityButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  tonalityButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Même famille visuelle que accompanimentButton/tonalityButton : ouvre
  // VoicingModal. Nom distinct de voicingButton (le VRAI toggle par accord,
  // dans ExpandedChordPanel) pour éviter toute collision dans cette même
  // feuille de style — voir le commentaire sur VoicingModal pour le choix de
  // libellé ("Découvrir le voicing", pas "Voicing").
  voicingDiscoveryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  voicingDiscoveryButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Même famille visuelle que accompanimentButton/tonalityButton/
  // voicingDiscoveryButton : ouvre EnrichmentModal.
  enrichmentButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  enrichmentButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Carte d'UNE option de dominante secondaire (EnrichmentModal) : même fond
  // que expandedPanel (backGroundExercice), pour la détacher du fond de la
  // carte de modale (elle aussi backGroundExercice) — cohérent avec
  // l'encart alterationExplanation, qui utilise surface pour la même raison
  // dans un contexte différent.
  enrichmentOptionCard: {
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  enrichmentOptionLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  enrichmentOptionExplanation: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Bouton "Ajouter un X"/"Retirer le X" : même famille que voicingButton
  // (ExpandedChordPanel) pour un interrupteur seul et centré, mais en
  // theme.colors.background (pas surface, sa valeur habituelle) car ce
  // bouton est posé sur enrichmentOptionCard, déjà en surface juste
  // au-dessus — les deux se confondraient sinon.
  enrichmentToggleButton: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  enrichmentToggleButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  // Désactivé (pas de V dans aucune progression affichée) : reprend
  // theme.colors.locked, le même gris neutre déjà utilisé pour tout élément
  // verrouillé/désactivé ailleurs dans l'app (ex: CourseParcoursScreen,
  // ImproChoicesScreen) plutôt qu'une opacité réduite improvisée.
  enrichmentToggleButtonDisabled: {
    backgroundColor: theme.colors.locked,
    borderColor: theme.colors.locked,
  },
  enrichmentToggleButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  enrichmentDisabledMessage: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Bouton "En savoir plus" : discret (pas de bordure primary), en bas de la
  // modale — informationnel, pas une action principale.
  learnMoreButton: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  learnMoreButtonLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  // Fond assombri derrière la carte. Pas de token dédié "overlay"/"scrim"
  // dans le thème (à signaler) : un noir semi-transparent en dur est la
  // valeur standard pour ce genre d'usage (une vraie couleur du thème,
  // opaque, ne conviendrait pas ici — l'effet recherché est justement de
  // laisser transparaître l'écran assombri en dessous). alignItems/
  // justifyContent 'center' centrent la carte au milieu de l'écran.
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  // Pas de alignItems: 'center' ici (volontairement) : PianoChord, à
  // l'intérieur, mesure la largeur réellement disponible dans SON conteneur
  // parent direct (ce View) via onLayout pour ne jamais déborder — même
  // contrainte que expandedPanel plus haut (voir son commentaire, et celui
  // de styles.container dans PianoChord.tsx, pour le détail). Le titre et
  // l'explication sont centrés individuellement via leur propre textAlign.
  modalCard: {
    width: '100%',
    maxWidth: 420,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.backGroundExercice,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
  modalCloseButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  modalTitle: {
    ...theme.text.title,
    textAlign: 'center',
  },
  // Onglets de sélection d'accompagnement (AccompanimentModal) : même
  // famille visuelle que modeButton/tonicButton/levelButton ailleurs dans ce
  // fichier (surface + bordure primary au repos, fond primary une fois
  // sélectionné) pour rester cohérent ; flexWrap pour rester compact même si
  // ACCOMPANIMENTS grandit.
  accompanimentTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  accompanimentTab: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  accompanimentTabSelected: {
    backgroundColor: theme.colors.primary,
  },
  accompanimentTabLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  modalExplanation: {
    fontSize: theme.text.size.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  // Boutons de voicing (VoicingModal) : même famille visuelle que les
  // onglets d'accompagnement/modeButton/tonicButton ailleurs dans ce fichier
  // (surface + bordure primary au repos, fond primary une fois sélectionné).
  voicingOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  voicingOptionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  voicingOptionButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  voicingOptionButtonLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Explication SPÉCIFIQUE au voicing sélectionné (sous le clavier) : texte
  // normal (pas muted) pour la distinguer de la définition générale
  // (modalExplanation, secondaire/textMuted) affichée plus haut dans la
  // même modale.
  voicingDetailExplanation: {
    fontSize: theme.text.size.sm,
    color: theme.colors.text,
    textAlign: 'center',
  },
  // Panneau "Tonalité" : même famille visuelle que modalCard, mais plus
  // étroit (maxWidth 360 contre 420) — pas de piano à afficher ici, juste des
  // boutons, donc pas besoin d'autant de largeur. Reste COMPACT (ne remplit
  // jamais l'écran), comme demandé.
  tonalityCard: {
    width: '100%',
    maxWidth: 360,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.backGroundExercice,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  // Même famille visuelle que levelButton/voicingButton (ResultScreen) :
  // surface + bordure primary au repos, fond primary plein une fois
  // sélectionné — convention déjà utilisée partout ailleurs dans ce fichier
  // pour un état "sélectionné" (voir aussi degreeChip).
  modeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  modeButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  modeButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Grille compacte des 12 toniques : flexWrap sur plusieurs lignes (plutôt
  // qu'une rangée unique qui déborderait de tonalityCard) ; justifyContent
  // 'center' pour que la dernière ligne (12 n'est pas forcément un multiple
  // exact du nombre de boutons par ligne) reste centrée plutôt que collée à
  // gauche.
  tonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  // Largeur FIXE (plutôt qu'ajustée au texte) : "petits boutons
  // ergonomiques" en grille compacte, comme demandé — une largeur fixe
  // garde la grille bien alignée quelle que soit la longueur du libellé
  // (ex: "C" vs "C♯/D♭").
  tonicButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  tonicButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  tonicButtonLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
    textAlign: 'center',
  },
});
