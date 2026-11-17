import UIKit
import Capacitor
import BackgroundTasks
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        SnowCheck.register()
        _ = WatchLink.shared
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        SnowCheck.schedule()
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// Poederalarm op de achtergrond: een paar keer per dag (iOS kiest het moment) kijken of er bij je favoriete
// skigebieden veel verse sneeuw verwacht wordt. De webapp zet de favorieten en de taal in de gedeelde App Group
// (sleutel "snow": {"on": true, "lang": "nl", "areas": [[naam, lat, lon, hoogte], ...]}).
enum SnowCheck {
    static let id = "nl.skipilot.app.snow"

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: id, using: nil) { task in
            guard let refresh = task as? BGAppRefreshTask else { task.setTaskCompleted(success: false); return }
            schedule()
            let work = Task { await run(); refresh.setTaskCompleted(success: true) }
            refresh.expirationHandler = { work.cancel() }
        }
    }

    static func schedule() {
        let req = BGAppRefreshTaskRequest(identifier: id)
        req.earliestBeginDate = Date(timeIntervalSinceNow: 6 * 3600)
        try? BGTaskScheduler.shared.submit(req)
    }

    static func run() async {
        guard let shared = UserDefaults(suiteName: WidgetPlugin.group), let raw = shared.string(forKey: "snow"),
              let cfg = try? JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any],
              cfg["on"] as? Bool == true, let areas = cfg["areas"] as? [[Any]] else { return }
        let lang = cfg["lang"] as? String ?? "nl"
        for a in areas.prefix(8) {
            guard a.count >= 4, let name = a[0] as? String, let lat = (a[1] as? NSNumber)?.doubleValue,
                  let lon = (a[2] as? NSNumber)?.doubleValue, let ele = (a[3] as? NSNumber)?.doubleValue else { continue }
            let key = "snow-told-" + name
            if Date().timeIntervalSince1970 - shared.double(forKey: key) < 48 * 3600 { continue }
            let url = URL(string: "https://api.open-meteo.com/v1/forecast?latitude=\(lat)&longitude=\(lon)&elevation=\(Int(ele))&daily=snowfall_sum&forecast_days=2&timezone=auto")!
            guard let (data, _) = try? await URLSession.shared.data(from: url),
                  let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let daily = j["daily"] as? [String: Any], let snow = daily["snowfall_sum"] as? [Any] else { continue }
            let cm = snow.compactMap { ($0 as? NSNumber)?.doubleValue }.reduce(0, +)
            if cm < 20 { continue }
            shared.set(Date().timeIntervalSince1970, forKey: key)
            let c = UNMutableNotificationContent()
            let n = Int(cm.rounded())
            switch lang {
            case "en": c.title = "Powder alert in \(name)"; c.body = "\(n) cm of fresh snow expected in the next 48 hours."
            case "de": c.title = "Pulveralarm in \(name)"; c.body = "\(n) cm Neuschnee in den nächsten 48 Stunden erwartet."
            case "fr": c.title = "Alerte poudreuse à \(name)"; c.body = "\(n) cm de neige fraîche attendus dans les 48 heures."
            default: c.title = "Poederalarm in \(name)"; c.body = "\(n) cm verse sneeuw verwacht in de komende 48 uur."
            }
            c.sound = .default
            try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: key, content: c, trigger: nil))
        }
    }
}
