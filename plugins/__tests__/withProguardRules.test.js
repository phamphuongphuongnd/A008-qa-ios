/* B-100: R8 must keep Room's generated database constructor (WorkManager → expo-background-task). */
const { RULES, applyRules } = require('../withProguardRules');

describe('withProguardRules', () => {
  it('keeps the RoomDatabase no-arg constructor and the WorkManager reflection targets', () => {
    expect(RULES).toContain('-keep class * extends androidx.room.RoomDatabase { <init>(); }');
    expect(RULES.join('\n')).toMatch(/ListenableWorker \{ public <init>\(android\.content\.Context, androidx\.work\.WorkerParameters\); \}/);
  });

  it('appends after the template rules and stays idempotent', () => {
    const template = '# react-native-reanimated\n-keep class com.swmansion.reanimated.** { *; }\n';
    const once = applyRules(template);
    expect(once.startsWith(template.trim())).toBe(true);
    expect(once).toContain('androidx.room.RoomDatabase { <init>(); }');
    expect(applyRules(once)).toBe(once);
    expect(once.match(/@evenlease-proguard-begin/g)).toHaveLength(1);
  });

  it('works when the file does not exist yet', () => {
    expect(applyRules('')).toMatch(/^# @evenlease-proguard-begin[\s\S]*# @evenlease-proguard-end\n$/);
  });
});
