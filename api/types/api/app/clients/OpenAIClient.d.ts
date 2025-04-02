import type {
  FileSources,
  TPayload,
  TMessage,
  TEndpointOption,
  EModelEndpoint,
  TModelsConfig,
  TConversation,
} from 'librechat-data-provider';
import type { IMongoFile } from '@librechat/data-schemas';
import type { OpenAI } from 'openai';
import type {
  ClientAddPrefilledMessageOpts,
  ClientPayload,
} from '~/types/api/app/clients/BaseClient';

export interface OpenAIClientBuildMessagesReturn {
  prompt: ClientPayload;
  promptTokens: number;
  messages?: TMessage[];
  context?: TMessage[];
  tokenCountMap?: Record<string, number> | undefined;
}

export type OpenAIClientBuildMessagesFn = (
  messages: TMessage[],
  parentMessageId: string,
  { isChatCompletion = false, promptPrefix = null }: OpenAIClientGetBuildMessagesOptionsReturn,
  opts: ClientAddPrefilledMessageOpts,
) => Promise<OpenAIClientBuildMessagesReturn>;

interface OpenAIClientGetBuildMessagesOptionsReturn {
  isChatCompletion: boolean;
  promptPrefix?: string | null;
  abortController?: AbortController;
}

export type OpenAIClientGetBuildMessagesOptionsFn = (
  opts: ClientAddPrefilledMessageOpts,
) => OpenAIClientGetBuildMessagesOptionsReturn;

export type OpenAISendCompletionFn = (
  payload: ClientPayload,
  opts: ClientAddPrefilledMessageOpts,
) => Promise<string>;

export type OpenAIAddImageURLsFn = (
  message: TMessage,
  attachments: Partial<IMongoFile>[],
) => Promise<Partial<IMongoFile>[]>;
