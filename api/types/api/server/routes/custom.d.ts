import type {
  FileSources,
  TPayload,
  TMessage,
  TEndpointOption,
  EModelEndpoint,
  TModelsConfig,
  TConversation,
} from 'librechat-data-provider';
import { DeepNonNullable, DeepRequired } from 'ts-essentials';
import type { User, Request } from 'express-serve-static-core';
import type { ClientEndpointOption } from '~/types/api/app/clients/BaseClient';

export type CustomRequestBody = DeepRequired<DeepNonNullable<TPayload>> & {
  endpointOption: ClientEndpointOption;
};

export interface CustomRequest extends Request {
  body: CustomRequestBody;
  user: User;
}

export type CustomTitleRequestBody = DeepRequired<DeepNonNullable<TPayload>> & {
  endpointOption: ClientEndpointOption;
};

export interface CustomTitleRequest extends Request {
  body: CustomTitleRequestBody;
  user: User;
}
