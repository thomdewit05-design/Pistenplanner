import Capacitor
import CoreLocation
import AppTrackingTransparency
import UIKit
import StoreKit
import WatchConnectivity
import HealthKit
#if canImport(ActivityKit)
import ActivityKit
#endif

// Navigatie op het toegangsscherm en in het Dynamic Island (Live Activity), ook als de telefoon op slot zit.
// De webapp geeft bij het starten de stappen van de route door; daarna rekent deze plug-in zelf met de GPS
// (ook op de achtergrond) uit waar je bent en hoe ver de volgende aanwijzing is. Geeft ook opdrachten van Siri door.
// Vanuit de webapp: Capacitor.nativePromise("Nav", "start" | "stop" | "pending", {...}).
@objc(NavPlugin)
public class NavPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "NavPlugin"
    public let jsName = "Nav"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "review", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "day", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "health", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "battery", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "watch", returnType: CAPPluginReturnPromise)
    ]
    static let actionKey = "pp-siri-action"
    static let actionNote = Notification.Name("ppSiriAction")

    struct Step {
        let line: [CLLocationCoordinate2D]
        let title: String, next: String, icon: String
        let min: Double, len: Double
        let badge: String?, color: String?
    }
    private var steps: [Step] = []
    private var idx = 0
    private var dest = "", lang = "nl"
    private var tap = true          // Apple Watch: trilsignaal bij een afslag
    private var pre = true          // ook een vooraankondiging, ruim voor de afslag
    private var alerted = -1        // stap waarvoor het signaal bij de afslag al gegeven is
    private var preAlerted = -1     // stap waarvoor de vooraankondiging al gegeven is
    private var offRoute = false    // van de route af (één signaal per keer dat het gebeurt)
    private var manager: CLLocationManager?
    private var lastPush = Date.distantPast
    private var lastKey: [Int]? = nil
    private var activity: Any? = nil   // Activity<NavAttributes>, alleen vanaf iOS 16.2

    override public func load() {
        // een Siri-opdracht terwijl de app al open is: de webapp meteen laten kijken
        NotificationCenter.default.addObserver(forName: Self.actionNote, object: nil, queue: .main) { [weak self] _ in
            self?.bridge?.triggerWindowJSEvent(eventName: "ppaction")
        }
        // na een crash of geforceerd sluiten kan er nog een oude navigatie op het toegangsscherm staan
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            for a in Activity<NavAttributes>.activities { Task { await a.end(nil, dismissalPolicy: .immediate) } }
            for a in Activity<DayAttributes>.activities { Task { await a.end(nil, dismissalPolicy: .immediate) } }
        }
        #endif
    }

    // ---------- starten en stoppen ----------
    @objc func start(_ call: CAPPluginCall) {
        guard let raw = call.options["steps"] as? [[String: Any]] else { return call.reject("Geen stappen") }
        let list: [Step] = raw.compactMap { s in
            guard let pts = s["line"] as? [[Double]] else { return nil }
            let line = pts.compactMap { $0.count >= 2 ? CLLocationCoordinate2D(latitude: $0[0], longitude: $0[1]) : nil }
            guard line.count >= 2 else { return nil }
            return Step(line: line, title: s["title"] as? String ?? "", next: s["next"] as? String ?? "",
                        icon: s["icon"] as? String ?? "arrow.up",
                        min: (s["min"] as? NSNumber)?.doubleValue ?? 0, len: (s["len"] as? NSNumber)?.doubleValue ?? 0,
                        badge: s["badge"] as? String, color: s["color"] as? String)
        }
        guard !list.isEmpty else { return call.reject("Geen stappen") }
        let d = call.getString("dest") ?? "", l = call.getString("lang") ?? "nl", t = call.getBool("tap") ?? true
        let pr = call.getBool("pre") ?? true, strong = call.getBool("strong") ?? false
        DispatchQueue.main.async {
            self.steps = list; self.idx = 0; self.lastKey = nil; self.alerted = -1; self.preAlerted = -1; self.offRoute = false
            self.dest = d; self.lang = l; self.tap = t; self.pre = pr
            WatchLink.shared.send(["hapt": ["on": t, "pre": pr, "strong": strong]])
            self.startLocation()
            self.push(self.manager?.location, force: true)
            call.resolve(["live": self.liveEnabled()])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.steps = []
            if let m = self.manager {
                m.stopUpdatingLocation()
                if self.backgroundAllowed { m.allowsBackgroundLocationUpdates = false }
            }
            #if canImport(ActivityKit)
            if #available(iOS 16.2, *) { self.endLive() }
            #endif
            WatchLink.shared.send(["nav": [String: Any]()])
            call.resolve()
        }
    }

    // Vanuit de webapp: extra onderdelen voor de Apple Watch (weer, groep, noodgegevens, instellingen), of een trilsignaal om te oefenen.
    // Capacitor.nativePromise("Nav", "watch", {state: {...}}) of {test: "left" | "right" | ...}
    @objc func watch(_ call: CAPPluginCall) {
        if let t = call.getString("test") { call.resolve(["sent": WatchLink.shared.test(t)]); return }
        if let st = call.options["state"] as? [String: Any] { WatchLink.shared.send(st) }
        call.resolve(["paired": WatchLink.shared.available])
    }

    // opdracht van Siri of van de Apple Watch die nog uitgevoerd moet worden ("valley", "hut", "home", "stop", "rec", "recstop"), of ""
    @objc func pending(_ call: CAPPluginCall) {
        let d = UserDefaults.standard, a = d.string(forKey: Self.actionKey) ?? ""
        d.removeObject(forKey: Self.actionKey)
        call.resolve(["action": a])
    }

    // ---------- App Tracking Transparency ----------
    // Apples vraag "Sta toe dat deze app je volgt", vóór er advertenties geladen worden. iOS laat de vraag alleen zien als
    // de app echt actief is (anders komt er stil "niet bepaald" terug), dus zo nodig wachten tot de app actief wordt.
    // Toestemming om te volgen (App Tracking Transparency). De vraag zelf stelt Tracking hieronder, vanuit
    // SceneDelegate zodra de app actief is; deze methode wacht tot er een antwoord is en geeft dat door.
    @objc func tracking(_ call: CAPPluginCall) {
        Tracking.whenDecided { call.resolve(["status": $0]) }
    }

    // ---------- batterijstand (de webweergave op iOS geeft die niet door) ----------
    @objc func battery(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIDevice.current.isBatteryMonitoringEnabled = true
            let st = UIDevice.current.batteryState
            call.resolve(["level": Double(UIDevice.current.batteryLevel), "charging": st == .charging || st == .full,
                          "lowPower": ProcessInfo.processInfo.isLowPowerModeEnabled])
        }
    }

    // ---------- beoordelen in de App Store ----------
    // Apples eigen sterrenvenster; iOS beslist zelf of het verschijnt (hooguit 3x per jaar).
    @objc func review(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let scene = UIApplication.shared.connectedScenes
                .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else { return call.resolve(["shown": false]) }
            if #available(iOS 16.0, *) { AppStore.requestReview(in: scene) } else { SKStoreReviewController.requestReview(in: scene) }
            call.resolve(["shown": true])
        }
    }

    // ---------- skidag live op het toegangsscherm ----------
    // Vanuit de webapp: Capacitor.nativePromise("Nav", "day", {action: "update" | "stop", km, hm, vmax, runs, since, area, lang})
    private var dayActivity: Any? = nil
    @objc func day(_ call: CAPPluginCall) {
        if call.getString("action") == "stop" { WatchLink.shared.send(["day": [String: Any]()]) }
        else { WatchLink.shared.send(["day": ["km": call.getDouble("km") ?? 0, "hm": call.getInt("hm") ?? 0, "vmax": call.getInt("vmax") ?? 0,
                                              "runs": call.getInt("runs") ?? 0, "since": (call.getDouble("since") ?? 0) / 1000,
                                              "area": call.getString("area") ?? ""]]) }
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            let action = call.getString("action") ?? "update"
            if action == "stop" {
                if let a = dayActivity as? Activity<DayAttributes> { Task { await a.end(nil, dismissalPolicy: .immediate) } }
                dayActivity = nil
                return call.resolve()
            }
            let since = Date(timeIntervalSince1970: (call.getDouble("since") ?? Date().timeIntervalSince1970 * 1000) / 1000)
            let state = DayAttributes.ContentState(km: call.getDouble("km") ?? 0, hm: call.getInt("hm") ?? 0,
                                                   vmax: call.getInt("vmax") ?? 0, runs: call.getInt("runs") ?? 0, since: since)
            let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(1800))
            if let a = dayActivity as? Activity<DayAttributes> {
                Task { await a.update(content) }
            } else if ActivityAuthorizationInfo().areActivitiesEnabled {
                dayActivity = try? Activity.request(attributes: DayAttributes(area: call.getString("area") ?? "", lang: call.getString("lang") ?? "nl"),
                                                    content: content, pushType: nil)
            }
        }
        #endif
        call.resolve()
    }

    // ---------- Apple Gezondheid ----------
    // Een skidag als training "Afdaling skiën": begin, einde, afstand en geschatte calorieën.
    // Vanuit de webapp: Capacitor.nativePromise("Nav", "health", {start, end, km, kcal}) (tijden in ms).
    private let healthStore = HKHealthStore()
    @objc func health(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { return call.resolve(["saved": false, "reason": "unavailable"]) }
        let start = Date(timeIntervalSince1970: (call.getDouble("start") ?? 0) / 1000)
        let end = Date(timeIntervalSince1970: (call.getDouble("end") ?? Date().timeIntervalSince1970 * 1000) / 1000)
        let km = call.getDouble("km") ?? 0, kcal = call.getDouble("kcal") ?? 0
        guard end > start else { return call.resolve(["saved": false, "reason": "time"]) }
        let types: Set<HKSampleType> = [HKObjectType.workoutType(), HKQuantityType(.distanceDownhillSnowSports), HKQuantityType(.activeEnergyBurned)]
        healthStore.requestAuthorization(toShare: types, read: []) { ok, _ in   // alleen schrijven: de app leest niets uit Gezondheid
            guard ok else { return call.resolve(["saved": false, "reason": "denied"]) }
            let cfg = HKWorkoutConfiguration(); cfg.activityType = .downhillSkiing; cfg.locationType = .outdoor
            let builder = HKWorkoutBuilder(healthStore: self.healthStore, configuration: cfg, device: .local())
            builder.beginCollection(withStart: start) { _, _ in
                var samples: [HKSample] = []
                if km > 0 { samples.append(HKQuantitySample(type: HKQuantityType(.distanceDownhillSnowSports), quantity: HKQuantity(unit: .meter(), doubleValue: km * 1000), start: start, end: end)) }
                if kcal > 0 { samples.append(HKQuantitySample(type: HKQuantityType(.activeEnergyBurned), quantity: HKQuantity(unit: .kilocalorie(), doubleValue: kcal), start: start, end: end)) }
                builder.add(samples) { _, _ in
                    builder.endCollection(withEnd: end) { _, _ in
                        builder.finishWorkout { w, err in call.resolve(["saved": w != nil, "reason": err?.localizedDescription ?? ""]) }
                    }
                }
            }
        }
    }

    // ---------- GPS ----------
    private var backgroundAllowed: Bool {
        (Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String])?.contains("location") ?? false
    }
    private func startLocation() {
        if manager == nil {
            let m = CLLocationManager()
            m.delegate = self
            m.desiredAccuracy = kCLLocationAccuracyBest
            m.distanceFilter = 5
            m.activityType = .otherNavigation
            m.pausesLocationUpdatesAutomatically = false
            manager = m
        }
        guard let m = manager else { return }
        if m.authorizationStatus == .notDetermined { m.requestWhenInUseAuthorization() }
        // op de achtergrond (telefoon op slot) doorgaan, met de blauwe balk bovenin
        if backgroundAllowed {
            m.allowsBackgroundLocationUpdates = true
            m.showsBackgroundLocationIndicator = true
        }
        m.startUpdatingLocation()
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last, loc.horizontalAccuracy >= 0, loc.horizontalAccuracy < 80 else { return }
        push(loc)
    }

    // ---------- waar ben je op de route ----------
    private func meters(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let k = cos((a.latitude + b.latitude) / 2 * .pi / 180)
        return hypot((b.longitude - a.longitude) * 111320 * k, (b.latitude - a.latitude) * 110540)
    }
    private func segDist(_ p: CLLocationCoordinate2D, _ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> (d: Double, t: Double, len: Double) {
        let k = cos(a.latitude * .pi / 180)
        let bx = (b.longitude - a.longitude) * 111320 * k, by = (b.latitude - a.latitude) * 110540
        let px = (p.longitude - a.longitude) * 111320 * k, py = (p.latitude - a.latitude) * 110540
        let l2 = bx * bx + by * by
        let t = l2 > 0 ? max(0, min(1, (px * bx + py * by) / l2)) : 0
        return (hypot(px - t * bx, py - t * by), t, sqrt(l2))
    }
    // zelfde rekenwijze als navState() in app.js: dichtstbijzijnde stuk van de huidige en de volgende twee stappen
    private func locate(_ p: CLLocationCoordinate2D) -> (i: Int, rem: Double)? {
        var bi = -1, bk = 0, bt = 0.0, bd = Double.infinity, bs = 0.0
        for i in idx..<min(steps.count, idx + 3) {
            let line = steps[i].line
            for k in 0..<(line.count - 1) {
                let r = segDist(p, line[k], line[k + 1])
                if bi < 0 || r.d < bd - 3 { bi = i; bk = k; bt = r.t; bd = r.d; bs = r.len }
            }
        }
        guard bi >= 0, bd <= 300 else { return nil }
        let line = steps[bi].line
        var rem = (1 - bt) * bs
        if bk + 1 < line.count - 1 { for k in (bk + 1)..<(line.count - 1) { rem += meters(line[k], line[k + 1]) } }
        if rem < 15 && bi < steps.count - 1 { bi += 1; rem = steps[bi].len }   // vlak bij het eind: alvast de volgende
        return (bi, rem)
    }

    // de richting van een stap voor het trilsignaal op de Watch, uit het pictogram dat de webapp meegeeft
    static func turn(_ icon: String) -> String {
        if icon.contains("left") { return "left" }
        if icon.contains("right") { return "right" }
        if icon.contains("cablecar") { return "lift" }
        if icon.contains("flag") { return "arrive" }
        if icon.contains("walk") { return "walk" }
        return "straight"
    }

    private func push(_ loc: CLLocation?, force: Bool = false) {
        guard !steps.isEmpty else { return }
        var dist = steps[idx].len, frac = 1.0, off = false
        if let loc = loc {
            if let r = locate(loc.coordinate) {
                idx = r.i; dist = r.rem
                frac = steps[idx].len > 0 ? min(1, r.rem / steps[idx].len) : 0
            } else if loc.horizontalAccuracy >= 0 && loc.horizontalAccuracy < 60 { off = true }   // ver van de lijn, met een bruikbare positie
        }
        let key = [idx, Int(dist / 10)], now = Date()
        // niet vaker dan nodig: bij een nieuwe stap of 10 m verschil, hooguit elke 2 seconden
        if !force {
            if now.timeIntervalSince(lastPush) < 2 { return }
            if key == lastKey && now.timeIntervalSince(lastPush) < 20 { return }
        }
        lastKey = key; lastPush = now
        let s = steps[idx], last = idx == steps.count - 1
        let leftMin = s.min * frac + steps[(idx + 1)...].reduce(0) { $0 + $1.min }
        // Twee momenten per afslag. Vooraankondiging: ruim ervoor, verder weg naarmate je harder gaat (minstens 8 seconden vooruit).
        // Bij de afslag zelf (of bij aankomst): het volledige signaal. Op de iPhone hoort daar een melding bij.
        let arrived = last && dist < 30
        let speed = max(0, loc?.speed ?? 0)
        let nowDist = max(45.0, speed * 4), preDist = max(150.0, speed * 9)
        let alert = tap && alerted != idx && (arrived || (!last && dist <= nowDist))
        let preAlert = tap && pre && !alert && !last && preAlerted != idx && alerted != idx && dist <= preDist && dist > nowDist + 25
        if alert { alerted = idx; preAlerted = idx }
        if preAlert { preAlerted = idx }
        let offNow = tap && off && !offRoute
        offRoute = off
        let leftM = dist + steps[(idx + 1)...].reduce(0) { $0 + $1.len }
        // de twee stappen daarna, voor op het horloge
        var after: [[String: Any]] = []
        for k in (idx + 1)..<min(steps.count, idx + 3) {
            let n = steps[k]
            after.append(["text": n.next, "badge": n.badge ?? "", "color": n.color ?? "", "turn": k == steps.count - 1 ? "arrive" : Self.turn(n.icon)])
        }
        let turn = last ? "arrive" : Self.turn(s.icon)
        WatchLink.shared.send(["nav": ["dist": dist, "instruction": s.next, "icon": last ? "flag.checkered" : s.icon, "current": s.title,
                                        "eta": now.addingTimeInterval(leftMin * 60).timeIntervalSince1970, "badge": s.badge ?? "",
                                        "color": s.color ?? "", "arrived": arrived, "dest": dest, "turn": turn,
                                        "leftM": leftM, "off": off, "after": after]],
                               tap: offNow ? "off" : alert ? "now" : preAlert ? "pre" : nil)
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            updateLive(NavAttributes.ContentState(dist: dist, instruction: s.next, icon: last ? "flag.checkered" : s.icon,
                                                  current: s.title, eta: now.addingTimeInterval(leftMin * 60),
                                                  badge: s.badge, color: s.color, arrived: arrived),
                       alert: alert ? (arrived ? s.next : "\(Int((dist / 10).rounded() * 10)) m", s.next) : nil)
        }
        #endif
    }

    // ---------- Live Activity ----------
    private func liveEnabled() -> Bool {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) { return ActivityAuthorizationInfo().areActivitiesEnabled }
        #endif
        return false
    }
    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private func updateLive(_ state: NavAttributes.ContentState, alert: (String, String)? = nil) {
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(180))
        if let a = activity as? Activity<NavAttributes> {
            if let al = alert {
                let cfg = AlertConfiguration(title: LocalizedStringResource(stringLiteral: al.0), body: LocalizedStringResource(stringLiteral: al.1), sound: .default)
                Task { await a.update(content, alertConfiguration: cfg) }
            } else {
                Task { await a.update(content) }
            }
        } else if ActivityAuthorizationInfo().areActivitiesEnabled {
            activity = try? Activity.request(attributes: NavAttributes(dest: dest, lang: lang), content: content, pushType: nil)
        }
    }
    @available(iOS 16.2, *)
    private func endLive() {
        guard let a = activity as? Activity<NavAttributes> else { return }
        activity = nil
        Task { await a.end(nil, dismissalPolicy: .immediate) }
    }
    #endif
}

