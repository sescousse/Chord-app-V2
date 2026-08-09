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
//
// DEUX AUTRES CORRECTIFS ICI :
// - COUPURE DU SON PRÉCÉDENT (voir stopTout) : jouerNote()/jouerAccord()
//   coupent maintenant systématiquement tout ce qui sonne encore avant de
//   jouer quoi que ce soit de nouveau, pour ne plus jamais superposer 2
//   accords/notes joués trop vite l'un après l'autre.
// - VRAIE SIMULTANÉITÉ (voir preparerVoixPourNote/declencherVoix) :
//   jouerAccord() prépare maintenant TOUTES les notes de l'accord (voix
//   réservée, sample chargé, pitch/rate réglés) AVANT d'en déclencher UNE
//   SEULE — sans cette séparation, une note dont le sample était déjà en
//   cache partait presque instantanément pendant qu'une autre, dont le
//   sample restait à charger, ne démarrait que plus tard : l'accord
//   s'égrenait au lieu de partir en bloc.
// - PRÉCHARGEMENT DÉPLACÉ (voir prechargerPiano) : n'est PLUS déclenché au
//   démarrage de l'app (ça la ralentissait inutilement pour des écrans qui
//   n'utilisent jamais le piano) — c'est maintenant l'écran d'entrée de
//   l'exercice d'improvisation (ImproIntroScreen) qui l'appelle À SON
//   MONTAGE. jouerNote()/jouerAccord() continuent malgré tout d'appeler
//   prechargerPiano() en interne avant de jouer quoi que ce soit : si le
//   piano est utilisé sans être passé par cet écran (ou si l'appel explicite
//   n'a pas encore fini), le chargement se fait alors à la volée, en secours
//   — jamais d'erreur "pas prêt", juste une latence au pire légèrement plus
//   grande pour cette première note-là.
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
// setAudioModeAsync (appelée UNE SEULE FOIS, voir prechargerPiano) :
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
// VOICE_COUNT players créés UNE SEULE FOIS (voir prechargerPiano) et
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
  // — remis à false dès que didJustFinish se déclenche (voir declencherVoix),
  // OU par stopTout()/le fade d'un vol de voix (fadeOutEtCouper), OU laissé
  // à true si cette voix se fait voler avant sa fin naturelle (reserverVoix
  // la réutilise alors directement, sans jamais dépendre de ce passage à
  // false).
  busy: boolean;
  // Horodatage (Date.now()) du dernier déclenchement de cette voix — sert à
  // repérer la voix la plus ANCIENNE quand toutes sont occupées (vol de
  // voix, voir reserverVoix), et de "jeton" pour ignorer un évènement
  // didJustFinish tardif d'une lecture déjà remplacée entre-temps sur cette
  // même voix (voir triggerToken dans preparerVoixPourNote/declencherVoix).
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
// préparé" : si l'écran d'impro ET jouerNote()/jouerAccord() (voir plus bas)
// appellent prechargerPiano() presque en même temps, AVANT la fin de la
// préparation, un simple booléen mis à true dès le DÉBUT laisserait le 2e
// appel repartir immédiatement alors que le pool n'est pas encore rempli
// (voices vide) — en repartant sur LA MÊME promesse, tout appelant attend
// la fin de la VRAIE préparation, peu importe qui l'a déclenchée.
let preparationEnCours: Promise<void> | null = null;

