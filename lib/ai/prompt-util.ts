import { getPromptByLanguage } from './constants';

export function fillPrompt(prompt: string, placeholders: Record<string, string>) {
  // First, check if this is a language-specific prompt template
  if (prompt.startsWith('{{') && prompt.endsWith('}}')) {
    const promptType = prompt.slice(2, -2);
    const language = placeholders.targetLanguage?.toLowerCase().slice(0, 2) || 'en';
    prompt = getPromptByLanguage(promptType, language);
  }

  // Then replace any remaining placeholders
  return prompt.replace(/\{\{([^}]+)}}/g, (match, key) => {
    return placeholders[key] || match;
  });
}