// App Tracking Transparency: Apple wil dat de vraag om te volgen verschijnt vóórdat er advertentiegegevens
// verzameld worden. iOS slaat de vraag stil over als de app op dat moment niet actief is of als er al een
// andere systeemmelding openstaat (bijvoorbeeld de vraag om je locatie). Daarom: bij elke keer dat de app
// actief wordt opnieuw proberen, net zo lang tot er een antwoord is. Los van de webapp, advertenties en Pro.
enum Tracking {
    private static var asking = false
    private static var waiters: [(String) -> Void] = []

    static var status: String {
        switch ATTrackingManager.trackingAuthorizationStatus {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .restricted: return "restricted"
        default: return "notDetermined"
        }
    }

    /// Aanroepen zodra de app actief wordt (SceneDelegate).
    static func askIfNeeded() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            guard !asking, ATTrackingManager.trackingAuthorizationStatus == .notDetermined,
                  UIApplication.shared.applicationState == .active else { return }
            asking = true
            ATTrackingManager.requestTrackingAuthorization { _ in
                DispatchQueue.main.async {
                    asking = false
                    // nog steeds geen antwoord: de vraag is overgeslagen; bij de volgende keer actief opnieuw
                    if ATTrackingManager.trackingAuthorizationStatus != .notDetermined { finish() }
                }
            }
        }
    }

    /// Roept done aan zodra de gebruiker heeft gekozen (meteen als dat al gebeurd is).
    static func whenDecided(_ done: @escaping (String) -> Void) {
        DispatchQueue.main.async {
            if ATTrackingManager.trackingAuthorizationStatus != .notDetermined { return done(status) }
            waiters.append(done)
            askIfNeeded()
        }
    }

    private static func finish() {
        let s = status, w = waiters
        waiters = []
        w.forEach { $0(s) }
    }
}

