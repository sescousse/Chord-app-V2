// Lecture de N'IMPORTE QUELLE note de piano par INTERPOLATION à partir des
// samples réellement disponibles (espacés d'une tierce mineure — 3 demi-tons
// — voir SAMPLE_SOURCES ci-dessous) : on choisit le sample le plus proche de
// la note demandée, puis on le pitch-shifte du nombre de demi-tons manquant
// (voir calculerCorrespondanceSample plus bas pour le calcul exact).
//
// Périmètre : jouerNote() joue UNE note ; jouerAccord() joue PLUSIEURS notes
// EN MÊME TEMPS (accord plaqué, voir plus bas). Toujours PAS d'arpège/
// accompagnement (une séquence dans le temps) : ça reste une étape séparée.
//
// GESTION DES RESSOURCES — CE QUI A CHANGÉ ICI ET POURQUOI : la version
// précédente de jouerAccord() appelait createAudioPlayer() À CHAQUE NOTE DE
// CHAQUE ACCORD (un player "éphémère" jetable), en comptant sur l'évènement
// "didJustFinish" pour le libérer ensuite (remove()). En pratique, un player
// qu'on interrompt avant sa fin naturelle (accord suivant tapé trop vite,
// cas limites de la plateforme où l'évènement de fin ne se déclenche pas de
// façon fiable) ne voit parfois JAMAIS ce "didJustFinish" — son remove()
// n'était alors jamais appelé, et le player natif restait chargé en mémoire
// pour toujours. Répété à chaque note de chaque accord joué, ça épuise la
// limite de sons simultanés du système : plus aucun son ne sort, jusqu'à
// relancer l'app. Voir le POOL DE VOIX plus bas, qui élimine structurellement
// ce risque (plus aucun createAudioPlayer() après le démarrage).
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { Note } from 'tonal';

// --- SAMPLES DISPONIBLES --------------------------------------------------
// Un sample tous les 3 demi-tons (tierce mineure), de C3 à C6 — vérifié sur
// le contenu réel de src/dataset/piano songs/ (13 fichiers). Clés = noms de
// notes Tonal (dièse, pas bémol — Note.midi() gère les deux mais garder une
// seule convention ici évite toute ambiguïté à la lecture).
//
// Tous les fichiers sont maintenant des .mp3 (Ds4 était en .wav, reconverti
// depuis) — plus de cas particulier d'extension à signaler.
//
// require() renvoie un id de module (number) typé "any" par défaut (aucune
// déclaration TypeScript dédiée aux .mp3 dans ce projet) — l'annotation
// ": Record<string, number>" sur la constante absorbe ce "any" au lieu de le
// laisser se propager.
const SAMPLE_SOURCES: Record<string, number> = {
  C3: require('../dataset/piano songs/C3.mp3'),
  'D#3': require('../dataset/piano songs/Ds3.mp3'),
  'F#3': require('../dataset/piano songs/Fs3.mp3'),
  A3: require('../dataset/piano songs/A3.mp3'),
  C4: require('../dataset/piano songs/C4.mp3'),
  'D#4': require('../dataset/piano songs/Ds4.mp3'),
  'F#4': require('../dataset/piano songs/Fs4.mp3'),
  A4: require('../dataset/piano songs/A4.mp3'),
  C5: require('../dataset/piano songs/C5.mp3'),
  'D#5': require('../dataset/piano songs/Ds5.mp3'),
  'F#5': require('../dataset/piano songs/Fs5.mp3'),
  A5: require('../dataset/piano songs/A5.mp3'),
  C6: require('../dataset/piano songs/C6.mp3'),
};

type PianoSample = {
  // Nom Tonal de la note DU SAMPLE (ex: "D#3") — pas la note demandée par
  // l'appelant, voir calculerCorrespondanceSample plus bas.
  note: string;
  // Hauteur MIDI de cette note (ex: 51 pour D#3), calculée UNE SEULE FOIS
  // ci-dessous — sert à comparer les distances en demi-tons.
  midi: number;
  source: number;
};

