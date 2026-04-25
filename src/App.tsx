import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, ProtectedRoute } from './components/auth';
import { TaskMasterProvider } from './contexts/TaskMasterContext';
import { TasksSettingsProvider } from './contexts/TasksSettingsContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { PluginsProvider } from './contexts/PluginsContext';
import AppContent from './components/app/AppContent';
import AppTour from './components/tour/AppTour';
import i18n from './i18n/config.js';

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AuthProvider>
          <WebSocketProvider>
            <PluginsProvider>
              <TasksSettingsProvider>
                <TaskMasterProvider>
                <ProtectedRoute>
                  <Router basename={window.__ROUTER_BASENAME__ || ''}>
                    <Routes>
                      <Route path="/" element={<AppContent />} />
                      <Route path="/preset/:preset" element={<AppContent />} />
                      <Route path="/d/:dashboardId" element={<AppContent />} />
                      <Route path="/d/:dashboardId/f/:folderIds" element={<AppContent />} />
                      <Route path="/p/:projectName" element={<AppContent />} />
                      <Route path="/p/:projectName/s/:provider/:sessionId" element={<AppContent />} />
                      <Route path="/p/:projectName/agents/:agentName" element={<AppContent />} />
                      <Route path="/agents/global/:agentName" element={<AppContent />} />
                      <Route path="/session/:sessionId" element={<AppContent />} />
                    </Routes>
                    <AppTour />
                  </Router>
                </ProtectedRoute>
                </TaskMasterProvider>
              </TasksSettingsProvider>
            </PluginsProvider>
          </WebSocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
