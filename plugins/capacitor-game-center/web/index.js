// JS side of the local Game Center plugin. On web every call resolves
// harmlessly ({ available: false }) so the game never has to branch.
import { registerPlugin, WebPlugin } from '@capacitor/core';

class GameCenterWeb extends WebPlugin {
  async authenticate() { return { authenticated: false, available: false }; }
  async isAuthenticated() { return { authenticated: false, available: false }; }
  async submitScore() { return { submitted: false }; }
  async showLeaderboard() { return { shown: false }; }
  async showDashboard() { return { shown: false }; }
  async unlockAchievement() { return { unlocked: false }; }
  async resetAchievements() { return { reset: false }; }
}

export const GameCenter = registerPlugin('GameCenter', {
  web: () => new GameCenterWeb()
});

export default GameCenter;
