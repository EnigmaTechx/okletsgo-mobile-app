/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/src/**/*.test.ts", "**/src/**/*.test.tsx"],
  // Native Firebase has no JS fallback under Jest; the pure services under
  // test only need the module to import, so every export becomes a no-op.
  moduleNameMapper: {
    "^@react-native-firebase/(.*)$": "<rootDir>/jest/firebaseMock.js",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|expo-router|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)",
  ],
};
