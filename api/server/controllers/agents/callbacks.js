const { nanoid } = require('nanoid');
const { sendEvent } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const { Tools, StepTypes, FileContext } = require('@librechat/data-provider');
const {
  EnvVar,
  Providers,
  GraphEvents,
  getMessageId,
  ToolEndHandler,
  handleToolCalls,
  ChatModelStreamHandler,
} = require('@librechat/agents');
const { processCodeOutput } = require('~/server/services/Files/Code/process');
const { loadAuthValues } = require('~/server/services/Tools/credentials');
const { saveBase64Image } = require('~/server/services/Files/process');

class ModelEndHandler {
  /**
   * @param {Array<UsageMetadata>} collectedUsage
   * @param {Array<TMessageMetadata>} collectedMessageMetadata
   */
  constructor(collectedUsage, collectedMessageMetadata) {
    if (!Array.isArray(collectedUsage)) {
      throw new Error('collectedUsage must be an array');
    }

    if (!Array.isArray(collectedMessageMetadata)) {
      throw new Error('collectedMessageMetadata must be an array');
    }

    this.collectedUsage = collectedUsage;
    this.collectedMessageMetadata = collectedMessageMetadata;
  }

  /**
   * @param {string} event
   * @param {ModelEndData | undefined} data
   * @param {Record<string, unknown> | undefined} metadata
   * @param {StandardGraph} graph
   * @returns
   */
  handle(event, data, metadata, graph) {
    if (!graph || !metadata) {
      console.warn(`Graph or metadata not found in ${event} event`);
      return;
    }

    try {
      if (metadata.provider === Providers.GOOGLE || graph.clientOptions?.disableStreaming) {
        handleToolCalls(data?.output?.tool_calls, metadata, graph);
      }

      const response_metadata = data?.output?.response_metadata;
      if (response_metadata) {
        const id = response_metadata.id;
        const created_at = response_metadata.created_at;
        this.collectedMessageMetadata.push({
          id,
          created_at,
        });
        console.log(`ModelEndHandler: response_metadata.id: ${id}`);
        console.log(`ModelEndHandler: response_metadata.created_at: ${created_at}`);
        console.log(
          'ModelEndHandler: this.collectedMessageMetadata: ',
          this.collectedMessageMetadata,
        );
      }
      const usage = data?.output?.usage_metadata;
      if (!usage) {
        return;
      }
      if (metadata?.model) {
        usage.model = metadata.model;
      }

      this.collectedUsage.push(usage);
      const streamingDisabled = !!(
        graph.clientOptions?.disableStreaming || graph?.boundModel?.disableStreaming
      );
      if (!streamingDisabled) {
        return;
      }
      if (!data.output.content) {
        return;
      }
      const stepKey = graph.getStepKey(metadata);
      const message_id = getMessageId(stepKey, graph) ?? '';
      console.log(`ModelEndHandler: message_id: ${message_id}`);
      if (message_id) {
        graph.dispatchRunStep(stepKey, {
          type: StepTypes.MESSAGE_CREATION,
          message_creation: {
            message_id,
          },
        });
      }
      const stepId = graph.getStepIdByKey(stepKey);
      const content = data.output.content;
      if (typeof content === 'string') {
        graph.dispatchMessageDelta(stepId, {
          content: [
            {
              type: 'text',
              text: content,
            },
          ],
        });
      } else if (content.every((c) => c.type?.startsWith('text'))) {
        graph.dispatchMessageDelta(stepId, {
          content,
        });
      }
    } catch (error) {
      logger.error('Error handling model end event:', error);
    }
  }
}

/**
 * Get default handlers for stream events.
 * @param {Object} options - The options object.
 * @param {ServerResponse} options.res - The options object.
 * @param {ContentAggregator} options.aggregateContent - The options object.
 * @param {ToolEndCallback} options.toolEndCallback - Callback to use when tool ends.
 * @param {Array<UsageMetadata>} options.collectedUsage - The list of collected usage metadata.
 * @param {Array<TMessageMetadata>} options.collectedMessageMetadata - The collected message metadata.
 * @returns {Record<string, EventHandler>} The default handlers.
 * @throws {Error} If the request is not found.
 */
