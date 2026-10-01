# SPIKE — Repository Setup

This is the repository-ready source package for SPIKE — Turn Insight Into Growth.

## Important
- Do not commit `.env` files or real API credentials.
- `.env.example` contains placeholders only.
- Configure secrets in the hosting provider's environment/secrets settings.

## Render
1. Create a public Git repository and upload the contents of this folder.
2. In Render, choose **Public Git Repository** and paste the repository URL.
3. Render can use the included `render.yaml` configuration.
4. Add the real `OPENAI_API_KEY` only in Render's environment/secrets settings.
5. Add payment credentials only when Peach Payments is actually configured.

## Local setup
```bash
npm install
npm run build
npm start
```

The server uses the environment variables documented in `.env.example`.
