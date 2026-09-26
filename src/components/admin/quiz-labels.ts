export function generatorLabel(provider: string): string {
  if (provider === "gemini") return "Written by Gemini";
  if (provider === "groq") return "Written by Groq";
  return "Offline generator";
}
