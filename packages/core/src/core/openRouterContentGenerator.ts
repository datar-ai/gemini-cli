/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ContentGenerator,
  GenerateContentParameters,
  GenerateContentResponse,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
} from './contentGenerator.js';

// TODO: Consider adding optional support for HTTP-Referer and X-Title headers via config.

export class OpenRouterContentGenerator implements ContentGenerator {
  private readonly BASE_URL = 'https://openrouter.ai/api/v1';

  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error(
        'OpenRouter API key is required for OpenRouterContentGenerator.',
      );
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      // Optional headers for OpenRouter analytics/ranking:
      // 'HTTP-Referer': 'YOUR_SITE_URL', // Or get from config
      // 'X-Title': 'YOUR_SITE_NAME', // Or get from config
    };
  }

  // Helper to map @google/genai Content to OpenAI/OpenRouter Message format
  private mapToOpenAiMessages(
    contents: GenerateContentParameters['contents'],
  ): any[] {
    // TODO: More robust mapping, handle different part types (e.g. FunctionCallPart, FileDataPart)
    // This mapping is similar to the one used for Azure OpenAI
    return contents.map((content) => {
      const partsText = content.parts
        .map((part) => ('text' in part ? part.text : ''))
        .join(' ');
      return {
        role: content.role === 'model' ? 'assistant' : content.role,
        content: partsText,
      };
    });
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    if (!request.model) {
      throw new Error('Model name is required for OpenRouter generateContent.');
    }
    const url = `${this.BASE_URL}/chat/completions`;

    const openRouterRequestBody = {
      model: request.model,
      messages: this.mapToOpenAiMessages(request.contents),
      temperature: request.config?.temperature,
      top_p: request.config?.topP,
      // TODO: Map other relevant parameters from request.config (e.g., max_tokens, tools)
      // max_tokens: request.config?.maxOutputTokens,
      // tools: request.config?.tools?.[0]?.functionDeclarations, // Needs proper OpenAI mapping
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(openRouterRequestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenRouter API request failed with status ${response.status}: ${errorBody}`,
      );
    }

    const openRouterResponse = await response.json();

    // TODO: More robust mapping from OpenRouter response to GenerateContentResponse
    // (tool_calls, finish_reason details, safety_ratings, promptFeedback, usageMetadata)
    const firstChoice = openRouterResponse.choices?.[0];
    if (!firstChoice) {
      throw new Error(
        'OpenRouter response did not contain expected choices.',
      );
    }

    return {
      candidates: [
        {
          content: {
            role: 'model', // Assuming OpenRouter 'assistant' role maps to 'model'
            parts: [{ text: firstChoice.message?.content || '' }],
          },
          finishReason: firstChoice.finish_reason,
        },
      ],
    };
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    if (!request.model) {
      throw new Error(
        'Model name is required for OpenRouter generateContentStream.',
      );
    }
    const url = `${this.BASE_URL}/chat/completions`;

    const openRouterRequestBody = {
      model: request.model,
      messages: this.mapToOpenAiMessages(request.contents),
      temperature: request.config?.temperature,
      top_p: request.config?.topP,
      stream: true,
      // TODO: Map other relevant parameters
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(openRouterRequestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenRouter API stream request failed with status ${response.status}: ${errorBody}`,
      );
    }

    if (!response.body) {
      throw new Error('OpenRouter stream response body is null.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // This SSE parsing logic is similar to the one for Azure OpenAI
    async function* streamGenerator(): AsyncGenerator<GenerateContentResponse> {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            console.warn('SSE stream ended with unprocessed data in buffer:', buffer);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let eolIndex;
        while ((eolIndex = buffer.indexOf('\n\n')) >= 0) {
          const line = buffer.substring(0, eolIndex).trim();
          buffer = buffer.substring(eolIndex + 2);

          if (line.startsWith('data: ')) {
            const jsonData = line.substring('data: '.length);
            if (jsonData === '[DONE]') {
              return; // Stream finished
            }
            try {
              const chunk = JSON.parse(jsonData);
              const firstChoice = chunk.choices?.[0];
              if (firstChoice?.delta?.content) {
                yield {
                  candidates: [
                    {
                      content: {
                        role: 'model',
                        parts: [{ text: firstChoice.delta.content }],
                      },
                      finishReason: firstChoice.finish_reason,
                    },
                  ],
                };
              } else if (firstChoice?.finish_reason) {
                 yield {
                   candidates: [{
                     content: { role: 'model', parts: []},
                     finishReason: firstChoice.finish_reason,
                   }]
                 }
              }
            } catch (e) {
              console.error('Error parsing OpenRouter SSE JSON chunk:', e, jsonData);
            }
          }
        }
      }
    }
    return streamGenerator();
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // OpenRouter, like OpenAI, generally relies on client-side token counting.
    // TODO: Investigate if OpenRouter offers any server-side token counting or if
    // we should integrate a library like 'tiktoken' here.
    console.warn(
      'OpenRouterContentGenerator.countTokens is using a naive placeholder. For accurate token counting, consider client-side tokenization.',
    );
    const textContent = request.contents
      .flatMap((content) => content.parts)
      .map((part) => ('text' in part ? part.text : ''))
      .join(' ');
    return { totalTokens: textContent.split(/\s+/).length }; // Extremely naive
  }

  async embedContent(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // TODO: Check if OpenRouter offers an embeddings API.
    // If not, this should throw a clear NotImplementedError.
    console.warn(
      'OpenRouterContentGenerator.embedContent is not yet implemented. Check if OpenRouter provides an embeddings API.',
    );
    throw new Error(
      'Embeddings are not currently supported for OpenRouter via this generator.',
    );
  }
}
