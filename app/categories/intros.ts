/** Short static intros for known category slugs. Unknown categories get a generic line. */
const INTROS: Record<string, string> = {
  sapphire: "Blue and fancy-colour sapphires from sellers who document origin and heat treatment.",
  ruby: "Red corundum, from classic pigeon-blood stones to lighter pinks and padparadscha.",
  emerald: "Green beryl with a focus on colour, clarity and whether the stone has been oiled.",
  diamond: "Natural and lab-grown diamonds, with grading reports where the seller has them.",
  spinel: "A versatile gem with a wide colour range and often underpriced next to its look-alikes.",
};

export function categoryIntro(slug: string, name: string): string {
  return INTROS[slug] ?? `${name} from approved sellers. Filter by carat, price and certification.`;
}
