const { getResponseSender } = require('librechat-data-provider');
const {
  handleAbortError,
  createAbortController,
  cleanupAbortController,
} = require('~/server/middleware');
const {
  disposeClient,
  processReqData,
  clientRegistry,
  requestDataMap,
} = require('~/server/cleanup');
const { sendMessage, createOnProgress } = require('~/server/utils');
// const { saveMessage } = require('~/models');
const { logger } = require('~/config');
const OpenAIClient = require('~/app/clients/OpenAIClient');
const { inspect } = require('util');

/**
 * Controller for handling prefilling through custom endpoints
 * @type {import('~/types/api/server/controllers/PrefillController').PrefillControllerFn}
 */
const PrefillController = async (req, res, next, initializeClient) => {
  let {
    text,
    endpointOption,
    conversationId,
    modelDisplayLabel,
    isCreatedByUser,
    parentMessageId = null,
    overrideParentMessageId = null,
  } = req.body;

  /** @type {OpenAIClient | null} */
  let client = null;
  /** @type {string | null} */
  let abortKey = null;
  /** @type {Array<() => void>} */
  let cleanupHandlers = [];
  /** @type {WeakRef<OpenAIClient> | null} */
  let clientRef = null;

  console.log(
    `PORRA - 0 - PrefillController - req.body: ${inspect(req.body, { depth: 3, colors: true })}`,
  );

  logger.debug('[PrefillController]', {
    text,
    conversationId,
    ...endpointOption,
    modelsConfig: endpointOption.modelsConfig ? 'exists' : '',
  });

  /** @type {TMessage | null} */
  let userMessage = null;
  /** @type {Promise<TMessage> | null} */
  let userMessagePromise = null;
  /** @type {number | null} */
  let promptTokens = null;
  /** @type {string | null} */
  let userMessageId = null;
  /** @type {string | null} */
  let responseMessageId = null;
  let getAbortData = null;

  const sender = isCreatedByUser
    ? 'User'
    : getResponseSender({
        ...endpointOption,
        model: endpointOption.modelOptions.model,
        modelDisplayLabel,
      });
  // const initialConversationId = conversationId;
  // const newConvo = !initialConversationId;
  const userId = req.user.id;

  /** @type {import('~/types/api/server/controllers/PrefillController').PrefillControllerReqDataContext | null} */
  let reqDataContext = {
    userMessage,
    userMessagePromise,
    responseMessageId,
    promptTokens,
    conversationId,
    userMessageId,
    // abortKey,
  };

  /** @type {import('~/types/api/server/controllers/PrefillController').PrefillControllerUpdateReqDataFn} */
  const updateReqData = (data = {}) => {
    reqDataContext = processReqData(data, reqDataContext);
    abortKey = reqDataContext.abortKey;
    userMessage = reqDataContext.userMessage;
    userMessagePromise = reqDataContext.userMessagePromise;
    responseMessageId = reqDataContext.responseMessageId;
    promptTokens = reqDataContext.promptTokens;
    conversationId = reqDataContext.conversationId;
    userMessageId = reqDataContext.userMessageId;
  };

  let { onProgress: progressCallback, getPartialText } = createOnProgress();

  const performCleanup = () => {
    logger.debug('[PrefillController] Performing cleanup');
    if (Array.isArray(cleanupHandlers)) {
      for (const handler of cleanupHandlers) {
        try {
          if (typeof handler === 'function') {
            handler();
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    if (abortKey) {
      logger.debug('[PrefillController] Cleaning up abort controller');
      cleanupAbortController(abortKey);
      abortKey = null;
    }

    if (client) {
      disposeClient(client);
      client = null;
    }

    reqDataContext = null;
    userMessage = null;
    userMessagePromise = null;
    promptTokens = null;
    getAbortData = null;
    progressCallback = null;
    endpointOption = null;
    cleanupHandlers = null;
    // addTitle = null;

    if (requestDataMap.has(req)) {
      requestDataMap.delete(req);
    }
    logger.debug('[PrefillController] Cleanup completed');
  };

  try {
    ({ client } = await initializeClient({ req, res, endpointOption }));
    if (clientRegistry && client) {
      clientRegistry.register(client, { userId }, client);
    }

    if (client) {
      requestDataMap.set(req, { client });
    }

    /** @type {WeakRef<OpenAIClient>} */
    clientRef = new WeakRef(client);

    getAbortData = () => {
      const currentClient = /** @type {WeakRef<OpenAIClient>} */ (clientRef).deref();
      const currentText =
        currentClient?.getStreamText != null ? currentClient.getStreamText() : getPartialText();

      return {
        sender,
        conversationId,
        messageId: reqDataContext.responseMessageId,
        parentMessageId: overrideParentMessageId ?? userMessageId,
        text: currentText,
        userMessage: userMessage,
        userMessagePromise: userMessagePromise,
        promptTokens: reqDataContext.promptTokens,
      };
    };

    const { onStart, abortController } = createAbortController(
      req,
      res,
      getAbortData,
      updateReqData,
    );

    const closeHandler = () => {
      logger.debug('[PrefillController] Request closed');
      if (!abortController || abortController.signal.aborted || abortController.requestCompleted) {
        return;
      }
      abortController.abort();
      logger.debug('[PrefillController] Request aborted on close');
    };

    res.on('close', closeHandler);
    cleanupHandlers.push(() => {
      try {
        res.removeListener('close', closeHandler);
      } catch (e) {
        // Ignore
      }
    });

    const messageOptions = {
      user: userId,
      parentMessageId,
      conversationId: reqDataContext.conversationId,
      overrideParentMessageId,
      sender,
      isCreatedByUser,
      getReqData: updateReqData,
      onStart,
      abortController,
      progressCallback,
      progressOptions: {
        res,
      },
    };

    console.log(
      `PORRA - 1 - PrefillController - messageOptions: ${inspect(messageOptions, { depth: 3, colors: true })}`,
    );

    let { message, conversation } = await client.addPrefilledMessage(text, messageOptions);
    // let { conversation } = await client.addPrefilledMessage(text, messageOptions);
    // message.endpoint = endpointOption.endpoint;

    console.log(
      `PORRA - 2 - PrefillController - conversation.title: ${inspect(conversation.title, { depth: 3, colors: true })}`,
    );
    console.log(
      `PORRA - 3 - PrefillController - conversation: ${inspect(conversation, { depth: 3, colors: true })}`,
    );

    const latestUserMessage = reqDataContext.userMessage;

    console.log(
      `PORRA - 4 - PrefillController - latestUserMessage: ${inspect(latestUserMessage, { depth: 3, colors: true })}`,
    );
    console.log(
      `PORRA - 5 - PrefillController - userMessage: ${inspect(userMessage, { depth: 3, colors: true })}`,
    );
    console.log(
      `PORRA - 6 - PrefillController - userMessage: ${inspect(message, { depth: 3, colors: true })}`,
    );
    console.log(
      `PORRA - 7 - PrefillController - client.options.attachments: ${inspect(client.options.attachments, { depth: 3, colors: true })}`,
    );

    conversation.model = endpointOption.modelOptions.model;
    // if (client?.options?.attachments && latestUserMessage) {
    // latestUserMessage.files = client.options.attachments;
    // if (endpointOption?.modelOptions?.model) {
    // conversation.model = endpointOption.modelOptions.model;
    // }
    // delete latestUserMessage.image_urls;
    // }

    if (!abortController.signal.aborted) {
      sendMessage(res, {
        prefilled: true,
        conversation,
        title: conversation?.title,
        requestMessage: latestUserMessage,
        // requestMessage: userMessage,
      });
      console.log('PORRA - 7 - PrefillController - sendMessage - res.end()');
      res.end();
    }

    performCleanup();
  } catch (error) {
    logger.error('[PrefillController] Error handling request', error);
    let partialText = '';
    try {
      const currentClient = /** @type {WeakRef<OpenAIClient>} */ (clientRef).deref();
      partialText =
        currentClient?.getStreamText != null ? currentClient.getStreamText() : getPartialText();
    } catch (getTextError) {
      logger.error(
        '[PrefillController] Error calling getText() during error handling',
        getTextError,
      );
    }

    handleAbortError(res, req, error, {
      sender,
      partialText,
      conversationId: reqDataContext.conversationId,
      messageId: reqDataContext.responseMessageId,
      parentMessageId: overrideParentMessageId ?? reqDataContext.userMessageId ?? parentMessageId,
    })
      .catch((err) => {
        logger.error('[PrefillController] Error in `handleAbortError` during catch block', err);
      })
      .finally(() => {
        performCleanup();
      });
  }
};

module.exports = PrefillController;
