/**
 * App entry. Background work must be registered at bundle load, before (or without) any screen rendering:
 * Android may start the JS runtime headless for the WorkManager job (fact expo-native-v2-gotchas — TaskManager.defineTask
 * must not live in a route file). package.json "main" points here instead of "expo-router/entry".
 * 2E: the weekly automatic backup task (expo-background-task) is defined here, above the router.
 */
import './src/backup/backgroundTask';
import 'expo-router/entry';
