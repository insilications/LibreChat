import type {
  FileSources,
  TPayload,
  TMessage,
  TEndpointOption,
  TEndpoint,
  EModelEndpoint,
  TModelsConfig,
  TConversation,
  TPreset,
  TAttachment,
} from 'librechat-data-provider';
import type { IMongoFile } from '@librechat/data-schemas';
import type { Response } from 'express-serve-static-core';
import type { OpenAI } from 'openai';
import type { CustomRequest } from '~/types/api/server/routes/custom';
import type { ClientCustomOptions } from '~/types/api/server/services/Endpoints/custom/initialize';

export interface AzureOptions {
  azureOpenAIApiKey: string;
  azureOpenAIApiInstanceName: string;
  azureOpenAIApiDeploymentName: string;
  azureOpenAIApiVersion: string;
}

/**
 * These properties are added in api route calls through the handler call
 * to `buildEndpointOption` in `buildEndpointOptions.js`
 */
export interface ClientEndpointOption extends TEndpointOption, TEndpoint {
  // export interface ClientEndpointOption extends TEndpointOption {
  attachments?: Promise<Partial<IMongoFile>[]> | Partial<IMongoFile>[];
  modelOptions: ModelOptions;
  modelsConfig: TModelsConfig;
  artifactsPrompt?: string;
}

export type ClientPayload = OpenAI.ChatCompletionMessageParam[] | string;

export type ClientMessageFileMap = Record<string, Partial<IMongoFile>[]>;

export interface TokenConfig {
  prompt: number;
  completion: number;
  context: number;
}

export type EndpointTokenConfig = Record<string, TokenConfig>;

export interface ModelOptions extends Partial<TConversation> {
  modelName?: string;
  messages?: ClientPayload;
}

export interface ClientOptions extends TEndpoint, ClientEndpointOption, ClientCustomOptions {
  // CustomRequest && OpenAIRequest && AnthropicRequest
  req: CustomRequest;
  res: Response;
  reverseProxyUrl?: string | null;
  proxy: string | null;
  sender?: string | null;
  replaceOptions?: boolean;
  userLabel?: string;
  modelOptions: ModelOptions;
  openaiApiKey?: string | null;
  maxPromptTokens?: number;
  azure?: AzureOptions | boolean;
  greeting?: string;
  iconURL?: string | null;
  spec?: string | null;
  artifacts?: string;
}

export interface ClientAddPrefilledMessageOpts {
  user: string;
  parentMessageId: string | null;
  conversationId: string | null;
  responseMessageId?: string | null;
  sender: string;
  isCreatedByUser: boolean;
  generation?: string;
  // isContinued: boolean;
  isContinued?: boolean;
  // isEdited: boolean;
  isEdited?: boolean;
  replaceOptions?: boolean;
  promptPrefix?: string | null;

  overrideParentMessageId: string | null;
  attachments?: IMongoFile[];
  getReqData?: (data?: Record<string, any>) => void;
  onStart?: (userMessage: TMessage, responseMessageId: string) => void;
  abortController?: AbortController;
  progressCallback?: (opts: any) => _.Function0<void>;
  progressOptions?: { res: Response };
  onProgress?: _.Function0<void>;
}

export type ClientAddPrefilledMessageFn = (
  message: string,
  opts: ClientAddPrefilledMessageOpts,
) => Promise<{ message: TMessage; conversation: TConversation }>;

export type ClientSetAddMesageOptionsFn = (opts: ClientAddPrefilledMessageOpts) => Promise<
  Omit<ClientAddPrefilledMessageOpts, 'user'> & {
    user: string | null;
    head: string;
    userMessageId: string;
    // responseMessageId: string;
    saveOptions: Partial<TConversation> & {
      files?: Promise<Partial<IMongoFile>[]> | Partial<IMongoFile>[];
    };
  }
>;

export interface ClientGetMessagesForConversationOpts {
  messages: TMessage[];
  parentMessageId: string;
  mapMethod?: ((message: TMessage) => TMessage) | null;
  summary?: boolean;
}

export type ClientGetMessagesForConversationFn = ({
  messages,
  parentMessageId,
  mapMethod = null,
  summary = false,
}: ClientGetMessagesForConversationOpts) => TMessage[];