// PRÉCHARGEMENT — appelée EXPLICITEMENT au montage de l'écran d'entrée de
// l'exercice d'improvisation (voir ImproIntroScreen.tsx), PAS au démarrage
// de l'app : créer le pool de 16 players + charger les 13 samples a un coût
// non négligeable, inutile de le payer pour un utilisateur qui n'ouvre
// jamais cet exercice. jouerNote()/jouerAccord() l'appellent QUAND MÊME
// aussi, systématiquement, avant de jouer quoi que ce soit : c'est le
// FILET DE SÉCURITÉ si le piano est utilisé sans être passé par cet écran
// (ou avant que son appel n'ait fini) — idempotente et sûre en cas d'appels
// concurrents (voir preparationEnCours ci-dessus), donc sans risque à
// appeler depuis plusieurs endroits.
export function prechargerPiano(): Promise<void> {
  if (!preparationEnCours) {
    preparationEnCours = (async () => {
      await configurerAudio();

      // "null" comme source initiale : le vrai sample de chaque voix est
      // chargé juste après (voir le préchargement plus bas), pas ici.
      for (let i = 0; i < VOICE_COUNT; i++) {
        voices.push({
          player: createAudioPlayer(null),
          busy: false,
          declenchedAt: 0,
          sampleCharge: null,
          subscription: null,
        });
      }

      // PRÉCHARGEMENT DES SAMPLES : dès la création du pool, on charge tout
      // de suite CHAQUE sample sur sa PROPRE voix dédiée (13 samples pour
      // VOICE_COUNT = 16 voix : il en reste toujours quelques-unes vierges
      // pour la polyphonie au-delà de 13 notes simultanées). Sans ça, le
      // premier jouerNote()/jouerAccord() sur un sample donné devait
      // attendre son chargement (replace() + attendreChargement) avant de
      // pouvoir jouer — c'est cette attente, plus ou moins longue selon que
      // le sample était déjà en cache ou non, qui causait l'égrenage d'un
      // accord (certaines notes prêtes tout de suite, d'autres non).
      // reserverVoix() (plus bas) préfère ensuite, tant qu'elle est encore
      // libre, la voix qui porte déjà le bon sample — la note part alors
      // sans aucun rechargement.
      const preloadCount = Math.min(VOICE_COUNT, SAMPLES.length);
      await Promise.all(
        SAMPLES.slice(0, preloadCount).map((sample, index) => {
          const voice = voices[index];
          voice.player.replace(sample.source);
          voice.sampleCharge = sample.note;
          return attendreChargement(voice.player);
        }),
      );
    })();
  }

  return preparationEnCours;
}

// Libère les VOICE_COUNT voix — optionnel, à appeler par exemple quand
// l'utilisateur QUITTE l'exercice d'improvisation si on veut rendre la
// mémoire tout de suite plutôt que de garder le pool prêt pour un retour
// rapide dans l'exercice (compromis mémoire/latence laissé à l'appelant :
// rien n'appelle cette fonction automatiquement dans ce périmètre). Remet
// aussi preparationEnCours à null : un prechargerPiano() ultérieur
// reconstruit alors un pool neuf plutôt que de renvoyer l'ancienne promesse
// (déjà résolue, mais pointant vers un tableau vidé).
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

// Marque une voix comme réservée (busy = true, declenchedAt à jour) et
// renvoie si elle était DÉJÀ occupée avant cet appel — factorisé car
// reserverVoix (juste en dessous) a 3 issues possibles qui doivent toutes
// marquer la voix choisie de la même façon.
function marquerReservee(voice: Voice): { voice: Voice; etaitDejaOccupee: boolean } {
  const etaitDejaOccupee = voice.busy;
  voice.busy = true;
  voice.declenchedAt = Date.now();
  return { voice, etaitDejaOccupee };
}

// Choisit ET réserve IMMÉDIATEMENT une voix du pool pour jouer sampleNote,
// par ordre de préférence :
// 1) une voix LIBRE qui porte DÉJÀ ce sample (préchargée par
//    prechargerPiano(), ou réutilisée d'un jeu précédent) : aucun
//    rechargement nécessaire, la note peut partir instantanément — c'est ce
//    qui maximise les chances que toutes les notes d'un accord soient
//    prêtes en même temps ;
// 2) sinon, n'importe quelle voix LIBRE (devra recharger son sample) ;
// 3) sinon (toutes occupées), la voix la plus ANCIENNE (vol de voix / voice
//    stealing, la moins susceptible d'être encore musicalement utile — les
//    notes plus récentes appartiennent probablement au même accord qu'on
//    est justement en train de jouer).
//
// La réservation est faite ICI, de façon SYNCHRONE (avant tout "await" chez
// l'appelant) : essentiel pour qu'un accord de plusieurs notes jouées "en
// même temps" (jouerAccord, Promise.all) ne fasse jamais choisir 2 fois LA
// MÊME voix pour 2 notes différentes du même accord — sans cette réservation
// synchrone, les 2 notes pourraient toutes les deux voir la même voix comme
// "libre"/"préchargée" avant qu'aucune des deux n'ait eu la main pour la
// marquer occupée.
function reserverVoix(sampleNote: string): { voice: Voice; etaitDejaOccupee: boolean } {
  const voixLibrePrechargee = voices.find((voice) => !voice.busy && voice.sampleCharge === sampleNote);
  if (voixLibrePrechargee) return marquerReservee(voixLibrePrechargee);

  const voixLibre = voices.find((voice) => !voice.busy);
  if (voixLibre) return marquerReservee(voixLibre);

  const plusAncienne = voices.reduce((acc, courante) =>
    courante.declenchedAt < acc.declenchedAt ? courante : acc,
  );
  return marquerReservee(plusAncienne);
}

