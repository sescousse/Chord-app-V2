// Client Supabase — point d'entrée UNIQUE pour parler à Supabase depuis
// l'app. Tout le reste du code doit importer `supabase` d'ICI (jamais
// recréer un second client ailleurs), pour garder une seule session/config.

// react-native-url-polyfill/auto DOIT être importé avant tout usage de
// @supabase/supabase-js : ce dernier utilise l'API web `URL` en interne, que
// le moteur JS de React Native (Hermes) n'implémente pas complètement.
// "/auto" installe le polyfill globalement dès l'import (pas besoin de
// l'appeler explicitement) — c'est l'import recommandé par la doc Supabase
// pour React Native/Expo.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// 🔧 À REMPLIR : colle ici l'URL de ton projet et ta clé "publishable"
// (Dashboard Supabase → Project Settings → API). C'est la nouvelle clé
// publique (équivalent de l'ancienne "anon/public key"), sûre à embarquer
// dans une app cliente — PAS la "service_role key", qui ne doit jamais
// quitter un serveur.
// ---------------------------------------------------------------------------
// Annotées explicitement en `string` (pas seulement déduites du texte
// collé) : sans ça, TypeScript déduirait un type "littéral" figé sur la
// valeur exacte de chaque constante, ce qui gênerait toute comparaison
// future avec une autre chaîne (ex: un test de type "placeholder non
// rempli").
const SUPABASE_URL: string = 'https://svktczuzhdjczegvgusf.supabase.co'; // ex: 'https://xxxxxxxxxxxx.supabase.co'
const SUPABASE_PUBLISHABLE_KEY: string = 'sb_publishable_FBGFWqS4ZKp0YO4GcKNaEQ_mUGHHTIq'; // ex: 'sb_publishable_xxxxxxxxxxxxxxxxxxxx'

// Seul `supabase` (le client) a besoin d'être exporté : c'est la seule chose
// dont le reste de l'app se sert pour parler à Supabase.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // AsyncStorage : stocke la session (token de connexion) sur l'appareil
    // pour qu'elle survive à un redémarrage de l'app — sans ça, Supabase
    // utiliserait par défaut `localStorage`, qui n'existe pas en React
    // Native (l'app plante ou perd la session à chaque relance).
    storage: AsyncStorage,
    // Rafraîchit automatiquement le token de session avant qu'il expire —
    // recommandé même si on ne fait pas encore d'authentification ici : la
    // config est prête pour plus tard, sans rien à changer.
    autoRefreshToken: true,
    persistSession: true,
    // false en React Native : cette option sert à récupérer une session
    // depuis l'URL du navigateur après une redirection OAuth (flux web) —
    // il n'y a pas d'URL de navigateur dans une app native. La laisser à
    // true forcerait Supabase à tenter de lire `window.location`, qui
    // n'existe pas ici.
    detectSessionInUrl: false,
  },
});
