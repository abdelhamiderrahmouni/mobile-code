import { AppSettings, ModelOption } from './types';

export const MODELS: ModelOption[] = [
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'openai' },
  { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6', provider: 'anthropic' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
  { id: 'gpt-5-mini', name: 'GPT-5 mini', provider: 'openai' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  serverUrl: '',
  defaultModelId: MODELS[0].id,
};

export const STORAGE_KEY = 'mobile-code:state:v1';
