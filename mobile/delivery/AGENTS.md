This is a bare React Native application using the React Native Community CLI, Metro, React Navigation, and NativeWind. Do not add Expo packages or Expo tooling.

## Development commands

- `npm start` starts Metro.
- `npm run android` builds and installs the Android app on the selected ADB device or emulator.
- `npm run typecheck` checks TypeScript.
- `npm run lint` runs ESLint.

Use React Navigation for screen flow. Screens live under `src/app/`; route adapters live under `src/navigation/`. Native Android configuration is maintained in `android/` and should be committed. Use React Native CLI autolinking for native packages.
