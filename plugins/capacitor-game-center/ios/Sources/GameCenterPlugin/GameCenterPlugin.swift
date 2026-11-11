import Foundation
import Capacitor
import GameKit
import UIKit

/// Minimal Game Center bridge for Linicro.
/// JS name: "GameCenter". Methods: authenticate, isAuthenticated, submitScore,
/// showLeaderboard, showDashboard, unlockAchievement, resetAchievements.
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAuthenticated", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showDashboard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlockAchievement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetAchievements", returnType: CAPPluginReturnPromise)
    ]

    private var authResolved = false

    @objc func authenticate(_ call: CAPPluginCall) {
        let player = GKLocalPlayer.local
        if player.isAuthenticated {
            call.resolve(["authenticated": true, "available": true, "playerName": player.displayName])
            return
        }
        authResolved = false
        DispatchQueue.main.async {
            player.authenticateHandler = { [weak self] viewController, error in
                guard let self = self else { return }
                if let vc = viewController {
                    self.bridge?.viewController?.present(vc, animated: true)
                    return
                }
                if self.authResolved { return }
                self.authResolved = true
                if let error = error {
                    call.resolve(["authenticated": false, "available": true, "error": error.localizedDescription])
                } else {
                    call.resolve(["authenticated": player.isAuthenticated, "available": true,
                                  "playerName": player.isAuthenticated ? player.displayName : ""])
                }
            }
        }
    }

    @objc func isAuthenticated(_ call: CAPPluginCall) {
        call.resolve(["authenticated": GKLocalPlayer.local.isAuthenticated, "available": true])
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let leaderboardId = call.getString("leaderboardId") else { call.reject("leaderboardId required"); return }
        let score = call.getInt("score") ?? 0
        guard GKLocalPlayer.local.isAuthenticated else { call.resolve(["submitted": false, "reason": "not-authenticated"]); return }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local,
                                  leaderboardIDs: [leaderboardId]) { error in
            if let error = error { call.resolve(["submitted": false, "error": error.localizedDescription]) }
            else { call.resolve(["submitted": true]) }
        }
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        let leaderboardId = call.getString("leaderboardId")
        DispatchQueue.main.async {
            let vc: GKGameCenterViewController
            if let id = leaderboardId {
                vc = GKGameCenterViewController(leaderboardID: id, playerScope: .global, timeScope: .allTime)
            } else {
                vc = GKGameCenterViewController(state: .leaderboards)
            }
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve(["shown": true])
        }
    }

    @objc func showDashboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let vc = GKGameCenterViewController(state: .dashboard)
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve(["shown": true])
        }
    }

    @objc func unlockAchievement(_ call: CAPPluginCall) {
        guard let achievementId = call.getString("achievementId") else { call.reject("achievementId required"); return }
        let percent = call.getDouble("percent") ?? 100.0
        guard GKLocalPlayer.local.isAuthenticated else { call.resolve(["unlocked": false, "reason": "not-authenticated"]); return }
        let achievement = GKAchievement(identifier: achievementId)
        achievement.percentComplete = percent
        achievement.showsCompletionBanner = true
        GKAchievement.report([achievement]) { error in
            if let error = error { call.resolve(["unlocked": false, "error": error.localizedDescription]) }
            else { call.resolve(["unlocked": true]) }
        }
    }

    @objc func resetAchievements(_ call: CAPPluginCall) {
        GKAchievement.resetAchievements { error in
            call.resolve(["reset": error == nil])
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
