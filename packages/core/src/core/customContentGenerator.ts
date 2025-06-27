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
  Content, // Now re-exported from contentGenerator.js
  Part, // Now re-exported from contentGenerator.js
} from './contentGenerator.js';

// TextPart is not re-exported from contentGenerator.js, so keep its local definition
interface TextPart {
  text: string;
}

interface AzureMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

export class CustomContentGenerator implements ContentGenerator {
  constructor(
    private endpoint: string,
    private apiKey?: string,
  ) {
    if (!endpoint) {
      throw new Error(
        'Custom LLM API endpoint is required for CustomContentGenerator.',
      );
    }
  }

  // TODO: Make API version configurable
  private readonly API_VERSION = '2024-02-15-preview';

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Ocp-Apim-Subscription-Key'] = this.apiKey;
    }
    return headers;
  }

  // Helper to map @google/genai Content to Azure OpenAI Message format
  private mapToAzureMessages(
    contents: GenerateContentParameters['contents'],
  ): AzureMessage[] {
    const contentArray: Content[] = typeof contents === 'string'
      ? [{ parts: [{ text: contents }], role: 'user' }]
      : contents as Content[]; // Explicitly cast to Content[]

    // TODO: More robust mapping, handle different part types (e.g. FunctionCallPart, FileDataPart)
    return contentArray.map((content: Content) => {
      const partsText = content.parts
        ?.map((part: Part) => ('text' in part ? (part as TextPart).text : '')) // Add null check for content.parts
        .join(' ') || ''; // Ensure partsText is always a string

      let role: 'user' | 'assistant' | 'tool';
      if (content.role === 'model') {
        role = 'assistant';
      } else if (content.role === 'user') {
        role = 'user';
      } else if (content.role === 'tool') {
        role = 'tool';
      } else {
        role = 'user'; // Default role
      }

      return {
        role,
        content: partsText,
      };
    });
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const deploymentId = request.model || 'default-deployment'; // Assuming model field carries deployment_id
    const url = `${this.endpoint}/openai/deployments/${deploymentId}/chat/completions?api-version=${this.API_VERSION}`;

    const azureRequestBody = {
      messages: this.mapToAzureMessages(request.contents),
      // TODO: Map other parameters like temperature, topP, tools from request.config
      temperature: request.config?.temperature,
      top_p: request.config?.topP,
      // max_tokens: request.config?.maxOutputTokens, // Need to check correct mapping
      // tools: request.config?.tools?.[0]?.functionDeclarations, // Needs proper mapping
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(azureRequestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Azure OpenAI API request failed with status ${response.status}: ${errorBody}`,
      );
    }

    const azureResponse = await response.json();

    // TODO: More robust mapping, handle tool_calls, finish_reason, safety_ratings etc.
    const firstChoice = azureResponse.choices?.[0];
    if (!firstChoice) {
      throw new Error('Azure OpenAI response did not contain expected choices.');
    }

    return {
      candidates: [
        {
          content: {
            role: 'model', // Assuming Azure 'assistant' role maps to 'model'
            parts: [{ text: firstChoice.message?.content || '' }],
          },
          finishReason: firstChoice.finish_reason,
          // TODO: Map other fields like index, citationMetadata, safetyRatings
        },
      ],
      text: firstChoice.message?.content || '', // Ensure text is string
      data: undefined, // Set to undefined if optional
      functionCalls: undefined, // Set to undefined if optional
      executableCode: undefined, // Set to undefined if optional
      codeExecutionResult: undefined, // Set to undefined if optional
      // TODO: Map promptFeedback, usageMetadata
    };
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const deploymentId = request.model || 'default-deployment';
    const url = `${this.endpoint}/openai/deployments/${deploymentId}/chat/completions?api-version=${this.API_VERSION}`;

    const azureRequestBody = {
      messages: this.mapToAzureMessages(request.contents),
      temperature: request.config?.temperature,
      top_p: request.config?.topP,
      stream: true,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(azureRequestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Azure OpenAI API stream request failed with status ${response.status}: ${errorBody}`,
      );
    }

    if (!response.body) {
      throw new Error('Azure OpenAI stream response body is null.');
    }

    // Implement SSE parsing
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    async function* streamGenerator(): AsyncGenerator<GenerateContentResponse> {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            // Process any remaining data in buffer
            // This case might not be typical for valid SSE streams ending with 'done'
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
                      // index: firstChoice.index, // Usually 0 for streaming delta
                    },
                  ],
                  text: firstChoice.delta.content || '', // Ensure text is string
                  data: undefined, // Set to undefined if optional
                  functionCalls: undefined, // Set to undefined if optional
                  executableCode: undefined, // Set to undefined if optional
                  codeExecutionResult: undefined, // Set to undefined if optional
                };
              } else if (firstChoice?.finish_reason) {
                 yield {
                   candidates: [{
                     content: { role: 'model', parts: []}, // No new content
                     finishReason: firstChoice.finish_reason,
                   }],
                   text: '', // Ensure text is string
                   data: undefined, // Set to undefined if optional
                   functionCalls: undefined, // Set to undefined if optional
                   executableCode: undefined, // Set to undefined if optional
                   codeExecutionResult: undefined, // Set to undefined if optional
                 }
              }
            } catch (e) {
              console.error('Error parsing SSE JSON chunk:', e, jsonData);
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
    // Azure OpenAI typically uses client-side token counting with tiktoken.
    // This project doesn't have tiktoken as a dependency.
    // For now, returning a very naive estimate or throwing NotImplementedError.
    // TODO: Discuss integrating tiktoken or alternative server-side if available.
    console.warn(
      'CustomContentGenerator.countTokens is using a naive placeholder. For accurate token counting for Azure OpenAI, consider integrating a library like tiktoken.',
    );
    const contentArray: Content[] = typeof request.contents === 'string'
      ? [{ parts: [{ text: request.contents }], role: 'user' }]
      : request.contents as Content[]; // Explicitly cast to Content[]

    const textContent = contentArray
      .flatMap((content: Content) => content.parts || []) // Add null check for content.parts
      .map((part: Part) => ('text' in part ? (part as TextPart).text : '')) // Cast to TextPart
      .join(' ');
    // Super naive: split by space. Real tokenization is much more complex.
    return { totalTokens: textContent.split(/\s+/).length };
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Assuming request.model contains the deployment ID for embeddings
    const deploymentId = request.model;
    if (!deploymentId) {
      throw new Error(
        'Deployment ID (as model name) is required for embedContent with Azure OpenAI.',
      );
    }
    const url = `${this.endpoint}/openai/deployments/${deploymentId}/embeddings?api-version=${this.API_VERSION}`;

    // Azure OpenAI embeddings API expects a single string or array of strings in 'input'.
    // The EmbedContentParameters has 'contents' which are individual strings.
    // We need to decide if we send them one by one or batch.
    // The genai SDK's EmbedContentParameters has `contents: string[]`
    // but the request in `customContentGenerator` is `EmbedContentParameters` from `@google/genai` which is
    // `contents: Content[]` where `Content` is `{ parts: Part[], role?: string }`.
    // This mapping needs clarification. For now, let's assume we take the first text part of each content.
    const contentArray: Content[] = typeof request.contents === 'string'
      ? [{ parts: [{ text: request.contents }], role: 'user' }]
      : request.contents as Content[]; // Explicitly cast to Content[]

    if (contentArray.length === 0) {
      return { embeddings: [] };
    }

    // For simplicity, let's assume the input is a single string for now,
    // taken from the first text part of the first content object.
    // A robust implementation would handle multiple inputs and batching if the API supports it.
    const inputText = contentArray[0]?.parts // contentArray[0] can be undefined
      ?.filter((part: Part) => 'text' in part) // Add null check for parts
      .map((part: Part) => ('text' in part ? (part as TextPart).text : '')) // Cast to TextPart and handle undefined text
      .join(' ');

    if (!inputText) {
        throw new Error("No text found in input for embeddings.");
    }

    const azureRequestBody = {
      input: inputText, // Or handle request.contents as an array of strings if API supports batching
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(azureRequestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Azure OpenAI Embeddings API request failed with status ${response.status}: ${errorBody}`,
      );
    }

    const azureResponse = await response.json();

    // Assuming the response structure is like: { data: [{ embedding: number[], index: number, object: string }], model: string, object: string, usage: { prompt_tokens: number, total_tokens: number } }
    const embeddings = azureResponse.data?.map((item: any) => ({
      values: item.embedding,
      // TODO: genai SDK's Embedding interface doesn't have an index, but Azure's does.
    }));

    if (!embeddings || embeddings.length === 0) {
      throw new Error(
        'Azure OpenAI Embeddings response did not contain expected data.',
      );
    }

    return { embeddings };
  }
}