// Verbinding met de Skipilot-app op de Apple Watch: navigatie en je skidag gaan als "application context"
// naar het horloge (komt ook aan als de horloge-app later opent); een afslag gaat er direct heen voor een tikje op je pols.
final class WatchLink: NSObject, WCSessionDelegate {
    static let shared = WatchLink()
    private var context: [String: Any] = [:]
    private var lastSent = Date.distantPast

    override init() {
        super.init()
        if WCSession.isSupported() { WCSession.default.delegate = self; WCSession.default.activate() }
    }

    /// Is er een Watch gekoppeld met de Skipilot-app erop?
    var available: Bool {
        guard WCSession.isSupported() else { return false }
        let s = WCSession.default
        return s.activationState == .activated && s.isPaired && s.isWatchAppInstalled
    }

    /// tap: welk trilsignaal de Watch nu moet geven ("pre" = vooraankondiging, "now" = bij de afslag, "off" = van de route af,
    /// of een eigen soort zoals "lastlift" en "group"); nil = alleen de toestand bijwerken.
    func send(_ part: [String: Any], tap: String? = nil) {
        guard available else { return }
        let s = WCSession.default
        for (k, v) in part { context[k] = v }
        context["ts"] = Date().timeIntervalSince1970
        if let t = tap, s.isReachable { s.sendMessage(["tap": t, "ctx": context], replyHandler: nil, errorHandler: nil) }
        if tap != nil || Date().timeIntervalSince(lastSent) > 3 {
            lastSent = Date()
            try? s.updateApplicationContext(context)
        }
    }

    /// Een trilsignaal laten voelen om te oefenen. Geeft terug of de Watch bereikbaar was.
    func test(_ kind: String) -> Bool {
        guard available, WCSession.default.isReachable else { return false }
        WCSession.default.sendMessage(["test": kind], replyHandler: nil, errorHandler: nil)
        return true
    }

    // Opdracht van de Watch ("stop", "valley", "rec", "recstop"): door dezelfde deur als een Siri-opdracht naar de webapp.
    private func command(_ message: [String: Any]) -> Bool {
        guard let cmd = message["cmd"] as? String, ["stop", "valley", "rec", "recstop", "home", "hut"].contains(cmd) else { return false }
        UserDefaults.standard.set(cmd, forKey: NavPlugin.actionKey)
        DispatchQueue.main.async { NotificationCenter.default.post(name: NavPlugin.actionNote, object: nil) }
        return true
    }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        replyHandler(["ok": command(message)])
    }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { _ = command(message) }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
}
