import type OpenAIClient from '~/app/clients/OpenAIClient';
import type {
  FileSources,
  TPayload,
  TMessage,
  TEndpointOption,
  EModelEndpoint,
  TModelsConfig,
  TConversation,
} from 'librechat-data-provider';
import type { Response } from 'express-serve-static-core';
import type { ClientEndpointOption, EndpointTokenConfig } from '~/types/api/app/clients/BaseClient';
import type { CustomRequest } from '~/types/api/server/routes/custom';

export interface ClientCustomOptions {
  headers: Record<string, string>;
  addParams: Record<string, any> | undefined;
  dropParams: string[] | undefined;
  titleConvo: boolean | undefined;
  titleModel: string | undefined;
  forcePrompt: boolean | undefined;
  summaryModel: string | undefined;
  modelDisplayLabel: string | undefined;
  titleMethod: 'completion' | 'functions';
  contextStrategy: string | null;
  directEndpoint: boolean | undefined;
  titleMessageRole: string | undefined;
  streamRate: number | undefined;
  endpointTokenConfig: EndpointTokenConfig;
}

export type InitializeClientCustomArgs = {
  // CustomRequest && OpenAIRequest && AnthropicRequest
  req: CustomRequest;
  res: Response;
  endpointOption: ClientEndpointOption;
  optionsOnly?: boolean;
  overrideEndpoint?: EModelEndpoint;
};

export type InitializeClientCustomFn = ({
  req,
  res,
  endpointOption,
  optionsOnly,
  overrideEndpoint,
}: InitializeClientCustomArgs) => Promise<{ client: OpenAIClient; openAIApiKey: string }>;
