# mobile-code (React Native + Expo)

This repository now contains a React Native + Expo port of the moCODE concept: a mobile AI coding client with session management, chat, model selection, and server configuration.

## What is included

- Session management (create, archive, restore, delete)
- Chat UI with per-session messages
- Model registry with favorites
- Default model selection and per-session model selection
- Settings screen with configurable server URL
- Local persistence for sessions, favorites, and settings
- API client scaffolding for chat requests

## Quick start

```bash
npm install
npm run start
```

Then open with Expo Go (Android/iOS) or run:

```bash
npm run android
npm run ios
npm run web
```

## Notes

- If no server URL is configured, chat returns a local preview response.
- When configured, the app tries these endpoints in order:
  - `/api/chat`
  - `/api/v1/chat`
  - `/chat`

## Tech

- Expo
- React Native
- TypeScript
- AsyncStorage for local state persistence
