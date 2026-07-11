export type Emotion = "happy" | "sad" | "relaxed" | "romantic" | "tense" | "mysterious" | "epic" | "nostalgic" | "hopeful" | "melancholic" | "joyful" | "anxious" | "excited";
export type Gamme = "majeur" | "mineur" | "pentatonique" | "blues" | "dorian" | "mixolydien" | "lydien" | "phrygien" | "locrien" | "chromatique";
export type Progression = {
    emotion: Emotion,
    degrees: string[],
    gamme: Gamme,
    chords?: string[],   // pour plus tard
};

export const PROGRESSIONS: Progression[] = [
    { emotion: "happy", degrees: ["I", "V", "vi", "IV"], gamme: "majeur" },
    { emotion: "happy", degrees: ["I", "IV", "V"], gamme: "majeur" },
    { emotion: "sad",   degrees: ["vi", "IV", "I", "V"], gamme: "mineur" },
    { emotion: "sad",   degrees: ["i", "VI", "III", "VII"], gamme: "mineur" },
];

export type Style = {
    name: string, // pour plus tard 
}
