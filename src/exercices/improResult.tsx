import { useEffect, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import { PianoChord } from '../components/PianoChord';
import { SlidePanel } from '../components/SlidePanel';
import { useProfile } from '../context/ProfileContext';
import { useSucces } from '../context/SuccesContext';
import { useQuetes } from '../context/QuetesContext';
import { XP_EXERCICE, XP_FEEDBACK_DURATION_MS } from '../lib/xpRewards';
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
import { CADENCES, findExistingCadence, withCadence } from '../dataset/cadences';
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
type ImproResultNavigation = NativeStackNavigationProp<ExercisesStackParamList, 'ImproResult'>;

// Taille des carrés de degré (voir styles.degreeSquare, section MILIEU de
// l'écran) : pas de token de taille dédié dans le thème, donc composé à
// partir de spacing.xl — même formule que LESSON_NODE_SIZE dans
// CourseParcoursScreen (theme.spacing.xl * 2), pour un "noeud" cliquable
// d'une taille cohérente avec le reste de l'app.
const DEGREE_SQUARE_SIZE = theme.spacing.xl * 2;

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
// EXPORTÉ (avec ses 2 complices plus bas, AccompanimentPanelContent et
// VoicingPanelContent) : creation.tsx (écran "Crée ta progression") les
// réutilise TELS QUELS dans son carrousel d'accords, plutôt que de dupliquer
// enrichissement/voicing/accompagnement/renversements — voir son
// commentaire "OUTILS RÉUTILISÉS" pour le détail de cette réutilisation.
// Rien ne change ici dans leur fonctionnement pour ResultScreen : ce sont
// des composants autonomes (tout ce dont ils dépendent leur arrive en
// props, ou vient de constantes de CE module), les exporter ne fait
// qu'élargir qui peut les importer.
export type ExpandedChordPanelProps = {
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

export function ExpandedChordPanel({ degree, scale, tonic, level, onSelectLevel }: ExpandedChordPanelProps) {
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
          désormais uniquement via le panneau "Découvrir un accompagnement"
          (voir AccompanimentPanelContent plus bas) — ce panneau garde ses
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

// Définition GÉNÉRALE du voicing, affichée en haut de VoicingPanelContent
// quel que soit le voicing sélectionné (voir VOICING_OPTIONS plus bas pour
// l'explication SPÉCIFIQUE à chacun).
const VOICING_EXPLANATION =
  "Un voicing, c'est une façon de répartir les notes d'un accord sur le clavier — leur ordre et leur répartition entre les octaves, sans jamais changer les notes elles-mêmes. Le même accord peut ainsi sonner plus serré ou plus ouvert, plus grave ou plus équilibré entre les deux mains.";

// Accord d'exemple FIXE de VoicingPanelContent : Cmaj7 empilé (Do-Mi-Sol-Si), à
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

// Les 3 voicings proposés dans VoicingPanelContent. Choisis manuellement via
// des boutons (voir VoicingPanelContent) plutôt qu'animés automatiquement : chaque
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

export type AccompanimentPanelContentProps = {
  // Piloté par ResultScreen (isAccompanimentPanelOpen) : ce composant est
  // rendu comme "children" de SlidePanel, qui reste TOUJOURS monté (voir son
  // commentaire) — c'est cette prop, pas un montage/démontage, qui dit si le
  // panneau est réellement ouvert. INDISPENSABLE ici : c'est elle qui
  // permet d'arrêter le séquenceur d'arpège à la fermeture (voir plus bas).
  isOpen: boolean;
};

// Contenu de la modale (désormais panneau) "Découvrir un accompagnement" :
// montre le PRINCIPE de PLUSIEURS accompagnements (voir ACCOMPANIMENTS,
// ../dataset/accompaniments.ts) sur un accord d'exemple fixe, indépendamment
// de l'accord sélectionné ailleurs sur l'écran. Navigation par ONGLETS (un
// par accompagnement de la table) : compact, et montre d'un coup d'œil
// combien d'accompagnements existent — plus adapté ici que des flèches < >
// (qui ne montrent qu'un voisin à la fois) pour une table appelée à grandir.
//
// N'est QUE le contenu : le glissement, la carte, le bouton fermer et le
// défilement sont fournis par SlidePanel (voir son utilisation dans
// ResultScreen) — ce composant ne rend plus de Modal/Pressable de fond lui-
// même.
//
// NETTOYAGE DES TIMERS (IMPORTANT) : contrairement à l'ancienne Modal (qui
// se démontait entièrement à la fermeture, arrêtant le séquenceur du même
// coup), ce composant reste TOUJOURS MONTÉ — c'est SlidePanel qui reste
// monté en permanence pour pouvoir animer sa fermeture, et "children" avec
// lui (voir le commentaire détaillé dans SlidePanel.tsx). Le séquenceur
// ci-dessous DOIT donc explicitement s'arrêter tout seul quand "isOpen"
// repasse à false (voir le "if (!isOpen) return" en tête d'effet), sous
// peine de continuer à tourner EN ARRIÈRE-PLAN une fois le panneau glissé
// hors champ, invisible mais toujours actif.
export function AccompanimentPanelContent({ isOpen }: AccompanimentPanelContentProps) {
  // Onglet actif : un INDEX dans ACCOMPANIMENTS plutôt qu'un id — plus
  // simple ici puisque cette table est un tableau fixe local, pas besoin
  // d'une recherche par id. 0 = "Arpège montant", le même accompagnement
  // qu'avant l'ajout des onglets.
  const [selectedAccompanimentIndex, setSelectedAccompanimentIndex] = useState(0);

  // Pas actuellement affiché DE L'ACCOMPAGNEMENT SÉLECTIONNÉ, piloté par le
  // séquenceur ci-dessous.
  const [stepIndex, setStepIndex] = useState(0);

  // Repart TOUJOURS du 1er accompagnement à l'OUVERTURE (isOpen passant à
  // true) : ce composant étant désormais toujours monté (voir plus haut),
  // c'était auparavant le remontage à chaque ouverture qui remettait cet
  // index à 0 — il faut donc le faire explicitement ici pour garder
  // exactement le même comportement qu'avant.
  useEffect(() => {
    if (isOpen) {
      setSelectedAccompanimentIndex(0);
    }
  }, [isOpen]);

  // SÉQUENCEUR : généralise le principe déjà utilisé par l'arpège de
  // PianoChord (des setTimeout ENCHAÎNÉS, chaque pas programmant lui-même le
  // suivant) pour lire N'IMPORTE QUELLE séquence de la table, avec la durée
  // PROPRE À CHAQUE PAS (steps[i].durationMs) plutôt qu'une durée fixe.
  //
  // Dépend de isOpen ET de selectedAccompanimentIndex (pas de l'objet
  // accompaniment lui-même) : ACCOMPANIMENTS est un tableau CONSTANT au
  // niveau module, jamais recréé, donc ACCOMPANIMENTS[i] reste la MÊME
  // référence tant que i ne change pas — un simple index suffit ici comme
  // dépendance stable (contrairement à l'arpège de PianoChord, qui doit
  // dériver une clé texte à partir d'un tableau de notes recalculé, lui, à
  // chaque rendu de l'appelant).
  //
  // "if (!isOpen) return" EN TÊTE : ne programme AUCUN timer tant que le
  // panneau n'est pas ouvert — c'est ce qui empêche le séquenceur de tourner
  // pendant que le panneau est glissé hors champ (voir le commentaire
  // NETTOYAGE plus haut).
  //
  // CHANGER D'ACCOMPAGNEMENT (donc changer selectedAccompanimentIndex) OU
  // FERMER LE PANNEAU (isOpen passant à false) redéclenche cet effet : React
  // exécute D'ABORD la fonction de nettoyage de l'exécution PRÉCÉDENTE
  // (clearTimeout du timer en attente) AVANT de lancer ce nouveau corps
  // d'effet — l'animation en cours s'arrête donc TOUJOURS avant qu'une
  // nouvelle ne démarre (ou avant de s'arrêter pour de bon, si isOpen vient
  // de passer à false), jamais 2 séquenceurs en même temps.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

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
    // ré-exécution de cet effet (à chaque changement d'accompagnement OU
    // quand isOpen passe à false, voir ci-dessus) ET au démontage éventuel
    // du composant. clearTimeout annule le SEUL timer en attente à cet
    // instant (timeoutId est réassigné à chaque pas par scheduleNextStep,
    // donc toujours le bon, quel que soit le pas en cours à ce moment-là) :
    // aucune fuite de timer possible, quelle que soit la façon dont le
    // panneau se ferme ou dont l'accompagnement change.
    return () => clearTimeout(timeoutId);
  }, [isOpen, selectedAccompanimentIndex]);

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

  return (
    <>
      {/* Onglets : un bouton par accompagnement de la table — ajouter un
          accompagnement à ACCOMPANIMENTS lui donne automatiquement un onglet
          ici, sans autre changement de code. flexWrap pour rester compact
          même si la table grandit encore. */}
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
          accord plaqué façon Valse), un remontage complet évite tout état
          interne de PianoChord hérité d'un pas ou d'un accompagnement à
          l'autre — même précaution que dans VoicingPanelContent (voir son
          commentaire).
          showInversionControls={false} / showArpeggioButton={false} :
          comme les autres panneaux, celui-ci montre un PRINCIPE sur un
          accord d'exemple fixe qui s'anime tout seul, pas un accord à
          manipuler ni un 2e arpège à déclencher manuellement. */}
      <PianoChord
        key={`${selectedAccompanimentIndex}-${stepIndex}`}
        notes={activeNotes}
        showInversionControls={false}
        showArpeggioButton={false}
      />

      <Text style={styles.modalExplanation}>{selectedAccompaniment.explanation}</Text>
    </>
  );
}

