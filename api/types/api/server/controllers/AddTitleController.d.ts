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
import type { CustomRequest, CustomTitleRequest } from '~/types/api/server/routes/custom';
import type { InitializeClientCustomFn } from '~/types/api/server/services/Endpoints/custom/initialize';

export type AddTitleFn = (
  // CustomRequest && OpenAIRequest && AnthropicRequest
  req: CustomRequest,
  { text, response, client }: { text: string; response: TMessage; client: any },
) => Promise<void>;

export type AddTitleControllerFn = (
  // CustomRequest && OpenAIRequest && AnthropicRequest
  req: CustomTitleRequest,
  res: Response,
  next: NextFunction,
  // InitializeClientCustomFn && InitializeClientOpenAIFn && InitializeClientAnthropicFn
  initializeClient: InitializeClientCustomFn,
  addTitle: AddTitleFn,
) => Promise<void>;

export type AddTitleControllerGetReqDataFn = (data?: Record<string, any>) => void;
