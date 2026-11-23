import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'kg.migway.app',
  appName: 'MigWay',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#ffffff', showSpinner: false },
  },
}

export default config