function getDefaultHandlers({
  res,
  aggregateContent,
  toolEndCallback,
  collectedUsage,
  collectedMessageMetadata,
}) {
  if (!res || !aggregateContent) {
    throw new Error(
      `[getDefaultHandlers] Missing required options: res: ${!res}, aggregateContent: ${!aggregateContent}`,
    );
  }
  const handlers = {
    [GraphEvents.CHAT_MODEL_END]: new ModelEndHandler(collectedUsage, collectedMessageMetadata),
    [GraphEvents.TOOL_END]: new ToolEndHandler(toolEndCallback),
    [GraphEvents.CHAT_MODEL_STREAM]: new ChatModelStreamHandler(),
    [GraphEvents.ON_RUN_STEP]: {
      /**
       * Handle ON_RUN_STEP event.
       * @param {string} event - The event name.
       * @param {StreamEventData} data - The event data.
       * @param {GraphRunnableConfig['configurable']} [metadata] The runnable metadata.
       */
      handle: (event, data, metadata) => {
        if (data?.stepDetails.type === StepTypes.TOOL_CALLS) {
          sendEvent(res, { event, data });
        } else if (metadata?.last_agent_index === metadata?.agent_index) {
          sendEvent(res, { event, data });
        } else if (!metadata?.hide_sequential_outputs) {
          sendEvent(res, { event, data });
        } else {
          const agentName = metadata?.name ?? 'Agent';
          const isToolCall = data?.stepDetails.type === StepTypes.TOOL_CALLS;
          const action = isToolCall ? 'performing a task...' : 'thinking...';
          sendEvent(res, {
            event: 'on_agent_update',
            data: {
              runId: metadata?.run_id,
              message: `${agentName} is ${action}`,
            },
          });
        }
        aggregateContent({ event, data });
      },
    },
    [GraphEvents.ON_RUN_STEP_DELTA]: {
      /**
       * Handle ON_RUN_STEP_DELTA event.
       * @param {string} event - The event name.
       * @param {StreamEventData} data - The event data.
       * @param {GraphRunnableConfig['configurable']} [metadata] The runnable metadata.
       */
      handle: (event, data, metadata) => {
        if (data?.delta.type === StepTypes.TOOL_CALLS) {
          sendEvent(res, { event, data });
        } else if (metadata?.last_agent_index === metadata?.agent_index) {
          sendEvent(res, { event, data });
        } else if (!metadata?.hide_sequential_outputs) {
          sendEvent(res, { event, data });
        }
        aggregateContent({ event, data });
      },
    },
    [GraphEvents.ON_RUN_STEP_COMPLETED]: {
      /**
       * Handle ON_RUN_STEP_COMPLETED event.
       * @param {string} event - The event name.
       * @param {StreamEventData & { result: ToolEndData }} data - The event data.
       * @param {GraphRunnableConfig['configurable']} [metadata] The runnable metadata.
       */
      handle: (event, data, metadata) => {
        if (data?.result != null) {
          sendEvent(res, { event, data });
        } else if (metadata?.last_agent_index === metadata?.agent_index) {
          sendEvent(res, { event, data });
        } else if (!metadata?.hide_sequential_outputs) {
          sendEvent(res, { event, data });
        }
        aggregateContent({ event, data });
      },
    },
    [GraphEvents.ON_MESSAGE_DELTA]: {
      /**
       * Handle ON_MESSAGE_DELTA event.
       * @param {string} event - The event name.
       * @param {StreamEventData} data - The event data.
       * @param {GraphRunnableConfig['configurable']} [metadata] The runnable metadata.
       */
      handle: (event, data, metadata) => {
        if (metadata?.last_agent_index === metadata?.agent_index) {
          sendEvent(res, { event, data });
        } else if (!metadata?.hide_sequential_outputs) {
          sendEvent(res, { event, data });
        }
        aggregateContent({ event, data });
      },
    },
    [GraphEvents.ON_REASONING_DELTA]: {
      /**
       * Handle ON_REASONING_DELTA event.
       * @param {string} event - The event name.
       * @param {StreamEventData} data - The event data.
       * @param {GraphRunnableConfig['configurable']} [metadata] The runnable metadata.
       */
      handle: (event, data, metadata) => {
        if (metadata?.last_agent_index === metadata?.agent_index) {
          sendEvent(res, { event, data });
        } else if (!metadata?.hide_sequential_outputs) {
          sendEvent(res, { event, data });
        }
        aggregateContent({ event, data });
      },
    },
  };

  return handlers;
}