// --- COUPURE DU SON PRÉCÉDENT -----------------------------------------------
// Coupe TOUT ce qui est actuellement en train de jouer (toutes les voix
// occupées du pool), avec le même micro-fade que le vol de voix (voir
// fadeOutEtCouper) pour éviter un clic. Appelée systématiquement au tout
// début de jouerNote()/jouerAccord() (voir plus bas) : jouer une nouvelle
// note ou un nouvel accord coupe donc TOUJOURS ce qui sonnait encore, au
// lieu de se superposer dessus — c'est ce qui corrige la superposition
// décrite quand on enchaîne plusieurs accords rapidement. Exportée aussi
// pour un usage direct (ex: un futur bouton "silence"), même si rien
// d'autre ne l'appelle dans ce périmètre.
export async function stopTout(): Promise<void> {
  const voixOccupees = voices.filter((voice) => voice.busy);

  await Promise.all(
    voixOccupees.map(async (voice) => {
      await fadeOutEtCouper(voice);
      voice.subscription?.remove();
      voice.subscription = null;
      voice.busy = false;
    }),
  );
}

type VoixPreparee = {
  result: LectureNoteResult;
  voice: Voice;
  // Jeton du déclenchement à venir (voir son utilisation dans declencherVoix)
  // — capturé ICI, à la fin de la PRÉPARATION, pas au moment du
  // déclenchement : les deux sont de toute façon la même valeur puisque rien
  // ne touche declenchedAt entre la préparation et le déclenchement d'une
  // même note.
  triggerToken: number;
};

// --- PRÉPARATION D'UNE NOTE (sans la jouer) --------------------------------
// Réserve une voix, coupe proprement son éventuel contenu précédent, recharge
// son sample si nécessaire, règle son volume/pitch/rate et la repositionne au
// tout début — bref, tout ce qu'il faut pour qu'elle soit prête à jouer
// INSTANTANÉMENT. NE DÉCLENCHE PAS la lecture (pas de play() ici) : c'est
// exactement cette séparation qui permet à jouerAccord() (plus bas) de
// préparer TOUTES les notes d'un accord avant d'en jouer UNE SEULE — voir
// declencherVoix ci-dessous et le commentaire de jouerAccord.
async function preparerVoixPourNote(note: string): Promise<VoixPreparee> {
  const { sample, semitoneOffset, rate } = calculerCorrespondanceSample(note);
  const { voice, etaitDejaOccupee } = reserverVoix(sample.note);

  if (etaitDejaOccupee) {
    await fadeOutEtCouper(voice);
  }

  // Désabonne l'écouteur de la lecture précédente sur cette voix (s'il en
  // restait un) avant d'en attacher un nouveau dans declencherVoix — sans
  // ça, une voix souvent recyclée accumulerait un écouteur mort par
  // recyclage.
  voice.subscription?.remove();
  voice.subscription = null;

  if (voice.sampleCharge !== sample.note) {
    voice.player.replace(sample.source);
    voice.sampleCharge = sample.note;
    await attendreChargement(voice.player);
  }

  // Remet le volume au maximum : une voix qui vient d'être VOLÉE/coupée
  // (voir fadeOutEtCouper) a son volume descendu à 0 — sans ça, la nouvelle
  // note serait silencieuse.
  voice.player.volume = 1;

  // shouldCorrectPitch = false : INDISPENSABLE. Par défaut (true), la
  // plateforme compense le changement de vitesse pour garder la même
  // hauteur (time-stretching) — le rate ci-dessous n'aurait alors AUCUN
  // effet de transposition, ce qui viderait cette fonction de son intérêt.
  voice.player.shouldCorrectPitch = false;
  voice.player.setPlaybackRate(rate);

  // Remet le sample au tout début : sans ça, une voix recyclée reprendrait
  // au milieu du fichier précédent au lieu de repartir de zéro. Fait ICI,
  // PENDANT la préparation (pas au déclenchement) : c'est justement l'étape
  // la plus lente et la plus variable (voir le commentaire en haut de
  // fichier) — mieux vaut l'avoir déjà faite avant de vouloir déclencher
  // toutes les notes de l'accord d'un coup.
  await voice.player.seekTo(0);

  return {
    result: { noteJouee: note, sampleUtilise: sample.note, decalageDemiTons: semitoneOffset },
    voice,
    triggerToken: voice.declenchedAt,
  };
}