export type VoicingPanelContentProps = {
  // Voir le commentaire équivalent sur AccompanimentPanelContentProps :
  // piloté par ResultScreen, ce composant reste TOUJOURS monté (enfant de
  // SlidePanel). Ce contenu-ci n'a AUCUN minuteur (voir plus bas), donc
  // "isOpen" ne sert ici qu'à réinitialiser le voicing sélectionné à
  // l'ouverture — pas à arrêter quoi que ce soit en arrière-plan.
  isOpen: boolean;
};

// Contenu de la modale (désormais panneau) "Découvrir le voicing" : montre
// 3 voicings différents (voir VOICING_OPTIONS) du MÊME accord d'exemple fixe
// (Cmaj7, EXAMPLE_CMAJ7_NOTES), indépendamment de l'accord sélectionné
// ailleurs sur l'écran — même justification que pour l'arpège : enseigner un
// principe transposable, pas illustrer l'accord en cours.
//
// Nom du bouton déclencheur : "Découvrir le voicing" (voir ResultScreen),
// PAS "Voicing" tout court — ExpandedChordPanel a DÉJÀ un bouton "Voicing"
// qui bascule l'accord RÉELLEMENT affiché entre position théorique et
// voicing (state voicingMode, conservé tel quel : c'est la "façon de voir
// le voicing sur l'accord réel" demandée). Réutiliser le même libellé pour
// ce nouveau bouton, différent par nature (il ouvre un panneau explicatif
// sur un accord FIXE, il ne change rien à l'accord réel), aurait prêté à
// confusion : "Découvrir le voicing" reprend donc le même gabarit que
// "Découvrir un accompagnement", son équivalent pour l'arpège.
//
// CHOIX MANUEL, PAS D'ANIMATION : le voicing affiché est choisi par
// l'utilisateur via les 3 boutons de VOICING_OPTIONS, et reste FIXE tant
// qu'il ne change pas de choix — aucun minuteur dans ce composant, rien à
// nettoyer à la fermeture du panneau (contrairement à
// AccompanimentPanelContent, qui anime automatiquement et en a besoin).
//
// N'est QUE le contenu : le glissement, la carte, le bouton fermer et le
// défilement sont fournis par SlidePanel (voir son utilisation dans
// ResultScreen).
export function VoicingPanelContent({ isOpen }: VoicingPanelContentProps) {
  // Voicing actuellement sélectionné : son "id" (voir VOICING_OPTIONS),
  // "Position fermée" au départ — la disposition de référence, la plus
  // simple, avant d'explorer les 2 autres.
  const [selectedVoicingId, setSelectedVoicingId] = useState('closed');

  // Repart TOUJOURS de "Position fermée" à l'OUVERTURE (isOpen passant à
  // true) : ce composant étant désormais toujours monté, c'était auparavant
  // le remontage à chaque ouverture qui remettait ce choix à zéro.
  useEffect(() => {
    if (isOpen) {
      setSelectedVoicingId('closed');
    }
  }, [isOpen]);

  const selectedVoicing =
    VOICING_OPTIONS.find((voicing) => voicing.id === selectedVoicingId) ?? VOICING_OPTIONS[0];

  return (
    <>
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

      {/* "key" force PianoChord à remonter entièrement à chaque changement
          de voicing (donc à repartir avec un renversement à 0) plutôt que de
          simplement recevoir de nouvelles notes en prop — même précaution
          que dans ExpandedChordPanel/AccompanimentPanelContent (voir leurs
          commentaires sur "key") : les 3 voicings n'ont pas la même étendue
          (Position fermée tient sur 1 octave, Drop 2 et Basse + accord
          s'étalent bien plus).
          showInversionControls={false} / showArpeggioButton={false} :
          comme les autres panneaux, celui-ci montre un PRINCIPE sur un
          accord d'exemple fixe — pas un accord à manipuler, pas d'arpège à
          déclencher manuellement ici. La largeur du clavier reste adaptative
          (PianoChord mesure son conteneur et calcule lui-même le nombre
          d'octaves nécessaires, voir son commentaire sur
          computeOctaveCount) : Drop 2/Basse + accord, plus étalés,
          s'affichent donc automatiquement sur plus d'octaves sans jamais
          déborder ni recadrage manuel de ma part ici. */}
      <PianoChord
        key={selectedVoicing.id}
        notes={selectedVoicing.notes}
        showInversionControls={false}
        showArpeggioButton={false}
      />

      {/* Explication SPÉCIFIQUE au voicing sélectionné, sous le clavier —
          distincte de la définition générale affichée plus haut. */}
      <Text style={styles.voicingDetailExplanation}>{selectedVoicing.explanation}</Text>
    </>
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
// et ne se ferme que via son bouton ✕ ou un tap hors de la carte — le fond
// (modalBackdrop) est lui-même un Pressable plein écran avec
// onPress={onClose}, et la carte au centre un SECOND Pressable avec un
// onPress vide, qui "consomme" donc le tap avant qu'il n'atteigne le fond
// en dessous (les Pressable de React Native ne laissent pas un tap
// traverser vers un Pressable parent une fois qu'un Pressable enfant l'a
// géré) : taper DANS la carte ne ferme donc pas la modale, seulement en
// dehors. Cette modale-ci reste une VRAIE Modal react-native (voir la
// consigne : seuls les 3 boutons accompagnement/voicing/enrichissement
// deviennent des panneaux glissants, pas celui-ci).
//
// Contrairement à AccompanimentPanelContent (qui doit explicitement arrêter
// son séquenceur d'arpège à la fermeture, voir son commentaire), ce panneau
// ne monte aucun <PianoChord> (pas de minuteur à nettoyer) : sa
// présence/absence dans l'arbre (pilotée par isTonalityModalOpen côté
// ResultScreen) peut donc rester une simple question d'affichage, sans
// contrainte de démontage particulière.
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
// d'EnrichmentPanelContent quelle que soit l'option choisie en dessous (même
// principe que VOICING_EXPLANATION pour VoicingPanelContent).
const SECONDARY_DOMINANT_EXPLANATION =
  "Une dominante secondaire est un accord emprunté qui « vise » un degré de la progression en créant une tension vers lui, avant de s'y résoudre — comme si ce degré devenait, le temps d'un accord, une tonique temporaire.";

// Une option de dominante secondaire proposée dans EnrichmentPanelContent.
// STRUCTURE EXTENSIBLE (voir la consigne) : ce composant se contente de
// .map() un tableau de ces options, donc ajouter un futur V/IV, V/vi... plus
// tard ne lui demande aucun changement — seulement une nouvelle entrée ici,
// ET (côté ResultScreen) sa propre logique d'état et d'insertion, analogue à
// isVOfVAdded/withSecondaryDominantOfV : chaque dominante secondaire vise un
// degré DIFFÉRENT (donc une règle d'insertion différente), rien de plus
// générique n'est donc tenté ici pour l'instant — seul le V/V, seul cas
// demandé, a sa logique réellement câblée.
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

// Explication générale des cadences (page 2 d'EnrichmentPanelContent),
// placeholder à reformuler plus tard — même rôle que
// SECONDARY_DOMINANT_EXPLANATION pour la page 1.
const CADENCE_EXPLANATION =
  "Une cadence est une formule harmonique qui conclut (ou suspend) une phrase musicale, en général en fin de progression. Certaines referment complètement (parfaite), d'autres restent ouvertes (demi-cadence) ou surprennent l'oreille (rompue).";

// Pages d'EnrichmentPanelContent, dans leur ordre d'affichage (voir pageIndex
// plus bas). STRUCTURE EXTENSIBLE : ajouter une 3e page plus tard ne demande
// qu'une entrée ici (son titre) + son propre bloc de rendu conditionnel dans
// EnrichmentPanelContent — la navigation par flèches et l'indicateur "X/N"
// s'appuient sur ENRICHMENT_PAGE_TITLES.length, jamais sur "2" en dur.
const ENRICHMENT_PAGE_TITLES = ['Dominantes secondaires', 'Cadences'];

type EnrichmentPanelContentProps = {
  // Voir le commentaire équivalent sur AccompanimentPanelContentProps :
  // piloté par ResultScreen, ce composant reste TOUJOURS monté (enfant de
  // SlidePanel) — "isOpen" sert ici à réinitialiser page/cadence
  // sélectionnées à l'ouverture (ce contenu n'a pas de minuteur à arrêter).
  isOpen: boolean;
  options: SecondaryDominantOption[];
  // Cadence actuellement ajoutée à la progression (id de CADENCES), ou null
  // si aucune — vit côté ResultScreen (voir addedCadenceId), pas ici.
  addedCadenceId: string | null;
  // La détection "la progression se termine déjà par une cadence" + l'Alert
  // de confirmation vivent côté ResultScreen (voir handleAddCadence, qui a
  // besoin de filteredProgressions/isVOfVAdded, inconnus ici) : ce composant
  // se contente de transmettre QUELLE cadence l'utilisateur a choisie.
  onAddCadence: (cadenceId: string) => void;
  onRemoveCadence: () => void;
};

// Contenu du panneau "Enrichir la progression", NAVIGABLE EN PAGES (flèches
// < >, indicateur "X/N" — voir pageIndex et ENRICHMENT_PAGE_TITLES) :
// - Page 1 : dominantes secondaires (V/V), inchangée par rapport à avant.
// - Page 2 : cadences (voir CADENCES dans ../dataset/cadences.ts).
//
// RÉVERSIBILITÉ (page 1 ET page 2) : chaque enrichissement est un
// INTERRUPTEUR dont l'état vit côté ResultScreen (isVOfVAdded/addedCadenceId)
// — jamais une mutation permanente des degrés d'origine — donc annuler
// revient TOUJOURS exactement à la progression de départ (voir
// withSecondaryDominantOfV / withCadence, qui repartent toujours des degrés
// bruts plutôt que d'un état accumulé). Cette logique n'a PAS changé.
//
// N'est QUE le contenu : le glissement, la carte, le bouton fermer et le
// défilement sont fournis par SlidePanel (voir son utilisation dans
// ResultScreen) — ce composant ne gère plus lui-même ni translateY, ni sa
// propre largeur/hauteur : "isOpen" ne sert plus ici qu'à réinitialiser
// page/cadence sélectionnées à l'ouverture.
function EnrichmentPanelContent({
  isOpen,
  options,
  addedCadenceId,
  onAddCadence,
  onRemoveCadence,
}: EnrichmentPanelContentProps) {
  // Page actuellement affichée (0 = dominantes secondaires, 1 = cadences).
  const [pageIndex, setPageIndex] = useState(0);

  // Cadence actuellement mise en évidence dans la liste de la page 2, AVANT
  // tout ajout — le choix ne devient réel qu'au tap sur "Ajouter cette
  // cadence" (voir handlePressAdd). Locale à ce composant, comme
  // selectedVoicingId dans VoicingPanelContent.
  const [selectedCadenceId, setSelectedCadenceId] = useState(CADENCES[0].id);

  // Réinitialise page/cadence sélectionnées à l'OUVERTURE (isOpen passant à
  // true) : ce composant étant toujours monté (enfant de SlidePanel, voir
  // son commentaire), c'était auparavant le remontage à chaque ouverture qui
  // remettait ces 2 states à zéro — il faut donc le faire explicitement ici
  // pour garder exactement le même comportement qu'avant (toujours repartir
  // de la page 1 et du 1er choix de cadence).
  useEffect(() => {
    if (isOpen) {
      setPageIndex(0);
      setSelectedCadenceId(CADENCES[0].id);
    }
  }, [isOpen]);

  // Boucle aux extrémités (dernière page → 1re et inversement) : même
  // convention que la navigation entre renversements de PianoChord
  // (goToPreviousInversion/goToNextInversion), appliquée ici aux PAGES du
  // panneau plutôt qu'aux renversements d'un accord.
  const goToPreviousPage = () => {
    setPageIndex(
      (current) => (current - 1 + ENRICHMENT_PAGE_TITLES.length) % ENRICHMENT_PAGE_TITLES.length,
    );
  };

  const goToNextPage = () => {
    setPageIndex((current) => (current + 1) % ENRICHMENT_PAGE_TITLES.length);
  };

  const handlePressAdd = () => {
    onAddCadence(selectedCadenceId);
  };

  return (
    <>
      {/* Navigation entre pages : flèches < >, indicateur "X/N" au milieu. */}
      <View style={styles.enrichmentPageNavRow}>
        <Pressable style={styles.enrichmentPageArrowButton} onPress={goToPreviousPage}>
          <Text style={styles.enrichmentPageArrowLabel}>{'<'}</Text>
        </Pressable>

        <Text style={styles.enrichmentPageIndicator}>
          {pageIndex + 1}/{ENRICHMENT_PAGE_TITLES.length}
        </Text>

        <Pressable style={styles.enrichmentPageArrowButton} onPress={goToNextPage}>
          <Text style={styles.enrichmentPageArrowLabel}>{'>'}</Text>
        </Pressable>
      </View>

      <Text style={styles.modalTitle}>{ENRICHMENT_PAGE_TITLES[pageIndex]}</Text>

      {pageIndex === 0 && (
        <>
          <Text style={styles.modalExplanation}>{SECONDARY_DOMINANT_EXPLANATION}</Text>

          {options.map((option) => {
            // Désactivé UNIQUEMENT si l'option n'est pas déjà active ET
            // qu'elle ne peut pas l'être (ex: pas de V dans la
            // progression) : une option déjà activée reste toujours
            // retirable, même si la condition qui avait permis de
            // l'ajouter ne tenait plus.
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
        </>
      )}

      {pageIndex === 1 && (
        <>
          <Text style={styles.modalExplanation}>{CADENCE_EXPLANATION}</Text>

          {/* Liste compacte des 4 cadences (voir CADENCES), sélection
              unique — même convention visuelle que les boutons de
              VoicingPanelContent/TonalityModal, préférée à un vrai menu
              déroulant natif (React Native n'en fournit pas sans dépendance
              supplémentaire, pas nécessaire ici pour seulement 4 choix). */}
          <View style={styles.cadenceOptionsRow}>
            {CADENCES.map((cadence) => {
              const isSelected = cadence.id === selectedCadenceId;
              return (
                <Pressable
                  key={cadence.id}
                  style={[
                    styles.cadenceOptionButton,
                    isSelected && styles.cadenceOptionButtonSelected,
                  ]}
                  onPress={() => setSelectedCadenceId(cadence.id)}
                >
                  <Text style={styles.cadenceOptionButtonLabel}>{cadence.name}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* 2 boutons séparés (contrairement à la page 1) : "Ajouter" agit
              toujours sur la cadence sélectionnée ci-dessus (elle peut
              remplacer une cadence déjà ajoutée, ou avertir si la
              progression se termine déjà naturellement par une cadence —
              voir handleAddCadence côté ResultScreen) ; "Retirer" n'apparaît
              que s'il y a réellement quelque chose à retirer. */}
          <Pressable style={styles.enrichmentToggleButton} onPress={handlePressAdd}>
            <Text style={styles.enrichmentToggleButtonLabel}>Ajouter cette cadence</Text>
          </Pressable>

          {addedCadenceId !== null && (
            <Pressable
              style={[styles.enrichmentToggleButton, styles.enrichmentToggleButtonSelected]}
              onPress={onRemoveCadence}
            >
              <Text style={styles.enrichmentToggleButtonLabel}>Retirer la cadence ajoutée</Text>
            </Pressable>
          )}
        </>
      )}
    </>
  );
}

export default function ResultScreen() {
  // Émotion + style choisis sur les deux écrans précédents, reçus via les params de route.
  const { emotion, style } = useRoute<ImproResultRoute>().params;
  // Pour le lien "Modifier" de la carte du haut (voir la carte plus bas) :
  // ImproResult n'est atteint que depuis ImproChoices ("Voir les
  // progressions"), donc goBack() y ramène toujours directement.
  const navigation = useNavigation<ImproResultNavigation>();

  const { addXp } = useProfile();
  const { debloquerSucces } = useSucces();
  const { avancerQuete } = useQuetes();

  // FEEDBACK XP — "+30 XP" affiché brièvement après avoir tapé "Terminer
  // l'exercice" (voir handleFinishExercise plus bas), puis effacé tout seul
  // après XP_FEEDBACK_DURATION_MS. Le ref garde le minuteur en cours pour
  // pouvoir l'annuler proprement (double-tap rapide, ou démontage de l'écran
  // avant la fin du délai) — même pattern que settleTimeoutRef dans
  // CourseParcoursScreen.tsx.
  const [xpFeedback, setXpFeedback] = useState<string | null>(null);
  const xpFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (xpFeedbackTimeoutRef.current) {
        clearTimeout(xpFeedbackTimeoutRef.current);
      }
    };
  }, []);

  // DÉCLENCHEUR XP CHOISI — ces exercices d'impro sont surtout exploratoires
  // (pas de fin naturelle : accompagnement/voicing/enrichissement peuvent se
  // consulter dans n'importe quel ordre, indéfiniment) : il n'existait donc
  // aucun moment "terminé" déjà identifiable dans le code. Choix retenu :
  // un bouton "Terminer l'exercice" explicite, ajouté en bas de cet écran de
  // résultat (voir plus bas dans le JSX) — l'utilisateur décide lui-même
  // quand il considère avoir fini d'explorer cette progression.
  //
  // TODO: éviter de re-donner l'XP pour un contenu déjà complété (nécessite
  // la progression) — pour cette première version, l'XP est donné à CHAQUE
  // tap, même répété (voir la consigne).
  const handleFinishExercise = async () => {
    const { error } = await addXp(XP_EXERCICE);
    if (error) {
      Alert.alert('Erreur', error);
      return;
    }

    // QUÊTES DU JOUR — même principe que LessonCourseScreen.handleFinishLesson
    // (voir son commentaire) : le gain d'XP fait avancer 'xp_jour' du montant
    // réellement gagné, ET "terminer un exercice" fait avancer 'exercices_jour'
    // séparément. "void" : ne bloque jamais le feedback XP ci-dessous.
    void avancerQuete('xp_jour', XP_EXERCICE);
    void avancerQuete('exercices_jour', 1);

    setXpFeedback(`+${XP_EXERCICE} XP`);
    if (xpFeedbackTimeoutRef.current) {
      clearTimeout(xpFeedbackTimeoutRef.current);
    }
    xpFeedbackTimeoutRef.current = setTimeout(() => setXpFeedback(null), XP_FEEDBACK_DURATION_MS);
  };

  const emotionLabel = MOODS.find((mood) => mood.value === emotion)?.label ?? emotion;

  // Filtrage par ÉMOTION uniquement, comme avant : le style n'est pas encore
  // utilisé pour filtrer (le champ `style` n'existe pas dans Progression), et
  // les données/le filtrage eux-mêmes ne changent pas ici — seul l'affichage
  // ci-dessous change.
  const filteredProgressions = PROGRESSIONS.filter(
    (progression) => progression.emotion === emotion
  );

  // SUCCÈS "Improvisateur novice" — DÉCLENCHEUR CHOISI : l'arrivée sur cet
  // écran de résultat avec au moins UNE progression réellement trouvée pour
  // l'émotion/le style choisis sur ImproChoicesScreen (filteredProgressions
  // non vide). C'est le moment où l'impro libre a concrètement "généré une
  // progression" pour l'utilisateur — pas le tap sur "Voir les progressions"
  // côté ImproChoicesScreen, qui ne sait pas encore si la recherche
  // aboutira. Effet au MONTAGE uniquement (tableau de dépendances vide) :
  // emotion/style sont des paramètres de route FIXES pour la durée de vie de
  // cet écran (ImproChoicesScreen crée une nouvelle instance à chaque
  // "Voir les progressions"), pas la peine de revérifier à chaque re-render.
  useEffect(() => {
    if (filteredProgressions.length > 0) {
      void debloquerSucces('improvisateur_novice');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // STATE DU PANNEAU "DÉCOUVRIR UN ACCOMPAGNEMENT" : ouvert/fermé,
  // indépendant de tout accord sélectionné. Passé en prop à la fois à
  // SlidePanel (qui anime son ouverture/fermeture) et à
  // AccompanimentPanelContent (qui l'utilise pour savoir quand arrêter son
  // séquenceur d'arpège — voir son commentaire ; ce contenu reste désormais
  // TOUJOURS monté, contrairement à l'ancienne Modal qui démontait
  // entièrement à la fermeture).
  const [isAccompanimentPanelOpen, setIsAccompanimentPanelOpen] = useState(false);

  // STATE DU PANNEAU "DÉCOUVRIR LE VOICING" : même principe que
  // isAccompanimentPanelOpen ci-dessus.
  const [isVoicingPanelOpen, setIsVoicingPanelOpen] = useState(false);

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
  const [isEnrichmentPanelOpen, setIsEnrichmentPanelOpen] = useState(false);

  // Condition d'activation de l'option "Ajouter un V/V" (voir
  // EnrichmentPanelContent) : au moins UNE des progressions actuellement affichées
  // doit contenir un "V", sinon l'activer n'aurait absolument aucun effet
  // visible nulle part sur cet écran.
  const anyProgressionHasV = filteredProgressions.some((progression) =>
    progression.degrees.includes('V'),
  );

  // Partagé par le V/V ET les cadences (voir toggleVOfV/handleAddCadence/
  // handleRemoveCadence plus bas) : insérer ou retirer un enrichissement
  // DÉCALE les index des accords situés après le point d'insertion (voir
  // ChordPosition.chordIndex) — un niveau d'enrichissement ou un accord
  // "déplié" mémorisé PAR INDEX pourrait donc se retrouver associé au
  // MAUVAIS accord après le décalage. Réinitialiser sélection et niveaux à
  // chaque changement de forme de la progression est le choix le plus
  // simple et le plus sûr pour l'éviter, plutôt que de tenter de
  // "réaligner" les anciens index.
  const resetProgressionUiState = () => {
    setSelected(null);
    setEnrichmentLevels(new Map());
  };

  const toggleVOfV = () => {
    setIsVOfVAdded((current) => !current);
    resetProgressionUiState();
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

  // STATE DE LA CADENCE AJOUTÉE : même principe que isVOfVAdded ci-dessus,
  // mais mémorise QUELLE cadence (son id dans CADENCES) plutôt qu'un simple
  // booléen, puisqu'il y a 4 choix possibles au lieu d'un seul. null = pas
  // de cadence ajoutée. Un SEUL id global, appliqué à TOUTES les
  // progressions affichées (voir withCadence dans le rendu plus bas) : même
  // choix que pour le V/V, pour la même raison (garder un modèle mental
  // simple plutôt qu'un état par progression).
  const [addedCadenceId, setAddedCadenceId] = useState<string | null>(null);

  // AJOUT D'UNE CADENCE : avant d'appliquer le choix, on vérifie si une
  // progression affichée se termine DÉJÀ par une cadence (findExistingCadence,
  // appliquée aux degrés APRÈS V/V — les 2 enrichissements se composent dans
  // cet ordre, voir displayedDegrees plus bas). Cette vérification porte sur
  // les degrés D'ORIGINE (+ V/V), jamais sur un ajout précédent de cette
  // même fonctionnalité : withCadence repart toujours de zéro à chaque
  // rendu (voir son commentaire dans cadences.ts), donc passer d'une cadence
  // à une autre déjà ajoutée par CE bouton ne redéclenche PAS l'avertissement
  // — seule une fin de progression NATURELLEMENT proche d'une cadence
  // (dans les données d'origine) le déclenche.
  //
  // Si une cadence existante est détectée : Alert à 2 choix, "Annuler" (rien
  // ne change) ou "Remplacer la fin" (applique le nouveau choix — c'est
  // withCadence, appelé au rendu, qui se charge réellement de retirer
  // l'ancienne fin avant d'ajouter la nouvelle). Sinon, le choix s'applique
  // directement, sans interruption.
  const handleAddCadence = (cadenceId: string) => {
    const hasExistingCadence = filteredProgressions.some((progression) => {
      const baseDegrees = withSecondaryDominantOfV(progression.degrees, isVOfVAdded);
      return findExistingCadence(baseDegrees) !== null;
    });

    if (hasExistingCadence) {
      Alert.alert(
        'Cadence déjà présente',
        'Cette progression se termine déjà par une cadence. Veux-tu remplacer sa fin par la cadence choisie ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Remplacer la fin',
            onPress: () => {
              setAddedCadenceId(cadenceId);
              resetProgressionUiState();
            },
          },
        ],
      );
      return;
    }

    setAddedCadenceId(cadenceId);
    resetProgressionUiState();
  };

  const handleRemoveCadence = () => {
    setAddedCadenceId(null);
    resetProgressionUiState();
  };

  return (
    // Enveloppe supplémentaire (absente avant) : les 3 SlidePanel doivent se
    // positionner en "absolute" par rapport à TOUT l'écran (pour glisser
    // depuis le haut par-dessus le contenu, voir plus bas), pas seulement
    // par rapport au contenu défilant du ScrollView — ils doivent donc être
    // des FRÈRES du ScrollView, pas des enfants, tous dans ce conteneur
    // commun.
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={theme.text.title}>Résultat</Text>

      {/* CARTE DU HAUT : regroupe tout ce qui décrit le contexte de la
          progression (style, tonalité + son changement, retour aux choix
          émotion/style) — remplace les anciens boutons "Romantique"/
          "Do majeur" qui flottaient indépendamment en haut de l'écran. */}
      <View style={styles.summaryCard}>
        {/* "style" est désormais optionnel (voir ExercisesStackParamList) :
            ImproChoicesScreen laisse voir les progressions sans en choisir
            un. Sans ce garde, "undefined" s'afficherait littéralement ici —
            même calcul qu'avant, seulement réétiqueté "Style : ". */}
        <Text style={styles.summaryLabel}>
          Style : {style ? `${emotionLabel} · ${style}` : emotionLabel}
        </Text>

        {/* Toute la rangée reste le bouton qui ouvre TonalityModal (même
            comportement qu'avant, simplement réintégré dans la carte au
            lieu d'être un bouton flottant à part) ; "Changer" à droite
            rend l'affordance de tap explicite. */}
        <Pressable style={styles.summaryTonalityRow} onPress={() => setIsTonalityModalOpen(true)}>
          <Text style={styles.summaryLabel}>Tonalité : {tonalityLabel}</Text>
          <Text style={styles.summaryTonalityChangeLabel}>Changer</Text>
        </Pressable>

        {/* Lien "modifier" : ImproResult n'est atteint que depuis
            ImproChoices, donc goBack() y ramène toujours directement (voir
            le commentaire sur "navigation" plus haut). */}
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.summaryEditLink}>Modifier l'émotion et le style</Text>
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

      {filteredProgressions.length > 0 ? (
        filteredProgressions.map((progression, progressionIndex) => {
          // Degrés RÉELLEMENT affichés pour cette progression : ceux
          // d'origine, avec le V/V inséré juste avant son premier V si
          // isVOfVAdded est actif ET que cette progression contient un V
          // (voir withSecondaryDominantOfV — une progression sans V n'est pas
          // affectée), PUIS la cadence ajoutée (le cas échéant) en fin de
          // liste (voir withCadence) — les 2 enrichissements se COMPOSENT
          // dans cet ordre : V/V d'abord (il s'insère au milieu), cadence
          // ensuite (elle s'ajoute toujours à la toute fin).
          const displayedDegrees = withCadence(
            withSecondaryDominantOfV(progression.degrees, isVOfVAdded),
            addedCadenceId,
          );

          return (
            <View key={progressionIndex} style={styles.progressionBlock}>
              {/* ÉLÉMENT CENTRAL DE LA PAGE : les degrés en carrés homogènes
                  (largeur = hauteur, voir DEGREE_SQUARE_SIZE), sans espace
                  entre eux (marginLeft négatif sur degreeSquare, qui fait
                  chevaucher/partager la bordure du voisin) pour l'effet
                  "suite reliée visuellement" — seuls le 1er et le dernier
                  carré arrondissent leur coin extérieur (degreeSquareFirst/
                  degreeSquareLast), comme un "segmented control". Cliquer
                  garde son rôle actuel : déplier le piano de l'accord. */}
              <View style={styles.degreeSequenceRow}>
                {displayedDegrees.map((degree, chordIndex) => {
                  const position: ChordPosition = { progressionIndex, chordIndex };
                  const isSelected = samePosition(selected, position);
                  const isFirst = chordIndex === 0;
                  const isLast = chordIndex === displayedDegrees.length - 1;

                  return (
                    <Pressable
                      key={chordIndex}
                      style={[
                        styles.degreeSquare,
                        isFirst && styles.degreeSquareFirst,
                        isLast && styles.degreeSquareLast,
                        isSelected && styles.degreeSquareSelected,
                      ]}
                      onPress={() => toggleSelection(position)}
                    >
                      <Text style={styles.degreeSquareLabel} numberOfLines={1}>
                        {degree}
                      </Text>
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

      {/* EN BAS : les 3 actions globales (indépendantes de l'accord/de la
          progression sélectionnée, voir leur commentaire d'origine plus haut
          dans ce fichier), désormais en pleine largeur, empilées, de largeur
          égale — un seul style partagé (actionButton) plutôt que 3 styles
          quasi identiques, puisqu'elles doivent justement se ressembler. */}
      <View style={styles.actionButtonsColumn}>
        <Pressable style={styles.actionButton} onPress={() => setIsAccompanimentPanelOpen(true)}>
          <Text style={styles.actionButtonIcon}>🎵</Text>
          <Text style={styles.actionButtonLabel}>Découvrir un accompagnement</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => setIsVoicingPanelOpen(true)}>
          <Text style={styles.actionButtonIcon}>🎹</Text>
          <Text style={styles.actionButtonLabel}>Découvrir le voicing</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => setIsEnrichmentPanelOpen(true)}>
          <Text style={styles.actionButtonIcon}>✨</Text>
          <Text style={styles.actionButtonLabel}>Enrichir la progression</Text>
        </Pressable>
      </View>

      {/* "Terminer l'exercice" — voir le commentaire sur handleFinishExercise
          plus haut pour pourquoi ce bouton (et pas un point de complétion
          déjà existant) a été choisi comme déclencheur d'XP. Séparé des 3
          actions "découvrir..." ci-dessus (secondaires, exploratoires) :
          celui-ci est LA seule action qui conclut vraiment l'exercice. */}
      <Pressable style={styles.finishButton} onPress={handleFinishExercise}>
        <Text style={styles.finishButtonLabel}>Terminer l'exercice</Text>
      </Pressable>
      {xpFeedback && <Text style={styles.xpFeedbackText}>{xpFeedback}</Text>}
      </ScrollView>

      {/* Les 3 panneaux (voir SlidePanel.tsx) : TOUJOURS rendus (pas de
          `{isXPanelOpen && ...}`) — voir le commentaire détaillé sur
          SlidePanel pour le pourquoi (leur fermeture doit pouvoir s'animer).
          En dehors du ScrollView (frères, pas enfants) pour se positionner
          en "absolute" par rapport à l'écran entier plutôt que de défiler
          avec le contenu. Chacun reçoit son propre "isOpen" ET le retransmet
          à son contenu (voir AccompanimentPanelContent/VoicingPanelContent/
          EnrichmentPanelContent) : SlidePanel s'en sert pour l'animation, le
          contenu pour savoir quand se réinitialiser/arrêter ses éventuels
          minuteurs. */}
      <SlidePanel
        isOpen={isAccompanimentPanelOpen}
        onClose={() => setIsAccompanimentPanelOpen(false)}
      >
        <AccompanimentPanelContent isOpen={isAccompanimentPanelOpen} />
      </SlidePanel>

      <SlidePanel isOpen={isVoicingPanelOpen} onClose={() => setIsVoicingPanelOpen(false)}>
        <VoicingPanelContent isOpen={isVoicingPanelOpen} />
      </SlidePanel>

      <SlidePanel
        isOpen={isEnrichmentPanelOpen}
        onClose={() => setIsEnrichmentPanelOpen(false)}
      >
        <EnrichmentPanelContent
          isOpen={isEnrichmentPanelOpen}
          options={secondaryDominantOptions}
          addedCadenceId={addedCadenceId}
          onAddCadence={handleAddCadence}
          onRemoveCadence={handleRemoveCadence}
        />
      </SlidePanel>
    </View>
  );
}

const styles = StyleSheet.create({
  // Conteneur racine : nécessaire pour que les 3 SlidePanel (position
  // 'absolute') se positionnent par rapport à TOUT l'écran, en frères du
  // ScrollView plutôt qu'en enfants (voir le commentaire dans le rendu).
  screen: {
    flex: 1,
  },
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
  // Rangée des carrés de degré (voir DEGREE_SQUARE_SIZE) : centrée et
  // capable de passer à la ligne (flexWrap) pour ne JAMAIS déborder sur un
  // écran étroit, même avec une progression longue (V/V + cadence ajoutés).
  // alignSelf: 'center' recentre aussi le groupe quand il est plus étroit
  // que l'écran, plutôt que de le laisser collé à gauche.
  degreeSequenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  degreeSquare: {
    width: DEGREE_SQUARE_SIZE,
    height: DEGREE_SQUARE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    // Chevauche le bord gauche du voisin (au lieu d'un "gap") : les carrés
    // se touchent et partagent une seule ligne de bordure plutôt que d'en
    // afficher 2 côte à côte — c'est ce qui donne l'effet "suite reliée
    // visuellement" demandé, plutôt que des bulles séparées.
    marginLeft: -1,
  },
  // Arrondit SEULEMENT le coin extérieur du 1er et du dernier carré d'une
  // rangée (comme un "segmented control" natif) : le reste de la suite
  // garde des angles droits, cohérent avec la consigne "boutons carrés" —
  // seules les 2 extrémités du groupe entier sont adoucies.
  degreeSquareFirst: {
    marginLeft: 0,
    borderTopLeftRadius: theme.radius.sm,
    borderBottomLeftRadius: theme.radius.sm,
  },
  degreeSquareLast: {
    borderTopRightRadius: theme.radius.sm,
    borderBottomRightRadius: theme.radius.sm,
  },
  // Même convention que partout ailleurs dans ce fichier pour un état
  // "sélectionné" : fond plein en couleur d'accent (primary).
  degreeSquareSelected: {
    backgroundColor: theme.colors.primary,
  },
  degreeSquareLabel: {
    fontSize: theme.text.size.md,
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
  // chips, même famille visuelle (surface/primary, sélection en fond plein)
  // que les autres boutons de choix de ce fichier.
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
  // CARTE DU HAUT : regroupe style/tonalité/lien modifier (voir le rendu).
  // Mêmes tokens de couleur que les anciens boutons flottants qu'elle
  // remplace (surface + bordure primary) : palette INCHANGÉE, seule la
  // structure (un seul conteneur délimité, plutôt que des boutons épars)
  // change.
  summaryCard: {
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    padding: theme.spacing.md,
  },
  summaryLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // Toute la rangée reste pressable (voir le rendu) : "Changer" à droite
  // rend explicite qu'elle ouvre TonalityModal, sans changer son
  // comportement (déjà le cas avant, sur l'ancien bouton "tonalityButton").
  summaryTonalityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  // Pas de token "texte de lien secondaire" dans le thème : primary (couleur
  // d'accent) + soulignement, même convention que learnMoreButtonLabel plus
  // bas dans ce fichier pour la même raison (signaler une action secondaire,
  // discrète, sans lui donner tout le poids visuel d'un bouton plein).
  summaryTonalityChangeLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  summaryEditLink: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  // EN BAS : les 3 actions globales, pleine largeur et empilées (voir le
  // rendu) — un SEUL style partagé pour les 3 (plutôt que 3 styles quasi
  // identiques comme avant, un par bouton) puisqu'elles doivent justement
  // être visuellement IDENTIQUES en forme/taille, seuls icône et libellé
  // changent. Mêmes tokens (surface + bordure primary) que les anciens
  // boutons qu'il remplace : palette inchangée.
  actionButtonsColumn: {
    gap: theme.spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  // Emoji plutôt qu'une icône vectorielle : @expo/vector-icons n'est pas
  // installé dans ce projet (déjà vérifié/signalé pour InteractivePiano) —
  // même repli, cohérent avec le reste de l'app.
  actionButtonIcon: {
    fontSize: theme.text.size.lg,
  },
  actionButtonLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  // "Terminer l'exercice" : plein (pas juste un contour comme actionButton
  // ci-dessus) pour se démarquer comme LA conclusion de l'écran, pas une
  // simple option à explorer.
  finishButton: {
    width: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  // Pas de token "texte sur fond coloré" dans le thème (theme.colors.text
  // est pensé pour du texte sur le fond neutre de l'app) : blanc en dur ici,
  // comme déjà fait ailleurs dans l'app pour ce même besoin (ex:
  // LessonCourseScreen, ProfileScreen).
  finishButtonLabel: {
    fontSize: theme.text.size.lg,
    fontWeight: theme.text.weight.semibold,
    color: '#FFFFFF',
  },
  // Feedback XP discret : simple texte centré sous le bouton, pas de fond ni
  // de carte — ce n'est qu'une confirmation brève, pas un élément durable de
  // l'écran (voir XP_FEEDBACK_DURATION_MS, qui l'efface tout seul).
  xpFeedbackText: {
    textAlign: 'center',
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.bold,
    color: theme.colors.achievementUnlocked,
  },
  // Carte d'UNE option de dominante secondaire (EnrichmentPanelContent) : même fond
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
  // Navigation entre pages d'EnrichmentPanelContent : flèches + indicateur "X/N" au
  // centre, même principe visuel que inversionRow dans PianoChord.tsx
  // (bouton précédent, indicateur, bouton suivant).
  enrichmentPageNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  enrichmentPageArrowButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  enrichmentPageArrowLabel: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
  },
  enrichmentPageIndicator: {
    fontSize: theme.text.size.md,
    fontWeight: theme.text.weight.medium,
    color: theme.colors.textMuted,
  },
  // Liste compacte des 4 cadences (page "Cadences" d'EnrichmentPanelContent) : même
  // famille visuelle que voicingOptionsRow/voicingOptionButton (VoicingPanelContent).
  cadenceOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  cadenceOptionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  cadenceOptionButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  cadenceOptionButtonLabel: {
    fontSize: theme.text.size.sm,
    fontWeight: theme.text.weight.semibold,
    color: theme.colors.text,
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
  // Onglets de sélection d'accompagnement (AccompanimentPanelContent) : même
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
  // Boutons de voicing (VoicingPanelContent) : même famille visuelle que les
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
  // pour un état "sélectionné" (voir aussi degreeSquare).
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
