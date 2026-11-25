# Evenlease: Tenant Screening Checklist (A008-evenlease)

React Native + Expo SDK 58 (expo-router, TypeScript strict, React Compiler) · SQLite (expo-sqlite + Drizzle) ·
i18next (EN) · Jest (jest-expo, better-sqlite3 for DB tests). Offline: no server, no account, no analytics.

- Brief / status: `APP.md`, `CHECKLIST.md`, `PLAN.md` · features: `product.md` · mockup: `design/`
- Routes and file ownership per session: `docs/ROUTES.md`
- Check: `npm run check` (= `npx expo lint` + `npx tsc --noEmit` + `npx jest`)
- Dev build on a device: `npx expo run:android --device` · DB migrations: `npm run db:generate`

**TODO (before the first store build):** bundle ID / Android package is temporary — `com.maglobal.evenlease` in
`app.json` until Phương confirms it. `ITSAppUsesNonExemptEncryption` is `false` for now; re-check in 6B because the
backup file is AES-encrypted (user data protection, normally exempt).
