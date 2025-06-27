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
import { OpenRouterContentGenerator } from './openRouterContentGenerator.js';
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
  OPEN_ROUTER = 'open-router',
}

export type ContentGeneratorConfig = {
  model: string; // For OpenRouter, this will be the specific model string like 'openai/gpt-4o'
  apiKey?: string; // Used for GEMINI_API_KEY or GOOGLE_API_KEY (for Vertex)
  vertexai?: boolean;
  authType?: AuthType | undefined;
  customLlmEndpoint?: string;
  customLlmApiKey?: string; // Specifically for the custom LLM (e.g. Azure)
  openRouterApiKey?: string; // Specifically for OpenRouter
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
  const openRouterApiKeyEnv = process.env.OPEN_ROUTER_API_KEY;

  // Use runtime model from config if available, otherwise fallback to parameter or default
  // For OpenRouter, `model` will be the specific model string, so DEFAULT_GEMINI_MODEL might not be appropriate
  // if authType is OPEN_ROUTER and no model is provided by user. This needs careful handling.
  // Let's assume for now that if authType is OPEN_ROUTER, `model` must be provided by the user.
  const effectiveModel = config?.getModel?.() || model; // Removed DEFAULT_GEMINI_MODEL for now

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

  if (authType === AuthType.OPEN_ROUTER) {
    if (!openRouterApiKeyEnv) {
      console.warn(
        'OPEN_ROUTER auth type selected, but OPEN_ROUTER_API_KEY environment variable is not set.',
      );
    }
    if (!effectiveModel && !config?.getModel?.()) {
      // If no model is provided via CLI arg (model) or config object (config.getModel),
      // and we removed DEFAULT_GEMINI_MODEL, this could be an issue.
      // OpenRouter requires a model. We should probably throw an error or have a default OpenRouter model.
      // For now, let's log a warning. The generator itself will throw if model is missing.
      console.warn(
        'OPEN_ROUTER auth type selected, but no model name was provided. OpenRouter requires a model name.',
      );
    }
    contentGeneratorConfig.openRouterApiKey = openRouterApiKeyEnv;
    // `effectiveModel` (which is `model` from CLI/config or undefined) is already set.
    // No specific model validation like getEffectiveModel for OpenRouter here.
    return contentGeneratorConfig;
  }

  // If effectiveModel is still undefined here (e.g. not CUSTOM_LLM or OPEN_ROUTER and no model provided)
  // assign the default. This was previously done at the top.
  if (!contentGeneratorConfig.model) {
    contentGeneratorConfig.model = DEFAULT_GEMINI_MODEL;
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

  if (config.authType === AuthType.OPEN_ROUTER) {
    if (!config.openRouterApiKey) {
      // This check might be redundant if createContentGeneratorConfig already warns,
      // but good for safety. Or createContentGeneratorConfig could throw.
      throw new Error(
        'OpenRouter API key is not configured. Please set the OPEN_ROUTER_API_KEY environment variable.',
      );
    }
    // Note: config.model is expected to be populated by createContentGeneratorConfig
    // with the user-specified OpenRouter model string.
    // The OpenRouterContentGenerator itself will validate if config.model is provided.
    return new OpenRouterContentGenerator(config.openRouterApiKey);
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported or misconfigured authType: ${config.authType}`,
  );
}
