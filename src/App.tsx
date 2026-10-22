import { useEffect } from 'react';
import { useApp } from './state/store';
import { warmUpSolver } from './solver/solverClient';
import { HomeScreen } from './screens/HomeScreen';
import { ScanScreen } from './screens/ScanScreen';
import { VerifyScreen } from './screens/VerifyScreen';
import { SolutionScreen } from './screens/SolutionScreen';
import { ARScreen } from './screens/ARScreen';
import { SuccessScreen } from './screens/SuccessScreen';
import { HelpScreen } from './screens/HelpScreen';

export function App() {
  const screen = useApp((s) => s.screen);
  const theme = useApp((s) => s.settings.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#060914' : '#eef2ff');
  }, [theme]);

  useEffect(() => { window.scrollTo(0, 0); }, [screen]);

  // Build the Kociemba tables in the background as soon as the app opens.
  useEffect(() => {
    const t = setTimeout(() => warmUpSolver().catch(() => undefined), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-full flex flex-col" key={screen}>
      {screen === 'home' && <HomeScreen />}
      {screen === 'scan' && <ScanScreen />}
      {screen === 'verify' && <VerifyScreen />}
      {screen === 'solution' && <SolutionScreen />}
      {screen === 'ar' && <ARScreen />}
      {screen === 'success' && <SuccessScreen />}
      {screen === 'help' && <HelpScreen />}
    </div>
  );
}
