## Authentication Setup

The Gemini CLI requires you to authenticate with Google's AI services. On initial startup you'll need to configure **one** of the following authentication methods:

1.  **Login with Google (Gemini Code Assist):**

    - Use this option to log in with your google account.
    - During initial startup, Gemini CLI will direct you to a webpage for authentication. Once authenticated, your credentials will be cached locally so the web login can be skipped on subsequent runs.
    - Note that the web login must be done in a browser that can communicate with the machine Gemini CLI is being run from. (Specifically, the browser will be redirected to a localhost url that Gemini CLI will be listening on).
    - Users may have to specify a GOOGLE_CLOUD_PROJECT if:
      1. You have a Google Workspace account. Google Workspace is a paid service for businesses and organizations that provides a suite of productivity tools, including a custom email domain (e.g. your-name@your-company.com), enhanced security features, and administrative controls. These accounts are often managed by an employer or school.
      2. You are a licensed Code Assist user. This can happen if you have previously purchased a Code Assist license or have acquired one through Google Developer Program.
      - If you fall into one of these categories, you must first configure a Google Cloud Project Id to use, [enable the Gemini for Cloud API](https://cloud.google.com/gemini/docs/discover/set-up-gemini#enable-api) and [configure access permissions](https://cloud.google.com/gemini/docs/discover/set-up-gemini#grant-iam). You can temporarily set the environment variable in your current shell session using the following command:
        ```bash
        export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
        ```
        - For repeated use, you can add the environment variable to your `.env` file (located in the project directory or user home directory) or your shell's configuration file (like `~/.bashrc`, `~/.zshrc`, or `~/.profile`). For example, the following command adds the environment variable to a `~/.bashrc` file:
        ```bash
        echo 'export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"' >> ~/.bashrc
        source ~/.bashrc
        ```

2.  **<a id="gemini-api-key"></a>Gemini API key:**

    - Obtain your API key from Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
    - Set the `GEMINI_API_KEY` environment variable. In the following methods, replace `YOUR_GEMINI_API_KEY` with the API key you obtained from Google AI Studio:
      - You can temporarily set the environment variable in your current shell session using the following command:
        ```bash
        export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
        ```
      - For repeated use, you can add the environment variable to your `.env` file (located in the project directory or user home directory) or your shell's configuration file (like `~/.bashrc`, `~/.zshrc`, or `~/.profile`). For example, the following command adds the environment variable to a `~/.bashrc` file:
        ```bash
        echo 'export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"' >> ~/.bashrc
        source ~/.bashrc
        ```

3.  **<a id="workspace-gca"></a>Login with Google (Gemini Code Assist for Workspace or licensed Code Assist users):**

    (For more information, see: https://developers.google.com/gemini-code-assist/resources/faqs#gcp-project-requirement)

    - Use this option if:

      1. You have a Google Workspace account. Google Workspace is a paid service for businesses and organizations that provides a suite of productivity tools, including a custom email domain (e.g. your-name@your-company.com), enhanced security features, and administrative controls. These accounts are often managed by an employer or school.
      2. You are a licensed Code Assist user. This can happen if you have previously purchased a Code Assist license or have acquired one through Google Developer Program.

    - If you fall into one of these categories, you must first configure a Google Cloud Project Id to use, [enable the Gemini for Cloud API](https://cloud.google.com/gemini/docs/discover/set-up-gemini#enable-api) and [configure access permissions](https://cloud.google.com/gemini/docs/discover/set-up-gemini#grant-iam). You can temporarily set the environment variable in your current shell session using the following command:
      ```bash
      export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
      ```
      - For repeated use, you can add the environment variable to your `.env` file (located in the project directory or user home directory) or your shell's configuration file (like `~/.bashrc`, `~/.zshrc`, or `~/.profile`). For example, the following command adds the environment variable to a `~/.bashrc` file:
      ```bash
      echo 'export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"' >> ~/.bashrc
      source ~/.bashrc
      ```
    - During startup, Gemini CLI will direct you to a webpage for authentication. Once authenticated, your credentials will be cached locally so the web login can be skipped on subsequent runs.
    - Note that the web login must be done in a browser that can communicate with the machine Gemini CLI is being run from. (Specifically, the browser will be redirected to a localhost url that Gemini CLI will be listening on).

4.  **Vertex AI:**
    - If not using express mode:
      - Ensure you have a Google Cloud project and have enabled the Vertex AI API.
      - Set up Application Default Credentials (ADC), using the following command:
        ```bash
        gcloud auth application-default login
        ```
        For more information, see [Set up Application Default Credentials for Google Cloud](https://cloud.google.com/docs/authentication/provide-credentials-adc).
      - Set the `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and `GOOGLE_GENAI_USE_VERTEXAI` environment variables. In the following methods, replace `YOUR_PROJECT_ID` and `YOUR_PROJECT_LOCATION` with the relevant values for your project:
        - You can temporarily set these environment variables in your current shell session using the following commands:
          ```bash
          export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
          export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION" # e.g., us-central1
          export GOOGLE_GENAI_USE_VERTEXAI=true
          ```
        - For repeated use, you can add the environment variables to your `.env` file (located in the project directory or user home directory) or your shell's configuration file (like `~/.bashrc`, `~/.zshrc`, or `~/.profile`). For example, the following commands add the environment variables to a `~/.bashrc` file:
          ```bash
          echo 'export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"' >> ~/.bashrc
          echo 'export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION"' >> ~/.bashrc
          echo 'export GOOGLE_GENAI_USE_VERTEXAI=true' >> ~/.bashrc
          source ~/.bashrc
          ```

5.  **<a id="custom-llm"></a>Custom LLM Provider (e.g., Azure OpenAI):**

    - This option allows you to connect the Gemini CLI to a custom LLM provider that is compatible with the Azure OpenAI API style.
    - You will need to set the following environment variables:
      - `GEMINI_AUTH_TYPE="custom-llm"`: Specifies that you want to use a custom LLM provider.
      - `CUSTOM_LLM_ENDPOINT="YOUR_CUSTOM_LLM_ENDPOINT"`: The base endpoint for your custom LLM API. For Azure OpenAI, this would be the resource endpoint, e.g., `https://your-resource-name.openai.azure.com`. The CLI will append paths like `/openai/deployments/{deployment-id}/chat/completions?api-version={api-version}`.
      - `CUSTOM_LLM_API_KEY="YOUR_CUSTOM_LLM_SUBSCRIPTION_KEY"`: Your API key (subscription key) for the custom LLM provider. This key will be sent in the `Ocp-Apim-Subscription-Key` header.
      - `CUSTOM_LLM_MODEL_NAME="YOUR_DEPLOYMENT_ID"`: (Optional but Recommended) While the model/deployment ID can sometimes be part of the request payload, you can also set this environment variable to specify a default deployment ID to be used for chat completions and embeddings if not otherwise specified in the command or request. The `CustomContentGenerator` will use this as the `model` parameter in requests if no other model is specified.

    - **Example temporary setup for bash/zsh:**
      ```bash
      export GEMINI_AUTH_TYPE="custom-llm"
      export CUSTOM_LLM_ENDPOINT="https://your-azure-resource.openai.azure.com"
      export CUSTOM_LLM_API_KEY="your_azure_openai_subscription_key"
      export CUSTOM_LLM_MODEL_NAME="your_deployment_id" # e.g., gpt-35-turbo
      ```
    - **Example for adding to `~/.bashrc`:**
      ```bash
      echo 'export GEMINI_AUTH_TYPE="custom-llm"' >> ~/.bashrc
      echo 'export CUSTOM_LLM_ENDPOINT="https://your-azure-resource.openai.azure.com"' >> ~/.bashrc
      echo 'export CUSTOM_LLM_API_KEY="your_azure_openai_subscription_key"' >> ~/.bashrc
      echo 'export CUSTOM_LLM_MODEL_NAME="your_deployment_id"' >> ~/.bashrc
      source ~/.bashrc
      ```
    - **Important Notes:**
      - The current implementation assumes your custom LLM API behaves similarly to Azure OpenAI's API, particularly for chat completions and embeddings.
      - The API version used for Azure OpenAI calls is currently hardcoded (e.g., `2024-02-15-preview`). This might become configurable in the future.
      - Token counting for custom LLMs currently uses a naive placeholder. For accurate token counts with Azure OpenAI, client-side integration with a library like `tiktoken` is recommended but not yet implemented in the CLI.
      - The `model` parameter in requests to the `CustomContentGenerator` (e.g. via `-m` flag in CLI or in API calls) is typically used as the **deployment ID** for Azure OpenAI.

6.  **<a id="open-router"></a>OpenRouter:**

    - This option allows you to connect the Gemini CLI to [OpenRouter](https://openrouter.ai/), a service that provides access to a wide variety of LLMs through a unified API.
    - You will need to set the following environment variables:
      - `GEMINI_AUTH_TYPE="open-router"`: Specifies that you want to use OpenRouter.
      - `OPEN_ROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"`: Your API key obtained from your OpenRouter account.
    - You must also specify the model you wish to use with OpenRouter. This is done via the standard model flag (`-m` or `--model`) when running a command, or by setting the `GEMINI_DEFAULT_MODEL` environment variable. Example model strings include `openai/gpt-4o`, `anthropic/claude-3-opus`, `google/gemini-flash-1.5`, etc. Refer to the [OpenRouter documentation](https://openrouter.ai/docs#models) for a full list of available models.

    - **Example temporary setup for bash/zsh:**
      ```bash
      export GEMINI_AUTH_TYPE="open-router"
      export OPEN_ROUTER_API_KEY="sk-or-v1-abc123xyz789"
      # Then, when running the CLI:
      # gemini -m "anthropic/claude-3-haiku" "Summarize this document for me"
      # Or set a default model:
      # export GEMINI_DEFAULT_MODEL="anthropic/claude-3-haiku"
      # gemini "Summarize this document for me"
      ```
    - **Example for adding to `~/.bashrc`:**
      ```bash
      echo 'export GEMINI_AUTH_TYPE="open-router"' >> ~/.bashrc
      echo 'export OPEN_ROUTER_API_KEY="sk-or-v1-abc123xyz789"' >> ~/.bashrc
      # Optionally, set a default model for OpenRouter:
      # echo 'export GEMINI_DEFAULT_MODEL="anthropic/claude-3-haiku"' >> ~/.bashrc
      source ~/.bashrc
      ```
    - **Important Notes:**
      - The OpenRouter API endpoint (`https://openrouter.ai/api/v1`) is hardcoded in the CLI.
      - `countTokens`: Token counting currently uses a naive placeholder. For accurate counts, client-side tokenization (e.g., with `tiktoken`) would be needed, which is not yet integrated for this provider.
      - `embedContent`: Embeddings are not currently supported via the OpenRouter integration in the CLI, as a standard embeddings endpoint is not apparent in their primary API.

    - If using express mode:
      - Set the `GOOGLE_API_KEY` environment variable. In the following methods, replace `YOUR_GOOGLE_API_KEY` with your Vertex AI API key provided by express mode:
        - You can temporarily set these environment variables in your current shell session using the following commands:
          ```bash
          export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
          export GOOGLE_GENAI_USE_VERTEXAI=true
          ```
        - For repeated use, you can add the environment variables to your `.env` file (located in the project directory or user home directory) or your shell's configuration file (like `~/.bashrc`, `~/.zshrc`, or `~/.profile`). For example, the following commands add the environment variables to a `~/.bashrc` file:
          ```bash
          echo 'export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"' >> ~/.bashrc
          echo 'export GOOGLE_GENAI_USE_VERTEXAI=true' >> ~/.bashrc
          source ~/.bashrc
          ```
