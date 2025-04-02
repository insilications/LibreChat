import type * as t from './types';
import { EndpointURLs } from './config';
import * as s from './schemas';

export default function createPayload(submission: t.TSubmission) {
  const {
    conversation,
    userMessage,
    endpointOption,
    isEdited,
    isContinued,
    isTemporary,
    isPrefilledMessage,
    isAddTitle,
  } = submission;
  const { conversationId } = s.tConvoUpdateSchema.parse(conversation);
  const { endpoint, endpointType } = endpointOption as {
    endpoint: s.EModelEndpoint;
    endpointType?: s.EModelEndpoint;
  };

  let server = EndpointURLs[endpointType ?? endpoint];

  let payload: t.TPayload = {
    ...userMessage,
    ...endpointOption,
    isContinued: !!(isEdited && isContinued),
    conversationId,
    isTemporary,
  };

  if (isEdited && s.isAssistantsEndpoint(endpoint)) {
    server += '/modify';
  } else if (isEdited) {
    server = server.replace('/ask/', '/edit/');
  } else if (isPrefilledMessage) {
    server = server.replace('/ask/', '/prefill/');
  } else if (isAddTitle) {
    server = server.replace('/ask/', '/title/');
    payload = {
      ...payload,
      messages: submission.messages,
    };
  }
  // export type TPayload = Partial<TMessage> &
  //   Partial<TEndpointOption> & {
  //     isContinued: boolean;
  //     conversationId: string | null;
  //     messages?: TMessages;
  //     isTemporary: boolean;
  //   };

  // const payload: t.TPayload = {
  //   ...userMessage,
  //   ...endpointOption,
  //   isContinued: !!(isEdited && isContinued),
  //   conversationId,
  //   isTemporary,
  // };

  return { server, payload };
}