// Construite UNE SEULE FOIS au chargement du module (pas à chaque appel de
// jouerNote) : la liste des samples ne change jamais à l'exécution.
const SAMPLES: PianoSample[] = Object.entries(SAMPLE_SOURCES).map(([note, source]) => {
  const midi = Note.midi(note);
  if (midi === null) {
    // Ne peut arriver qu'en cas de faute de frappe dans SAMPLE_SOURCES
    // ci-dessus (nom de note invalide) — on préfère planter tout de suite au
    // chargement du module plutôt que d'ignorer silencieusement un sample.
    throw new Error(`Nom de note invalide dans SAMPLE_SOURCES : "${note}"`);
  }
  return { note, midi, source };
});

// --- RECHERCHE DU SAMPLE LE PLUS PROCHE -----------------------------------
// Recherche linéaire simple (13 samples au total, inutile d'optimiser avec
// une structure triée/dichotomique pour si peu d'éléments) : on parcourt
// tous les samples et on garde celui dont la hauteur MIDI est la plus proche
// de targetMidi (distance absolue la plus petite). En cas d'égalité parfaite
// (n'arrive pas avec cet espacement de 3 demi-tons : aucune note demandée
// n'est jamais à égale distance de 2 samples), le premier trouvé gagne.
function findNearestSample(targetMidi: number): PianoSample {
  let nearest = SAMPLES[0];
  let smallestDistance = Math.abs(SAMPLES[0].midi - targetMidi);

  for (const sample of SAMPLES) {
    const distance = Math.abs(sample.midi - targetMidi);
    if (distance < smallestDistance) {
      nearest = sample;
      smallestDistance = distance;
    }
  }

  return nearest;
}

// Ce que jouerNote()/jouerAccord() renvoient : utile pour un appelant qui
// veut afficher QUEL sample a été choisi et de combien il a été décalé.
export type LectureNoteResult = {
  noteJouee: string;
  sampleUtilise: string;
  decalageDemiTons: number;
};

type CorrespondanceSample = {
  sample: PianoSample;
  semitoneOffset: number;
  rate: number;
};

// Calcule, pour une note demandée, LE sample le plus proche ET le rate à lui
// appliquer pour qu'il sonne exactement à cette hauteur.
function calculerCorrespondanceSample(note: string): CorrespondanceSample {
  const targetMidi = Note.midi(note);
  if (targetMidi === null) {
    throw new Error(`Note invalide : "${note}"`);
  }

  const sample = findNearestSample(targetMidi);

  // Écart en demi-tons entre la note demandée et le sample choisi : positif
  // si la note demandée est plus AIGUË que le sample (il faut l'accélérer),
  // négatif si elle est plus GRAVE (il faut le ralentir).
  const semitoneOffset = targetMidi - sample.midi;

  // LA formule de transposition : en gamme tempérée, une octave (12 demi-
  // tons) correspond à un doublement de fréquence, et les 12 demi-tons se
  // répartissent ÉGALEMENT sur ce doublement (progression géométrique, pas
  // arithmétique) — donc UN demi-ton correspond à un facteur multiplicatif
  // de 2^(1/12) ≈ 1,0595. Décaler de N demi-tons revient à multiplier la
  // vitesse de lecture (rate) par 2^(N/12) : N positif accélère (plus aigu),
  // N négatif ralentit (plus grave).
  const rate = Math.pow(2, semitoneOffset / 12);

  return { sample, semitoneOffset, rate };
}

// --- CONFIGURATION AUDIO ---------------------------------------------------
// setAudioModeAsync (appelée UNE SEULE FOIS, voir preparerPiano) :
// - playsInSilentMode: true — sans ça, sur iOS, le loquet "silencieux" du
//   téléphone couperait TOUT son joué par l'app, y compris les notes de
//   piano déclenchées volontairement par l'utilisateur (ce n'est pas une
//   notification système qu'on voudrait voir respecter ce loquet).
// - allowsRecording: false (explicite, alors que c'est déjà la valeur par
//   défaut) — cette app ne fait QUE de la lecture, jamais d'enregistrement :
//   inutile de risquer de déclencher une demande de permission micro pour ça.
// - shouldPlayInBackground: false — pas besoin que les notes continuent de
//   jouer si l'utilisateur quitte l'app, contrairement à un vrai lecteur
//   audio/vidéo.
async function configurerAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    shouldPlayInBackground: false,
  });
}