/**
 *
 * @param {Object} params
 * @param {ServerRequest} params.req
 * @param {ServerResponse} params.res
 * @param {Promise<MongoFile | { filename: string; filepath: string; expires: number;} | null>[]} params.artifactPromises
 * @returns {ToolEndCallback} The tool end callback.
 */
function createToolEndCallback({ req, res, artifactPromises }) {
  /**
   * @type {ToolEndCallback}
   */
  return async (data, metadata) => {
    const output = data?.output;
    if (!output) {
      return;
    }

    if (!output.artifact) {
      return;
    }

    if (output.artifact[Tools.web_search]) {
      artifactPromises.push(
        (async () => {
          const attachment = {
            type: Tools.web_search,
            messageId: metadata.run_id,
            toolCallId: output.tool_call_id,
            conversationId: metadata.thread_id,
            [Tools.web_search]: { ...output.artifact[Tools.web_search] },
          };
          if (!res.headersSent) {
            return attachment;
          }
          res.write(`event: attachment\ndata: ${JSON.stringify(attachment)}\n\n`);
          return attachment;
        })().catch((error) => {
          logger.error('Error processing artifact content:', error);
          return null;
        }),
      );
    }

    if (output.artifact.content) {
      /** @type {FormattedContent[]} */
      const content = output.artifact.content;
      for (let i = 0; i < content.length; i++) {
        const part = content[i];
        if (!part) {
          continue;
        }
        if (part.type !== 'image_url') {
          continue;
        }
        const { url } = part.image_url;
        artifactPromises.push(
          (async () => {
            const filename = `${output.name}_${output.tool_call_id}_img_${nanoid()}`;
            const file_id = output.artifact.file_ids?.[i];
            const file = await saveBase64Image(url, {
              req,
              file_id,
              filename,
              endpoint: metadata.provider,
              context: FileContext.image_generation,
            });
            const fileMetadata = Object.assign(file, {
              messageId: metadata.run_id,
              toolCallId: output.tool_call_id,
              conversationId: metadata.thread_id,
            });
            if (!res.headersSent) {
              return fileMetadata;
            }

            if (!fileMetadata) {
              return null;
            }

            res.write(`event: attachment\ndata: ${JSON.stringify(fileMetadata)}\n\n`);
            return fileMetadata;
          })().catch((error) => {
            logger.error('Error processing artifact content:', error);
            return null;
          }),
        );
      }
      return;
    }

    {
      if (output.name !== Tools.execute_code) {
        return;
      }
    }

    if (!output.artifact.files) {
      return;
    }

    for (const file of output.artifact.files) {
      const { id, name } = file;
      artifactPromises.push(
        (async () => {
          const result = await loadAuthValues({
            userId: req.user.id,
            authFields: [EnvVar.CODE_API_KEY],
          });
          const fileMetadata = await processCodeOutput({
            req,
            id,
            name,
            apiKey: result[EnvVar.CODE_API_KEY],
            messageId: metadata.run_id,
            toolCallId: output.tool_call_id,
            conversationId: metadata.thread_id,
            session_id: output.artifact.session_id,
          });
          if (!res.headersSent) {
            return fileMetadata;
          }

          if (!fileMetadata) {
            return null;
          }

          res.write(`event: attachment\ndata: ${JSON.stringify(fileMetadata)}\n\n`);
          return fileMetadata;
        })().catch((error) => {
          logger.error('Error processing code output:', error);
          return null;
        }),
      );
    }
  };
}

module.exports = {
  getDefaultHandlers,
  createToolEndCallback,
};
