/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  GoogleGenAI,
} from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_GEMINI_MODEL } from '../config/models.js';
import { CustomContentGenerator } from './customContentGenerator.js';
import { getEffectiveModel } from './modelCheck.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE_PERSONAL = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CUSTOM_LLM = 'custom-llm',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string; // Used for GEMINI_API_KEY or GOOGLE_API_KEY (for Vertex)
  vertexai?: boolean;
  authType?: AuthType | undefined;
  customLlmEndpoint?: string;
  customLlmApiKey?: string; // Specifically for the custom LLM
};

export async function createContentGeneratorConfig(
  model: string | undefined,
  authType: AuthType | undefined,
  config?: { getModel?: () => string },
): Promise<ContentGeneratorConfig> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION;
  const customLlmEndpointEnv = process.env.CUSTOM_LLM_ENDPOINT;
  const customLlmApiKeyEnv = process.env.CUSTOM_LLM_API_KEY;

  // Use runtime model from config if available, otherwise fallback to parameter or default
  const effectiveModel = config?.getModel?.() || model || DEFAULT_GEMINI_MODEL;

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType,
  };

  // if we are using google auth nothing else to validate for now
  if (authType === AuthType.LOGIN_WITH_GOOGLE_PERSONAL) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.model = await getEffectiveModel(
      contentGeneratorConfig.apiKey,
      contentGeneratorConfig.model,
    );
    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    !!googleApiKey &&
    googleCloudProject &&
    googleCloudLocation
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;
    contentGeneratorConfig.model = await getEffectiveModel(
      contentGeneratorConfig.apiKey,
      contentGeneratorConfig.model,
    );
    return contentGeneratorConfig;
  }

  if (authType === AuthType.CUSTOM_LLM) {
    if (!customLlmEndpointEnv) {
      // Consider throwing an error or logging a warning if endpoint is missing
      console.warn(
        'CUSTOM_LLM auth type selected, but CUSTOM_LLM_ENDPOINT environment variable is not set.',
      );
    }
    contentGeneratorConfig.customLlmEndpoint = customLlmEndpointEnv;
    contentGeneratorConfig.customLlmApiKey = customLlmApiKeyEnv;
    // For custom LLM, the model name might be handled differently or come from the endpoint itself.
    // Here, we're keeping `effectiveModel` but it might need adjustment based on API specifics.
    // No model validation like getEffectiveModel is done here, assuming custom LLM handles it.
    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
): Promise<ContentGenerator> {
  const version = process.env.CLI_VERSION || process.version;
  const httpOptions = {
    headers: {
      'User-Agent': `GeminiCLI/${version} (${process.platform}; ${process.arch})`,
    },
  };
  if (config.authType === AuthType.LOGIN_WITH_GOOGLE_PERSONAL) {
    return createCodeAssistContentGenerator(httpOptions, config.authType);
  }

  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });

    return googleGenAI.models;
  }

  if (config.authType === AuthType.CUSTOM_LLM) {
    if (!config.customLlmEndpoint) {
      throw new Error(
        'Custom LLM endpoint is not configured. Please set the CUSTOM_LLM_ENDPOINT environment variable.',
      );
    }
    return new CustomContentGenerator(
      config.customLlmEndpoint,
      config.customLlmApiKey,
    );
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported or misconfigured authType: ${config.authType}`,
  );
}