// --- POOL DE VOIX (polyphonie bornée) --------------------------------------
// VOICE_COUNT players créés UNE SEULE FOIS au démarrage (preparerPiano) et
// RECYCLÉS pour toute la durée de vie de l'app : jamais de createAudioPlayer()
// supplémentaire après ça. C'est ce qui élimine structurellement la fuite
// décrite en haut de fichier — le nombre de players natifs reste borné à
// VOICE_COUNT quel que soit le nombre de notes/accords joués au total, MÊME
// si "didJustFinish" ne se déclenchait jamais pour l'un d'eux (dans le pire
// cas, cette voix devient juste la plus "ancienne" et se fait recycler par
// vol de voix, voir reserverVoix — elle ne bloque jamais indéfiniment le
// système, contrairement à un vrai player natif jamais libéré).
//
// 16 voix : largement au-dessus de ce que peut demander un accord affiché
// dans cette app (7 notes maximum, un accord de 13e) tout en restant une
// limite raisonnable de sons simultanés pour la plateforme.
const VOICE_COUNT = 16;

type Voice = {
  player: AudioPlayer;
  // true tant que la voix est considérée comme "en train de jouer" une note
  // — remis à false dès que didJustFinish se déclenche (voir jouerSurUneVoix)
  // OU laissé à true si cette voix se fait voler avant sa fin naturelle
  // (reserverVoix la réutilise alors directement, sans jamais dépendre de ce
  // passage à false).
  busy: boolean;
  // Horodatage (Date.now()) du dernier déclenchement de cette voix — sert à
  // repérer la voix la plus ANCIENNE quand toutes sont occupées (vol de
  // voix, voir reserverVoix), et de "jeton" pour ignorer un évènement
  // didJustFinish tardif d'une lecture déjà remplacée entre-temps sur cette
  // même voix (voir triggerToken dans jouerSurUneVoix).
  declenchedAt: number;
  // Nom du sample ACTUELLEMENT chargé sur cette voix (via player.replace()),
  // ou null tant qu'aucune note n'a encore été jouée dessus — évite un
  // replace() (donc un rechargement) inutile quand la voix porte déjà
  // exactement le bon sample.
  sampleCharge: string | null;
  // Abonnement "playbackStatusUpdate" ACTUELLEMENT actif sur cette voix (ou
  // null si aucun) : gardé pour pouvoir le désabonner explicitement si la
  // voix est recyclée avant sa fin naturelle — sinon l'écouteur de la
  // lecture interrompue resterait accroché indéfiniment (fuite légère : un
  // simple callback JS, pas une ressource audio native, mais autant l'éviter).
  subscription: { remove: () => void } | null;
};

const voices: Voice[] = [];

// Promesse d'initialisation PARTAGÉE plutôt qu'un simple booléen "déjà
// préparé" : si jouerNote() et jouerAccord() sont appelées presque en même
// temps AVANT la fin de la préparation, un simple booléen mis à true dès le
// DÉBUT de preparerPiano() laisserait le 2e appel repartir immédiatement,
// alors que le pool n'est pas encore rempli (voices vide) — en repartant sur
// LA MÊME promesse, tout appelant attend la fin de la VRAIE préparation,
// peu importe qui l'a déclenchée.
let preparationEnCours: Promise<void> | null = null;

// Idempotente et sûre en cas d'appels concurrents (voir preparationEnCours
// ci-dessus) — jouerNote()/jouerAccord() l'appellent systématiquement avant
// de jouer quoi que ce soit.
export function preparerPiano(): Promise<void> {
  if (!preparationEnCours) {
    preparationEnCours = (async () => {
      await configurerAudio();

      // "null" comme source initiale : aucune voix n'a de sample chargé tant
      // qu'elle n'a pas servi une première fois (voir sampleCharge et
      // player.replace() dans jouerSurUneVoix) — pas besoin de choisir un
      // sample par défaut arbitraire ici.
      for (let i = 0; i < VOICE_COUNT; i++) {
        voices.push({
          player: createAudioPlayer(null),
          busy: false,
          declenchedAt: 0,
          sampleCharge: null,
          subscription: null,
        });
      }
    })();
  }

  return preparationEnCours;
}

