/**
 * App entry. Background work must be registered at bundle load, before (or without) any screen rendering:
 * Android may start the JS runtime headless for the WorkManager job (fact expo-native-v2-gotchas — TaskManager.defineTask
 * must not live in a route file). package.json "main" points here instead of "expo-router/entry".
 *
 * TODO(2E): `import './src/backup/backgroundTask';` (automatic weekly backup, expo-background-task) above the router.
 */
import 'expo-router/entry';