// --- DÉCLENCHEMENT D'UNE NOTE DÉJÀ PRÉPARÉE ---------------------------------
// Lance réellement la lecture (play()) d'une voix préparée par
// preparerVoixPourNote(), et met en place l'écoute de sa fin naturelle
// (didJustFinish) pour la libérer. Volontairement SYNCHRONE : ni "async" ni
// "await", ne renvoie PAS une Promise — jouerAccord() peut donc l'appeler
// pour TOUTES les notes de l'accord via un simple .map() qui s'exécute
// ENTIÈREMENT dans la même tâche JavaScript (contrairement au .map() de la
// PRÉPARATION plus haut, qui lui attend une Promise par note, donc s'étale
// dans le temps) — les N appels à play() se suivent donc directement, sans
// repasser par la boucle d'évènements entre deux, aussi proches dans le
// temps que possible.
function declencherVoix({ voice, triggerToken, result }: VoixPreparee): LectureNoteResult {
  // Jeton du déclenchement courant : si cette voix est réutilisée pour une
  // AUTRE note avant que celle-ci n'ait fini (declenchedAt change alors), un
  // évènement didJustFinish tardif de CETTE lecture-ci ne doit plus la
  // marquer comme libre (elle joue déjà autre chose) — d'où la comparaison
  // ci-dessous.
  voice.subscription = voice.player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
    if (status.didJustFinish && voice.declenchedAt === triggerToken) {
      voice.subscription?.remove();
      voice.subscription = null;
      voice.busy = false;
    }
  });

  voice.player.play();

  return result;
}

// --- UNE SEULE NOTE ---------------------------------------------------------
// jouerNote("E4") par exemple : E4 n'a pas de sample propre (les samples
// sont espacés de 3 demi-tons : ..., C4, D#4, F#4, ...) — on joue donc le
// sample le plus proche (D#4, à 1 demi-ton en dessous) en le pitch-shiftant
// de +1 demi-ton pour qu'il sonne comme un E4, sur une voix du pool. Coupe
// d'abord tout ce qui sonnait encore (voir stopTout).
export async function jouerNote(note: string): Promise<LectureNoteResult> {
  await prechargerPiano();
  await stopTout();
  const preparee = await preparerVoixPourNote(note);
  return declencherVoix(preparee);
}

// --- ACCORDS PLAQUÉS (plusieurs notes en même temps) ------------------------
// jouerAccord(["C4", "E4", "G4"]) joue les 3 notes EN MÊME TEMPS (accord
// plaqué) — PAS l'une après l'autre (ça, ce serait un arpège, explicitement
// hors périmètre ici). Coupe d'abord tout ce qui sonnait encore (stopTout),
// PUIS sépare PRÉPARATION et DÉCLENCHEMENT :
// 1) Promise.all(... preparerVoixPourNote ...) attend que CHAQUE note soit
//    INDIVIDUELLEMENT prête (voix réservée, sample chargé, pitch/rate
//    réglés, repositionnée à zéro) avant de continuer. C'est cette étape
//    dont la durée varie le plus (une note dont le sample est déjà en cache
//    est quasi instantanée, une autre qui doit recharger un sample
//    différent prend quelques dizaines de ms) — la séparer du déclenchement
//    est exactement ce qui évite l'égrenage : on ne joue RIEN tant que tout
//    le monde n'est pas prêt.
// 2) Une fois TOUTES prêtes, un .map() sur declencherVoix (synchrone, voir
//    son commentaire) déclenche chaque voix dans la même tâche JavaScript,
//    sans attente entre deux notes.
// Chaque note réserve en plus SA PROPRE voix (voir reserverVoix) : pas de
// risque qu'une note de l'accord en coupe une autre, MÊME si 2 notes
// retombent sur le même sample (ex: D4 et D#4, toutes deux plus proches du
// sample D#4) — chacune a sa propre voix, donc les 2 sonnent réellement
// ensemble.
export async function jouerAccord(notes: string[]): Promise<LectureNoteResult[]> {
  await prechargerPiano();
  await stopTout();

  const preparees = await Promise.all(notes.map((note) => preparerVoixPourNote(note)));

  return preparees.map((preparee) => declencherVoix(preparee));
}