// Libère les VOICE_COUNT voix (utile si ce système n'est plus utilisé du
// tout, ex: démontage définitif d'un écran dédié) — jamais appelée
// automatiquement. Remet aussi preparationEnCours à null : un preparerPiano()
// ultérieur reconstruit alors un pool neuf plutôt que de renvoyer l'ancienne
// promesse (déjà résolue, mais pointant vers un tableau vidé).
export function libererPiano(): void {
  voices.forEach((voice) => {
    voice.subscription?.remove();
    voice.player.remove();
  });
  voices.length = 0;
  preparationEnCours = null;
}

// Un player fraîchement chargé (ou rechargé via replace()) n'est pas
// forcément déjà prêt (isLoaded) : cette fonction attend que ce SOIT le cas
// avant de continuer, en écoutant playbackStatusUpdate UNE SEULE FOIS puis en
// se désabonnant — sans ça, jouer une note tout de suite après le
// changement de sample pourrait ne rien produire.
function attendreChargement(player: AudioPlayer): Promise<void> {
  if (player.isLoaded) return Promise.resolve();

  return new Promise((resolve) => {
    const subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (status.isLoaded) {
        subscription.remove();
        resolve();
      }
    });
  });
}

// Durée du micro-fade appliqué avant de voler une voix déjà occupée — assez
// court pour rester inaudible comme "fondu" à proprement parler, mais assez
// long pour éviter le CLIC net d'une coupure de volume instantanée (un saut
// brutal d'amplitude nette à 0 produit un clic audible ; un fondu, même très
// court, l'évite presque entièrement).
const VOICE_STEAL_FADE_MS = 15;
const VOICE_STEAL_FADE_STEPS = 3;

// Baisse le volume de la voix par petits paliers jusqu'à 0 puis la met en
// pause — PAS remove() : cette voix appartient au pool et doit rester
// utilisable pour la suite (voir le commentaire sur VOICE_COUNT plus haut).
function fadeOutEtCouper(voice: Voice): Promise<void> {
  return new Promise((resolve) => {
    let step = 0;
    const stepDurationMs = VOICE_STEAL_FADE_MS / VOICE_STEAL_FADE_STEPS;

    const fadeStep = () => {
      step += 1;
      voice.player.volume = Math.max(0, 1 - step / VOICE_STEAL_FADE_STEPS);

      if (step >= VOICE_STEAL_FADE_STEPS) {
        voice.player.pause();
        resolve();
        return;
      }
      setTimeout(fadeStep, stepDurationMs);
    };

    fadeStep();
  });
}

// Choisit ET réserve IMMÉDIATEMENT (busy = true, declenchedAt à jour) une
// voix du pool : une voix LIBRE en priorité, sinon la voix la plus ANCIENNE
// (vol de voix / voice stealing, la moins susceptible d'être encore
// musicalement utile — les notes plus récentes appartiennent probablement au
// même accord qu'on est justement en train de jouer).
//
// La réservation est faite ICI, de façon SYNCHRONE (avant tout "await" chez
// l'appelant) : essentiel pour qu'un accord de plusieurs notes jouées "en
// même temps" (jouerAccord, Promise.all) ne fasse jamais choisir 2 fois LA
// MÊME voix pour 2 notes différentes du même accord — sans cette réservation
// synchrone, les 2 notes pourraient toutes les deux voir la même voix comme
// "libre" (ou comme "la plus ancienne") avant qu'aucune des deux n'ait eu la
// main pour la marquer occupée.
function reserverVoix(): { voice: Voice; etaitDejaOccupee: boolean } {
  const voixLibre = voices.find((voice) => !voice.busy);
  const voice =
    voixLibre ??
    voices.reduce((plusAncienne, courante) =>
      courante.declenchedAt < plusAncienne.declenchedAt ? courante : plusAncienne,
    );

  const etaitDejaOccupee = voice.busy;

  voice.busy = true;
  voice.declenchedAt = Date.now();

  return { voice, etaitDejaOccupee };
}

type DeclenchementVoix = {
  result: LectureNoteResult;
  voice: Voice;
};

