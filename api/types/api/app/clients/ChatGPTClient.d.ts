import type {
  FileSources,
  TPayload,
  TMessage,
  TEndpointOption,
  EModelEndpoint,
  TModelsConfig,
  TConversation,
} from 'librechat-data-provider';
import type { OpenAIClientBuildMessagesReturn } from '~/types/api/app/clients/OpenAIClient';

export interface ChatGPTClientBuildPromptOptions {
  isChatGptModel?: boolean;
  promptPrefix?: string | null;
}

export type ChatGPTClientBuildPromptFn = (
  messages: TMessage[],
  { isChatGptModel = false, promptPrefix = null }: ChatGPTClientBuildPromptOptions,
) => Promise<OpenAIClientBuildMessagesReturn>;
