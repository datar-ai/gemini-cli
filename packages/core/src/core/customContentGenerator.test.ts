/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CustomContentGenerator } from './customContentGenerator.js';
import { GenerateContentParameters } from './contentGenerator.js';

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

describe('CustomContentGenerator', () => {
  const endpoint = 'https://fake-azure.openai.azure.com';
  const apiKey = 'test-api-key';
  let generator: CustomContentGenerator;

  beforeEach(() => {
    generator = new CustomContentGenerator(endpoint, apiKey);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw an error if endpoint is not provided', () => {
      expect(() => new CustomContentGenerator('')).toThrow(
        'Custom LLM API endpoint is required for CustomContentGenerator.',
      );
    });
  });

  describe('generateContent', () => {
    const mockRequest: GenerateContentParameters = {
      model: 'test-deployment',
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      config: { temperature: 0.5 },
    };

    it('should make a POST request to the correct Azure OpenAI chat completions endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { role: 'assistant', content: 'Hi there!' },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      await generator.generateContent(mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        `${endpoint}/openai/deployments/test-deployment/chat/completions?api-version=2024-02-15-preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': apiKey,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.5,
            top_p: undefined,
          }),
        },
      );
    });

    it('should return mapped response from Azure OpenAI', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { role: 'assistant', content: 'Hi there!' },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const response = await generator.generateContent(mockRequest);

      expect(response).toEqual({
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Hi there!' }],
            },
            finishReason: 'stop',
          },
        ],
      });
    });

    it('should throw an error if the API request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(generator.generateContent(mockRequest)).rejects.toThrow(
        'Azure OpenAI API request failed with status 500: Internal Server Error',
      );
    });
  });

  describe('generateContentStream', () => {
    const mockRequest: GenerateContentParameters = {
      model: 'test-deployment-stream',
      contents: [{ role: 'user', parts: [{ text: 'Stream test' }] }],
      config: { temperature: 0.7 },
    };

    function createMockReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      let chunkIndex = 0;
      return new ReadableStream({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(encoder.encode(chunks[chunkIndex]));
            chunkIndex++;
          } else {
            controller.close();
          }
        },
      });
    }

    it('should make a POST request with stream:true and handle SSE response', async () => {
      const sseEvents = [
        'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockReadableStream(sseEvents),
      });

      const stream = await generator.generateContentStream(mockRequest);
      const responses = [];
      for await (const res of stream) {
        responses.push(res);
      }

      expect(mockFetch).toHaveBeenCalledWith(
        `${endpoint}/openai/deployments/test-deployment-stream/chat/completions?api-version=2024-02-15-preview`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(expect.objectContaining({ stream: true })),
        }),
      );

      expect(responses).toEqual([
        {
          candidates: [{ content: { role: 'model', parts: [{ text: 'Hello' }] }, finishReason: null }],
        },
        {
          candidates: [{ content: { role: 'model', parts: [{ text: ' world' }] }, finishReason: null }],
        },
        {
          candidates: [{ content: { role: 'model', parts: [] }, finishReason: 'stop'}]
        }
      ]);
    });
  });

  describe('countTokens', () => {
    it('should return a naive token count and log a warning', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const response = await generator.countTokens({
        model: 'any-model',
        contents: [{ role: 'user', parts: [{ text: 'Count these words.' }] }],
      });
      expect(response.totalTokens).toBe(3); // Naive count
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('CustomContentGenerator.countTokens is using a naive placeholder'),
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe('embedContent', () => {
    const mockEmbedRequest = {
      model: 'text-embedding-ada-002', // Example deployment ID
      contents: [{ role: 'user', parts: [{ text: 'Embed this text.' }] }],
    };

    it('should make a POST request to the correct Azure OpenAI embeddings endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        }),
      });

      await generator.embedContent(mockEmbedRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        `${endpoint}/openai/deployments/text-embedding-ada-002/embeddings?api-version=2024-02-15-preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': apiKey,
          },
          body: JSON.stringify({ input: 'Embed this text.' }),
        },
      );
    });

    it('should return mapped embeddings from Azure OpenAI', async () => {
       mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        }),
      });
      const response = await generator.embedContent(mockEmbedRequest);
      expect(response).toEqual({
        embeddings: [{ values: [0.1, 0.2, 0.3] }],
      });
    });

    it('should throw an error if deployment ID (model) is not provided for embeddings', async () => {
      await expect(
        generator.embedContent({ ...mockEmbedRequest, model: '' }),
      ).rejects.toThrow(
        'Deployment ID (as model name) is required for embedContent with Azure OpenAI.',
      );
    });
  });
});
