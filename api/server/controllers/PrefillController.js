const { getResponseSender } = require('librechat-data-provider');
const { createAbortController, handleAbortError } = require('~/server/middleware');
const { sendMessage, createOnProgress } = require('~/server/utils');
const { saveMessage } = require('~/models');
const { logger } = require('~/config');

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

  console.log('PORRA - 0 - PrefillController - req.body: %O', req.body);

  logger.debug('[PrefillController]', {
    text,
    conversationId,
    ...endpointOption,
    modelsConfig: endpointOption.modelsConfig ? 'exists' : '',
  });

  /** @type {TMessage | undefined} */
  let userMessage;
  /** @type {Promise<TMessage> | undefined} */
  let userMessagePromise;
  /** @type {number | undefined} */
  let promptTokens;
  /** @type {string | null} */
  let userMessageId = null;
  /** @type {string | undefined} */
  let responseMessageId;
  const sender = isCreatedByUser
    ? 'User'
    : getResponseSender({
        ...endpointOption,
        model: endpointOption.modelOptions.model,
        modelDisplayLabel,
      });

  // const newConvo = !conversationId;
  const user = req.user.id;

  /** @type {import('~/types/api/server/controllers/PrefillController').PrefillControllerGetReqDataFn} */
  const getReqData = (data = {}) => {
    for (let key in data) {
      if (key === 'userMessage') {
        userMessage = data[key];
        userMessageId = data[key].messageId;
      } else if (key === 'userMessagePromise') {
        userMessagePromise = data[key];
      } else if (key === 'responseMessageId') {
        responseMessageId = data[key];
      } else if (key === 'promptTokens') {
        promptTokens = data[key];
      } else if (!conversationId && key === 'conversationId') {
        conversationId = data[key];
      }
    }
  };

  let getText;

  try {
    const { client } = await initializeClient({ req, res, endpointOption });
    const { onProgress: progressCallback, getPartialText } = createOnProgress();

    getText = client.getStreamText != null ? client.getStreamText.bind(client) : getPartialText;

    const getAbortData = () => ({
      sender,
      conversationId,
      userMessagePromise,
      messageId: responseMessageId,
      parentMessageId: overrideParentMessageId ?? userMessageId,
      text: getText(),
      userMessage,
      promptTokens,
    });

    const { abortController, onStart } = createAbortController(req, res, getAbortData, getReqData);

    res.on('close', () => {
      logger.debug('[PrefillController] Request closed');
      if (!abortController) {
        logger.debug('[PrefillController] !abortController');
        return;
      } else if (abortController.signal.aborted) {
        logger.debug('[PrefillController] abortController.signal.aborted');
        return;
      } else if (abortController.requestCompleted) {
        logger.debug('[PrefillController] abortController.requestCompleted');
        return;
      }

      abortController.abort();
      logger.debug('[PrefillController] Request aborted on close');
    });

    const messageOptions = {
      user,
      parentMessageId,
      conversationId,
      overrideParentMessageId,
      sender,
      isCreatedByUser,
      // isEdited: false,
      // isContinued: false,
      // replaceOptions: false,
      getReqData,
      onStart,
      abortController,
      progressCallback,
      progressOptions: {
        res,
        // parentMessageId: overrideParentMessageId || userMessageId,
      },
    };

    console.log('PORRA - 1 - PrefillController - messageOptions: %O', messageOptions);

    // let { message, conversation } = await client.addPrefilledMessage(text, messageOptions);
    let { conversation } = await client.addPrefilledMessage(text, messageOptions);
    // message.endpoint = endpointOption.endpoint;

    console.log('PORRA - 2 - PrefillController - conversation.title: %O', conversation.title);
    console.log('PORRA - 3 - PrefillController - conversation: %O', conversation);
    // const { conversation = {} } = await client.responsePromise;
    // conversation.title =
    // conversation && !conversation.title ? null : conversation?.title || 'New Chat';

    // THIS IS UNNECESARY AND COULD BE DONE IN A SINGLE SAVE INSIDE `client.addMessage`
    // MAYBE THE RETURNED `message` IS THE ONE TO FOCUS ON
    // if (client.options.attachments) {
    // userMessage.files = client.options.attachments;
    conversation.model = endpointOption.modelOptions.model;
    // delete userMessage.image_urls;
    // }

    if (!abortController.signal.aborted) {
      // sendMessage(res, {
      //   final: true,
      //   conversation,
      //   title: conversation.title,
      //   requestMessage: userMessage,
      //   responseMessage: response,
      // });
      sendMessage(res, {
        prefilled: true,
        conversation,
        title: conversation?.title,
        // requestMessage: userMessage,
        requestMessage: userMessage,
        // responseMessage: response,
      });
      console.log('PORRA - 4 - PrefillController - sendMessage - res.end()');
      res.end();

      // if (!client.savedMessageIds.has(response.messageId)) {
      //   await saveMessage(
      //     req,
      //     { ...response, user },
      //     { context: 'api/server/controllers/PrefillController.js - response end' },
      //   );
      // }
    }

    // THIS IS UNNECESARY AND COULD BE DONE IN A SINGLE SAVE INSIDE `client.addMessage`
    // if (!client.skipSaveUserMessage) {
    //   await saveMessage(req, userMessage, {
    //     context: "api/server/controllers/PrefillController.js - don't skip saving user message",
    //   });
    // }

    // if (addTitle && parentMessageId === Constants.NO_PARENT && newConvo) {
    //   console.log('PORRA - 2 - PrefillController - addTitle');
    //   addTitle(req, {
    //     text,
    //     response: userMessage,
    //     client,
    //   });
    // } else {
    //   console.log('PORRA - 3 - PrefillController - NO addTitle');
    // }
  } catch (error) {
    const partialText = getText && getText();
    handleAbortError(res, req, error, {
      sender,
      partialText,
      conversationId,
      messageId: responseMessageId,
      parentMessageId: overrideParentMessageId ?? userMessageId ?? parentMessageId,
    }).catch((err) => {
      logger.error('[PrefillController] Error in `handleAbortError`', err);
    });
  }
};

module.exports = PrefillController;
