/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { createContentGenerator, AuthType } from './contentGenerator.js';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { GoogleGenAI } from '@google/genai';

vi.mock('../code_assist/codeAssist.js');
vi.mock('@google/genai');

import { CustomContentGenerator } from './customContentGenerator.js';

import { OpenRouterContentGenerator } from './openRouterContentGenerator.js';

vi.mock('../code_assist/codeAssist.js');
vi.mock('@google/genai');
vi.mock('./customContentGenerator.js');
vi.mock('./openRouterContentGenerator.js');

describe('createContentGeneratorConfig', () => {
  // TODO: Add tests for createContentGeneratorConfig focusing on CUSTOM_LLM and OPEN_ROUTER
  // For example, checking if environment variables are correctly read.
  // This requires more setup for mocking process.env, so skipping for this iteration
  // but noting it as important.
});

describe('createContentGenerator', () => {
  it('should create a CodeAssistContentGenerator for LOGIN_WITH_GOOGLE_PERSONAL', async () => {
    const mockGenerator = {} as unknown;
    vi.mocked(createCodeAssistContentGenerator).mockResolvedValue(
      mockGenerator as never,
    );
    const generator = await createContentGenerator({
      model: 'test-model',
      authType: AuthType.LOGIN_WITH_GOOGLE_PERSONAL,
    });
    expect(createCodeAssistContentGenerator).toHaveBeenCalled();
    expect(generator).toBe(mockGenerator);
  });

  it('should create a GoogleGenAI content generator for USE_GEMINI', async () => {
    const mockSdkGenerator = { models: {} };
    vi.mocked(GoogleGenAI).mockImplementation(() => mockSdkGenerator as any);

    const generator = await createContentGenerator({
      model: 'test-model',
      apiKey: 'test-gemini-api-key',
      authType: AuthType.USE_GEMINI,
    });

    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'test-gemini-api-key',
      vertexai: undefined,
      httpOptions: { headers: { 'User-Agent': expect.any(String) } },
    });
    expect(generator).toBe(mockSdkGenerator.models);
  });

  it('should create a GoogleGenAI content generator for USE_VERTEX_AI', async () => {
    const mockSdkGenerator = { models: {} };
    vi.mocked(GoogleGenAI).mockImplementation(() => mockSdkGenerator as any);

    const generator = await createContentGenerator({
      model: 'test-model',
      apiKey: 'test-vertex-api-key',
      vertexai: true,
      authType: AuthType.USE_VERTEX_AI,
    });

    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'test-vertex-api-key',
      vertexai: true,
      httpOptions: { headers: { 'User-Agent': expect.any(String) } },
    });
    expect(generator).toBe(mockSdkGenerator.models);
  });

  it('should create a CustomContentGenerator for CUSTOM_LLM', async () => {
    const mockCustomGeneratorInstance = {} as CustomContentGenerator;
    vi.mocked(CustomContentGenerator).mockImplementation(
      () => mockCustomGeneratorInstance,
    );

    const customEndpoint = 'http://localhost:1234/custom';
    const customApiKey = 'custom-key';

    const generator = await createContentGenerator({
      model: 'custom-model',
      authType: AuthType.CUSTOM_LLM,
      customLlmEndpoint: customEndpoint,
      customLlmApiKey: customApiKey,
    });

    expect(CustomContentGenerator).toHaveBeenCalledWith(
      customEndpoint,
      customApiKey,
    );
    expect(generator).toBe(mockCustomGeneratorInstance);
  });

  it('should throw an error if CUSTOM_LLM is specified but endpoint is missing', async () => {
    await expect(
      createContentGenerator({
        model: 'custom-model',
        authType: AuthType.CUSTOM_LLM,
        // customLlmEndpoint is missing
      }),
    ).rejects.toThrow(
      'Custom LLM endpoint is not configured. Please set the CUSTOM_LLM_ENDPOINT environment variable.',
    );
  });

  it('should create an OpenRouterContentGenerator for OPEN_ROUTER', async () => {
    const mockOpenRouterInstance = {} as OpenRouterContentGenerator;
    vi.mocked(OpenRouterContentGenerator).mockImplementation(
      () => mockOpenRouterInstance,
    );

    const openRouterApiKey = 'openrouter-key-xyz';

    const generator = await createContentGenerator({
      model: 'openai/gpt-4o', // Model string for OpenRouter
      authType: AuthType.OPEN_ROUTER,
      openRouterApiKey: openRouterApiKey,
    });

    expect(OpenRouterContentGenerator).toHaveBeenCalledWith(openRouterApiKey);
    expect(generator).toBe(mockOpenRouterInstance);
  });

  it('should throw an error if OPEN_ROUTER is specified but API key is missing', async () => {
    await expect(
      createContentGenerator({
        model: 'openai/gpt-4o',
        authType: AuthType.OPEN_ROUTER,
        // openRouterApiKey is missing
      }),
    ).rejects.toThrow(
      'OpenRouter API key is not configured. Please set the OPEN_ROUTER_API_KEY environment variable.',
    );
  });

  it('should throw an error for unsupported authType', async () => {
    await expect(
      createContentGenerator({
        model: 'test-model',
        authType: 'REALLY_UNSUPPORTED_AUTH_TYPE' as AuthType,
      }),
    ).rejects.toThrow(
      'Error creating contentGenerator: Unsupported or misconfigured authType: REALLY_UNSUPPORTED_AUTH_TYPE',
    );
  });
});
