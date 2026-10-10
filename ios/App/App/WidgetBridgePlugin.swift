import Foundation
import Capacitor
import WidgetKit
import WatchConnectivity

/*
 Hands today's numbers to the home-screen widget and the Watch app.

 The widget is a separate process and cannot read the web view's storage,
 so the app writes one small JSON summary into the App Group both share,
 and asks WidgetKit to redraw. The same summary goes to the Watch as its
 application context, which the Watch receives even if it was not running.

 Water logged on the Watch comes back as queued user-info transfers. They
 can arrive before the web view has loaded, so they are held here until the
 page asks for them (takePending) as well as announced live (watchWater).
 */
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePending", returnType: CAPPluginReturnPromise)
    ]

    static let group = "group.com.chamber42.loadout"
    private var pending: [[String: Any]] = []
    /* The newest summary, kept so it can be sent the moment the Watch link
       comes up — the page's first update usually arrives before it has. */
    private var latestJson: String?
    private let lock = NSLock()

    public override func load() {
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard let json = call.getString("json"),
              let defaults = UserDefaults(suiteName: WidgetBridgePlugin.group) else {
            call.resolve(["written": false]); return
        }
        defaults.set(json, forKey: "today")
        if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
        latestJson = json
        sendToWatch()
        call.resolve(["written": true])
    }

    private func sendToWatch() {
        guard WCSession.isSupported(), let json = latestJson else { return }
        let session = WCSession.default
        if session.activationState == .activated, session.isPaired, session.isWatchAppInstalled {
            try? session.updateApplicationContext(["today": json])
        }
    }

    @objc func takePending(_ call: CAPPluginCall) {
        lock.lock(); let out = pending; pending = []; lock.unlock()
        call.resolve(["items": out])
    }

    /* Two kinds arrive: a glass of water, or a food picked to log. A food is
       carried as the JSON the Watch built, and handed on as it is — the page
       decides what it means. */
    public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        var item: [String: Any]
        if let json = userInfo["log"] as? String {
            item = ["type": "log", "json": json]
        } else if let glasses = userInfo["water"] as? Int, let day = userInfo["day"] as? String {
            item = ["type": "water", "glasses": glasses, "day": day]
        } else { return }
        lock.lock(); pending.append(item); lock.unlock()
        DispatchQueue.main.async { self.notifyListeners("watchWater", data: item) }
    }

    public func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async { self.sendToWatch() }
    }
    /* Installing the Watch app later, or re-pairing, should not leave it
       waiting for the next thing to be logged before it shows anything. */
    public func sessionWatchStateDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.sendToWatch() }
    }
    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
}
