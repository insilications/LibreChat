import type {
  FileSources,
  TPayload,
  TMessage,
  TEndpointOption,
  EModelEndpoint,
  TModelsConfig,
  TConversation,
} from 'librechat-data-provider';
import type { Response, NextFunction } from 'express-serve-static-core';
import type { CustomRequest } from '~/types/api/server/routes/custom';
import type { InitializeClientCustomFn } from '~/types/api/server/services/Endpoints/custom/initialize';

export type AddTitleFn = (
  req: CustomRequest,
  { text, response, client }: { text: string; response: TMessage; client: any },
) => Promise<void>;

export type PrefillControllerFn = (
  // CustomRequest && OpenAIRequest && AnthropicRequest
  req: CustomRequest,
  res: Response,
  next: NextFunction,
  // InitializeClientCustomFn && InitializeClientOpenAIFn && InitializeClientAnthropicFn
  initializeClient: InitializeClientCustomFn,
  // addTitle: AddTitleFn,
) => Promise<void>;

export interface PrefillControllerReqDataContext {
  userMessage: TMessage | null;
  userMessagePromise: Promise<TMessage> | null;
  responseMessageId: string | null;
  promptTokens: number | null;
  conversationId: string;
  userMessageId: string | null;
  abortKey: string | null;
}

export type PrefillControllerUpdateReqDataFn = (data?: Record<string, any>) => void;