// Joue UNE note sur une voix du pool (réservée via reserverVoix) : coupe
// proprement l'ancien contenu si la voix était occupée, recharge le sample
// seulement si nécessaire, configure le pitch/rate, puis joue. La voix se
// libère TOUTE SEULE dès qu'elle a fini (didJustFinish) — voir triggerToken
// pour ignorer un évènement tardif si la voix a depuis été réutilisée pour
// une autre note.
async function jouerSurUneVoix(note: string): Promise<DeclenchementVoix> {
  const { sample, semitoneOffset, rate } = calculerCorrespondanceSample(note);
  const { voice, etaitDejaOccupee } = reserverVoix();

  if (etaitDejaOccupee) {
    await fadeOutEtCouper(voice);
  }

  // Désabonne l'écouteur de la lecture précédente sur cette voix (s'il en
  // restait un) avant d'en attacher un nouveau plus bas — sans ça, une voix
  // souvent recyclée accumulerait un écouteur mort par recyclage.
  voice.subscription?.remove();
  voice.subscription = null;

  if (voice.sampleCharge !== sample.note) {
    voice.player.replace(sample.source);
    voice.sampleCharge = sample.note;
    await attendreChargement(voice.player);
  }

  // Remet le volume au maximum : une voix qui vient d'être VOLÉE (voir
  // fadeOutEtCouper) a son volume descendu à 0 — sans ça, la nouvelle note
  // serait silencieuse.
  voice.player.volume = 1;

  // shouldCorrectPitch = false : INDISPENSABLE. Par défaut (true), la
  // plateforme compense le changement de vitesse pour garder la même
  // hauteur (time-stretching) — le rate ci-dessous n'aurait alors AUCUN
  // effet de transposition, ce qui viderait cette fonction de son intérêt.
  voice.player.shouldCorrectPitch = false;
  voice.player.setPlaybackRate(rate);

  // Jeton du déclenchement courant : si cette voix est réutilisée pour une
  // AUTRE note avant que celle-ci n'ait fini (declenchedAt change alors), un
  // évènement didJustFinish tardif de CETTE lecture-ci ne doit plus la
  // marquer comme libre (elle joue déjà autre chose) — d'où la comparaison
  // ci-dessous.
  const triggerToken = voice.declenchedAt;
  voice.subscription = voice.player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
    if (status.didJustFinish && voice.declenchedAt === triggerToken) {
      voice.subscription?.remove();
      voice.subscription = null;
      voice.busy = false;
    }
  });

  // Remet le sample au tout début avant de jouer : sans ça, une voix
  // recyclée reprendrait au milieu du fichier précédent au lieu de repartir
  // de zéro.
  await voice.player.seekTo(0);
  voice.player.play();

  return {
    result: { noteJouee: note, sampleUtilise: sample.note, decalageDemiTons: semitoneOffset },
    voice,
  };
}

// --- UNE SEULE NOTE ---------------------------------------------------------
// jouerNote("E4") par exemple : E4 n'a pas de sample propre (les samples
// sont espacés de 3 demi-tons : ..., C4, D#4, F#4, ...) — on joue donc le
// sample le plus proche (D#4, à 1 demi-ton en dessous) en le pitch-shiftant
// de +1 demi-ton pour qu'il sonne comme un E4, sur une voix du pool.
export async function jouerNote(note: string): Promise<LectureNoteResult> {
  await preparerPiano();
  const { result } = await jouerSurUneVoix(note);
  return result;
}

// --- ACCORDS PLAQUÉS (plusieurs notes en même temps) ------------------------
// jouerAccord(["C4", "E4", "G4"]) joue les 3 notes EN MÊME TEMPS (accord
// plaqué) — PAS l'une après l'autre (ça, ce serait un arpège, explicitement
// hors périmètre ici). Chaque note de l'accord réserve SA PROPRE voix du pool
// (voir reserverVoix) : pas de risque qu'une note de l'accord en coupe une
// autre, MÊME si 2 notes de l'accord retombent sur le même sample (ex: D4 et
// D#4, toutes deux plus proches du sample D#4) — chacune a sa propre voix,
// donc les 2 sonnent réellement ensemble. Promise.all lance le chargement
// des N notes EN PARALLÈLE (pas en série) : chaque note démarre sa lecture
// dès qu'ELLE est prête, sans attendre les autres — c'est ce parallélisme
// qui produit l'effet "plaqué".
export async function jouerAccord(notes: string[]): Promise<LectureNoteResult[]> {
  await preparerPiano();
  const declenchements = await Promise.all(notes.map((note) => jouerSurUneVoix(note)));
  return declenchements.map((declenchement) => declenchement.result);
}
