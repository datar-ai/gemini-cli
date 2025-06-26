/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OpenRouterContentGenerator } from './openRouterContentGenerator.js';
import { GenerateContentParameters } from './contentGenerator.js';

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

describe('OpenRouterContentGenerator', () => {
  const apiKey = 'test-openrouter-api-key';
  const siteUrl = 'http://test-site.com';
  const siteName = 'Test Site';
  let generator: OpenRouterContentGenerator;

  beforeEach(() => {
    generator = new OpenRouterContentGenerator(apiKey);
    // Mock process.env for optional headers for consistent testing if they were implemented
    // vi.stubEnv('OPENROUTER_SITE_URL', siteUrl);
    // vi.stubEnv('OPENROUTER_SITE_NAME', siteName);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // vi.unstubAllEnvs();
  });

  describe('constructor', () => {
    it('should throw an error if API key is not provided', () => {
      expect(() => new OpenRouterContentGenerator('')).toThrow(
        'OpenRouter API key is required for OpenRouterContentGenerator.',
      );
    });
  });

  describe('generateContent', () => {
    const mockRequest: GenerateContentParameters = {
      model: 'openai/gpt-4o',
      contents: [{ role: 'user', parts: [{ text: 'Hello OpenRouter' }] }],
      config: { temperature: 0.6 },
    };

    it('should throw an error if model is not provided in request', async () => {
      const requestWithoutModel = { ...mockRequest, model: undefined };
      await expect(generator.generateContent(requestWithoutModel as any)).rejects.toThrow(
        'Model name is required for OpenRouter generateContent.',
      );
    });

    it('should make a POST request to the OpenRouter chat completions endpoint with correct headers and body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { role: 'assistant', content: 'Hi from OpenRouter!' },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      await generator.generateContent(mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            // Optional headers would be checked here if implemented and configured
            // 'HTTP-Referer': siteUrl,
            // 'X-Title': siteName,
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o',
            messages: [{ role: 'user', content: 'Hello OpenRouter' }],
            temperature: 0.6,
            top_p: undefined,
          }),
        },
      );
    });

    it('should return mapped response from OpenRouter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { role: 'assistant', content: 'Hi from OpenRouter!' },
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
              parts: [{ text: 'Hi from OpenRouter!' }],
            },
            finishReason: 'stop',
          },
        ],
      });
    });

    it('should throw an error if the API request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(generator.generateContent(mockRequest)).rejects.toThrow(
        'OpenRouter API request failed with status 401: Unauthorized',
      );
    });
  });

  describe('generateContentStream', () => {
    const mockRequest: GenerateContentParameters = {
      model: 'openai/gpt-3.5-turbo',
      contents: [{ role: 'user', parts: [{ text: 'Stream this' }] }],
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
        'data: {"choices":[{"delta":{"content":"Streaming"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":" test"},"finish_reason":null}]}\n\n',
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
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(expect.objectContaining({
            model: 'openai/gpt-3.5-turbo',
            stream: true
          })),
          headers: expect.objectContaining({
             Authorization: `Bearer ${apiKey}`,
          })
        }),
      );

      expect(responses).toEqual([
        {
          candidates: [{ content: { role: 'model', parts: [{ text: 'Streaming' }] }, finishReason: null }],
        },
        {
          candidates: [{ content: { role: 'model', parts: [{ text: ' test' }] }, finishReason: null }],
        },
        {
          candidates: [{ content: { role: 'model', parts: [] }, finishReason: 'stop'}]
        }
      ]);
    });
     it('should throw an error if model is not provided in stream request', async () => {
      const requestWithoutModel = { ...mockRequest, model: undefined };
      await expect(generator.generateContentStream(requestWithoutModel as any)).rejects.toThrow(
        'Model name is required for OpenRouter generateContentStream.',
      );
    });
  });

  describe('countTokens', () => {
    it('should return a naive token count and log a warning', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const response = await generator.countTokens({
        model: 'any-model', // model is part of CountTokensParameters but not used by naive impl
        contents: [{ role: 'user', parts: [{ text: 'Count these words for OpenRouter.' }] }],
      });
      expect(response.totalTokens).toBe(5); // Naive count
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('OpenRouterContentGenerator.countTokens is using a naive placeholder'),
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe('embedContent', () => {
    it('should throw NotImplementedError and log a warning', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      await expect(
        generator.embedContent({ model: 'any-model', contents: [] }),
      ).rejects.toThrow(
        'Embeddings are not currently supported for OpenRouter via this generator.',
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('OpenRouterContentGenerator.embedContent is not yet implemented'),
      );
      consoleWarnSpy.mockRestore();
    });
  });
});
