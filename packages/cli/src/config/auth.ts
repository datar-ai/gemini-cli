/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@google/gemini-cli-core';
import { loadEnvironment } from './config.js';

export const validateAuthMethod = (authMethod: string): string | null => {
  loadEnvironment();
  if (authMethod === AuthType.LOGIN_WITH_GOOGLE_PERSONAL) {
    return null;
  }

  if (authMethod === AuthType.USE_GEMINI) {
    if (!process.env.GEMINI_API_KEY) {
      return 'GEMINI_API_KEY environment variable not found. Add that to your .env and try again, no reload needed!';
    }
    return null;
  }

  if (authMethod === AuthType.USE_VERTEX_AI) {
    const hasVertexProjectLocationConfig =
      !!process.env.GOOGLE_CLOUD_PROJECT && !!process.env.GOOGLE_CLOUD_LOCATION;
    const hasGoogleApiKey = !!process.env.GOOGLE_API_KEY;
    if (!hasVertexProjectLocationConfig && !hasGoogleApiKey) {
      return (
        'Must specify GOOGLE_GENAI_USE_VERTEXAI=true and either:\n' +
        '• GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION environment variables.\n' +
        '• GOOGLE_API_KEY environment variable (if using express mode).\n' +
        'Update your .env and try again, no reload needed!'
      );
    }
    return null;
  }

  if (authMethod === AuthType.CUSTOM_LLM) {
    if (!process.env.CUSTOM_LLM_ENDPOINT) {
      return 'CUSTOM_LLM_ENDPOINT environment variable not found. Add that to your .env and try again, no reload needed!';
    }
    if (!process.env.CUSTOM_LLM_API_KEY) {
      return 'CUSTOM_LLM_API_KEY environment variable not found. Add that to your .env and try again, no reload needed!';
    }
    return null;
  }

  if (authMethod === AuthType.OPEN_ROUTER) {
    if (!process.env.OPEN_ROUTER_API_KEY) {
      return 'OPEN_ROUTER_API_KEY environment variable not found. Add that to your .env and try again, no reload needed!';
    }
    // Model for OpenRouter is specified via -m flag or GEMINI_DEFAULT_MODEL, not a strict auth validation here.
    return null;
  }

  return `Invalid auth method selected: ${authMethod}. Please check your configuration or GEMINI_AUTH_TYPE environment variable.`;
};
