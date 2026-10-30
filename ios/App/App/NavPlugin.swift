import Capacitor
import CoreLocation
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
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise)
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
    private var tap = true          // Apple Watch: tikje op je pols vlak voor een afslag
    private var alerted = -1        // stap waarvoor dat tikje al gegeven is
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
        DispatchQueue.main.async {
            self.steps = list; self.idx = 0; self.lastKey = nil; self.alerted = -1
            self.dest = d; self.lang = l; self.tap = t
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
            call.resolve()
        }
    }

    // opdracht van Siri die nog uitgevoerd moet worden ("valley", "hut", "home", "stop"), of ""
    @objc func pending(_ call: CAPPluginCall) {
        let d = UserDefaults.standard, a = d.string(forKey: Self.actionKey) ?? ""
        d.removeObject(forKey: Self.actionKey)
        call.resolve(["action": a])
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

    private func push(_ loc: CLLocation?, force: Bool = false) {
        guard !steps.isEmpty else { return }
        var dist = steps[idx].len, frac = 1.0
        if let loc = loc, let r = locate(loc.coordinate) {
            idx = r.i; dist = r.rem
            frac = steps[idx].len > 0 ? min(1, r.rem / steps[idx].len) : 0
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
        // vlak voor de afslag (of bij aankomst) één melding: op de Apple Watch een tikje op je pols, op de iPhone een geluidje
        let arrived = last && dist < 30
        let alert = tap && alerted != idx && (arrived || (!last && dist <= 120))
        if alert { alerted = idx }
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
