import Foundation
import Capacitor
import UserNotifications

/*
 Notifications the app cannot post for itself.

 30-timers.js has always tried to announce a finished cook timer through
 the web Notification API. That was never going to work here: WKWebView
 does not implement the Notification API at all, so `typeof Notification`
 is undefined inside this app and the call has been returning early and
 telling nobody anything. The countdown on screen was real; the alert was
 not. Anything that has to reach somebody who is not looking at the app —
 a timer finishing, a daily reminder, a prep about to run out — has to go
 through UNUserNotificationCenter, which is what this is.

 Written here rather than pulled in as a package, the same call as
 HealthKitPlugin — this schedules a notification, cancels it, and says
 what is pending, and a dependency for that would be more code to trust
 and keep current than the code it replaces.

 Two shapes. scheduleDaily repeats at a clock time; scheduleAt fires once
 at a moment. Every notification is identified by a string the JS side
 chooses, and scheduling the same id twice replaces rather than stacks.
 That matters: the settings screen re-schedules on every change, and
 without replacement somebody who nudged the time four times would get
 four notifications.
 */
@objc(NotificationsPlugin)
public class NotificationsPlugin: CAPPlugin, CAPBridgedPlugin, UNUserNotificationCenterDelegate {

    public let identifier = "NotificationsPlugin"
    public let jsName = "Reminders"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleDaily", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleAt", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise)
    ]

    private let center = UNUserNotificationCenter.current()

    /* iOS does NOT show a scheduled notification while the app that
       scheduled it is in the foreground — not unless the app says it wants
       it to. Without this, a cook timer that ends while somebody is looking
       at the app is silently swallowed: the native alert is suppressed
       because the app is frontmost, and the old web fallback cannot cover
       it because WKWebView has no Notification API to fall back to.

       Deployment target is iOS 15, so .banner and .list are both available.
       .list keeps it in Notification Centre afterwards, which matters for a
       timer somebody missed while scrolling. */
    override public func load() {
        center.delegate = self
    }

    public func userNotificationCenter(_ center: UNUserNotificationCenter,
                                       willPresent notification: UNNotification,
                                       withCompletionHandler completionHandler:
                                         @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .list])
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    /* Unlike HealthKit's read permissions, notification authorisation IS
       readable — knowing an app may not post a banner discloses nothing
       about the person. So this can decide whether to show a control,
       and can tell "not asked yet" apart from "asked and refused", which
       are different situations needing different words on screen. */
    @objc func status(_ call: CAPPluginCall) {
        center.getNotificationSettings { settings in
            let state: String
            switch settings.authorizationStatus {
            case .notDetermined: state = "unasked"
            case .denied:        state = "denied"
            case .authorized, .provisional, .ephemeral: state = "granted"
            @unknown default:    state = "denied"
            }
            DispatchQueue.main.async { call.resolve(["status": state]) }
        }
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                call.resolve(["granted": granted])
            }
        }
    }

    /* One reminder, at the same clock time every day.

       UNCalendarNotificationTrigger with only hour and minute set repeats
       daily and, because it is a calendar trigger rather than an interval,
       it follows the phone across time zones and daylight saving. Someone
       who asks to be reminded at eight in the morning means eight wherever
       they wake up, not eight hours after the last one. */
    @objc func scheduleDaily(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("scheduleDaily needs an id"); return
        }
        let title = call.getString("title") ?? "Loadout"
        let body  = call.getString("body") ?? ""
        let hour   = call.getInt("hour") ?? 9
        let minute = call.getInt("minute") ?? 0

        guard (0...23).contains(hour), (0...59).contains(minute) else {
            call.reject("scheduleDaily needs a real time of day"); return
        }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        var when = DateComponents()
        when.hour = hour
        when.minute = minute

        let request = UNNotificationRequest(
            identifier: id,
            content: content,
            trigger: UNCalendarNotificationTrigger(dateMatching: when, repeats: true))

        /* Removing first makes scheduling idempotent. iOS does replace a
           request with a matching identifier, but only once it is pending —
           removing explicitly means the same is true whatever state it was
           in, including delivered-but-still-listed. */
        center.removePendingNotificationRequests(withIdentifiers: [id])
        center.add(request) { error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                call.resolve(["scheduled": true, "id": id])
            }
        }
    }

    /* One notification, once, at a wall-clock moment.

       Two things need this and neither is a daily habit. A cook timer
       finishing is the obvious one — until now that went through the web
       Notification API, which WKWebView does not implement at all, so on
       the phone a finished timer has never actually told anybody. And a
       prep running out happens on a date, not at a time of day.

       Takes an epoch millisecond rather than date components: the caller
       already knows the exact instant in both cases, and converting to
       components here and back inside iOS is a chance to lose a minute to
       rounding or a time zone.

       A moment already past is refused rather than fired immediately. The
       one way to get there is a bug in the caller's arithmetic, and a
       notification that arrives the instant it is scheduled is a worse
       symptom than an error. */
    @objc func scheduleAt(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("scheduleAt needs an id"); return
        }
        guard let atMs = call.getDouble("at") else {
            call.reject("scheduleAt needs a time"); return
        }
        let fireAt = Date(timeIntervalSince1970: atMs / 1000)
        let seconds = fireAt.timeIntervalSinceNow
        guard seconds > 0 else {
            call.resolve(["scheduled": false, "reason": "already past"]); return
        }

        let content = UNMutableNotificationContent()
        content.title = call.getString("title") ?? "Loadout"
        content.body = call.getString("body") ?? ""
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: id,
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false))

        center.removePendingNotificationRequests(withIdentifiers: [id])
        center.add(request) { error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                call.resolve(["scheduled": true, "id": id])
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("cancel needs an id"); return
        }
        center.removePendingNotificationRequests(withIdentifiers: [id])
        center.removeDeliveredNotifications(withIdentifiers: [id])
        call.resolve(["cancelled": true])
    }

    /* What is actually scheduled, so the JS side can show the truth rather
       than what it last asked for. The two come apart easily: notifications
       are cleared when someone deletes and reinstalls, and iOS caps how many
       an app may have pending. */
    @objc func pending(_ call: CAPPluginCall) {
        center.getPendingNotificationRequests { requests in
            let ids = requests.map { $0.identifier }
            DispatchQueue.main.async { call.resolve(["ids": ids]) }
        }
    }
}
