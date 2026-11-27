# src/backup — S-22 Backup & restore (2E)

- `format.ts` — envelope: header (magic "EVLBAK", version, PBKDF2-SHA256 cost, salt, nonce, key check, header checksum) +
  AES-256-GCM (`@noble/ciphers`). Errors: `not_backup` · `newer_version` · `wrong_password` · `corrupt` · `no_password`.
  `BACKUP_KDF.iterations` is written into each file — tune it after timing on the A13 without breaking old files.
- `kdf.ts` — PBKDF2-HMAC-SHA256 (B-101): native `modules/evenlease-crypto` (Android HMAC loop on the password bytes,
  iOS CommonCrypto) once it reproduces fixed vectors in this app run, else `@noble/hashes` (Jest, web, old builds).
  Same bytes → same key, so files from either path open with the other; header / format unchanged.
- `pack.ts` — zip (fflate): `manifest.json` (schema version = drizzle migrations count, SHA-256 per file) + `data.json`
  (1C `dumpAll`) + `files/<applicants|rentals>/…`. Unpack checks everything before any write.
- `service.ts` — `buildBackup`, `recordBackup`, `openBackup` (decrypt + verify, no change), `restoreBackup` (files to
  `restore-staging/`, rows in one transaction via 1C `replaceAllData`, then swap). Phone-only settings (`deviceStore.ts`:
  lock, folder, onboarding, `device.*` incl. the derived backup key) never go into a file and survive a restore.
- `auto.ts` — weekly backup into the picked folder (keeps newest 3), 30-day reminder (S-02 banner, "Later" = 7 days).
- `actions.ts` — S-22 buttons (`makeBackupActions(env)`); `index.ts` binds them to the phone + hooks
  `useBackupStatus`, `useBackupReminder`. `native.ts` — expo-file-system / SAF / picker / sharing / expo-crypto.
- `backgroundTask.ts` — `TaskManager.defineTask`, imported from the app's `index.ts` before `expo-router/entry` (the task must be defined at
  JS start-up, outside any route file).
