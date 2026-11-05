# Base44 integration

This project is CLI-ready and keeps Base44 optional. The extension's product
detection, analysis, storage, and UI work locally without a Base44 account.

Set `VITE_BASE44_APP_ID` (and optionally `VITE_BASE44_APP_BASE_URL` and
`VITE_BASE44_FUNCTIONS_VERSION`) to enable the SDK client in
`src/services/base44.ts`.

Useful commands:

```sh
npx base44 --help
npx base44 link
npx base44 build
npx base44 deploy
```

Do not put access tokens or private service credentials in the extension bundle.
