import SwiftUI
import WatchConnectivity
import WatchKit

// Skipilot op de Apple Watch: de volgende afslag met een trilsignaal op je pols (links voelt anders dan rechts),
// je skidag live, bediening vanaf je pols en een noodknop.
// De gegevens komen van de iPhone-app (WatchLink in NavPlugin.swift) via WatchConnectivity; opdrachten gaan dezelfde weg terug.
@main
struct SkipilotWatchApp: App {
    @StateObject private var model = WatchModel()
    var body: some Scene {
        WindowGroup { RootView().environmentObject(model) }
    }
}

let skiBlue = Color(red: 31/255, green: 127/255, blue: 214/255)
let skiGold = Color(red: 1, green: 196/255, blue: 0)
let skiNight = Color(red: 0.06, green: 0.11, blue: 0.17)

// ---------- trilsignalen ----------
// Eén tabel voor alle signalen, zodat de code op één plek bij te stellen is.
// Een signaal is een reeks standaardtrillingen van de Watch met een pauze (in seconden) erna.
enum Signal: String, CaseIterable, Identifiable {
    case left, right, straight, lift, arrive, off, lastlift, group
    var id: String { rawValue }

    /// Het volledige signaal, bij de afslag zelf.
    var pattern: [(WKHapticType, Double)] {
        switch self {
        case .left:     return [(.start, 0.16), (.start, 0.45), (.start, 0.16), (.start, 0)]   // tik-tik … tik-tik
        case .right:    return [(.start, 0.16), (.start, 0.16), (.start, 0)]                   // tik-tik-tik
        case .straight: return [(.start, 0)]
        case .lift:     return [(.directionUp, 0)]
        case .arrive:   return [(.success, 0)]
        case .off:      return [(.failure, 0)]
        case .lastlift: return [(.notification, 0.7), (.notification, 0)]
        case .group:    return [(.notification, 0)]
        }
    }
    /// De vooraankondiging: dezelfde code, zachter en alleen het eerste deel.
    var prePattern: [(WKHapticType, Double)] {
        switch self {
        case .left:  return [(.click, 0.16), (.click, 0)]
        case .right: return [(.click, 0.16), (.click, 0.16), (.click, 0)]
        default:     return [(.click, 0)]
        }
    }
    var title: String {
        switch self {
        case .left:     return String(localized: "Links", comment: "haptic")
        case .right:    return String(localized: "Rechts", comment: "haptic")
        case .straight: return String(localized: "Rechtdoor", comment: "haptic")
        case .lift:     return String(localized: "Lift nemen", comment: "haptic")
        case .arrive:   return String(localized: "Aangekomen", comment: "haptic")
        case .off:      return String(localized: "Van de route af", comment: "haptic")
        case .lastlift: return String(localized: "Laatste lift nadert", comment: "haptic")
        case .group:    return String(localized: "Bericht van je groep", comment: "haptic")
        }
    }
    var hint: String {
        switch self {
        case .left:     return String(localized: "tik-tik … tik-tik", comment: "haptic hint")
        case .right:    return String(localized: "tik-tik-tik", comment: "haptic hint")
        case .straight: return String(localized: "één tik", comment: "haptic hint")
        case .lift:     return String(localized: "oplopend", comment: "haptic hint")
        case .arrive:   return String(localized: "gelukt", comment: "haptic hint")
        case .off:      return String(localized: "mislukt", comment: "haptic hint")
        case .lastlift: return String(localized: "twee lange", comment: "haptic hint")
        case .group:    return String(localized: "één lange", comment: "haptic hint")
        }
    }
    var symbol: String {
        switch self {
        case .left: return "arrow.turn.up.left"
        case .right: return "arrow.turn.up.right"
        case .straight: return "arrow.up"
        case .lift: return "cablecar"
        case .arrive: return "flag.checkered"
        case .off: return "exclamationmark.triangle.fill"
        case .lastlift: return "clock.badge.exclamationmark"
        case .group: return "person.2.fill"
        }
    }
}

enum Haptics {
    private static var token = 0
    /// Speelt een signaal af. Een nieuw signaal breekt het vorige af.
    static func play(_ s: Signal, pre: Bool = false, strong: Bool = false) {
        token += 1
        let mine = token
        var steps = pre ? s.prePattern : s.pattern
        if strong && !pre {                                  // "sterker": het hele signaal nog een keer
            if let last = steps.indices.last { steps[last].1 = 0.8 }
            steps += s.pattern
        }
        var at = 0.0
        for (type, gap) in steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + at) {
                if mine == token { WKInterfaceDevice.current().play(type) }
            }
            at += gap
        }
    }
}

// ---------- gegevens ----------
final class WatchModel: NSObject, ObservableObject, WCSessionDelegate {
    struct Next: Identifiable { let id = UUID(); var text: String; var badge: String; var color: String; var turn: String }
    struct Nav { var dist: Double; var instruction: String; var icon: String; var current: String; var eta: Date; var badge: String; var color: String
                 var arrived: Bool; var dest: String; var turn: String; var leftM: Double; var off: Bool; var after: [Next] }
    struct Day { var km: Double; var hm: Int; var vmax: Int; var runs: Int; var since: Date; var area: String }
    enum Sending: Equatable { case idle, busy(String), done(String), failed }

    @Published var nav: Nav?
    @Published var day: Day?
    @Published var ts: Date?
    @Published var flash: Signal?          // het signaal dat net gegeven is: even groot in beeld
    @Published var sending: Sending = .idle
    @Published var reachable = false
    @Published var haptOn = true
    @Published var haptPre = true
    @Published var haptStrong = false

    /// Het scherm waarop de app opent: 0 = navigatie, 1 = skidag, 2 = bediening, 3 = noodknop.
    var startTab = 0
    var demo: String?

    override init() {
        super.init()
        #if DEBUG
        // Voorbeeldstand voor schermafbeeldingen (alleen in de proefbouw). De app wacht dan niet op de iPhone maar toont vaste
        // voorbeeldgegevens. Het scherm komt uit de omgeving (SKIPILOT_DEMO) of uit de startargumenten ("-demo nav").
        // Zie .github/workflows/watch-shots.yml.
        let args = ProcessInfo.processInfo.arguments
        let fromArgs = args.firstIndex(of: "-demo").flatMap { $0 + 1 < args.count ? args[$0 + 1] : nil }
        if let d = ProcessInfo.processInfo.environment["SKIPILOT_DEMO"] ?? fromArgs {
            demo = d
            nav = Nav(dist: 350, instruction: "Houd rechts aan naar piste 12", icon: "arrow.turn.up.right", current: "Piste 11",
                      eta: Date().addingTimeInterval(20 * 60), badge: "12", color: "#D22E2E", arrived: false, dest: "Rüfikopf",
                      turn: "right", leftM: 4200, off: d == "off",
                      after: [Next(text: "Neem de lift Rüfikopfbahn", badge: "", color: "", turn: "lift"),
                              Next(text: "Volg piste 180", badge: "180", color: "#1E66CC", turn: "straight")])
            day = Day(km: 31.4, hm: 6200, vmax: 71, runs: 17, since: Date().addingTimeInterval(-(4 * 3600 + 12 * 60)), area: "Ski Arlberg")
            reachable = true
            startTab = d == "day" ? 1 : d == "ctrl" || d == "hapt" ? 2 : d == "sos" ? 3 : 0
            if d == "flash" { flash = .left }
            return
        }
        #endif
        if WCSession.isSupported() { WCSession.default.delegate = self; WCSession.default.activate() }
    }

    private func apply(_ ctx: [String: Any], tap: String?) {
        DispatchQueue.main.async {
            if let n = ctx["nav"] as? [String: Any], let ins = n["instruction"] as? String {
                let after = (n["after"] as? [[String: Any]] ?? []).map {
                    Next(text: $0["text"] as? String ?? "", badge: $0["badge"] as? String ?? "", color: $0["color"] as? String ?? "", turn: $0["turn"] as? String ?? "straight")
                }
                let icon = n["icon"] as? String ?? "arrow.up"
                // een oudere iPhone-app stuurt nog geen richting mee: dan uit het pictogram
                let turn = n["turn"] as? String ?? (icon.contains("left") ? "left" : icon.contains("right") ? "right" : icon.contains("cablecar") ? "lift" : icon.contains("flag") ? "arrive" : "straight")
                self.nav = Nav(dist: n["dist"] as? Double ?? 0, instruction: ins, icon: icon,
                               current: n["current"] as? String ?? "", eta: Date(timeIntervalSince1970: n["eta"] as? Double ?? 0),
                               badge: n["badge"] as? String ?? "", color: n["color"] as? String ?? "", arrived: n["arrived"] as? Bool ?? false,
                               dest: n["dest"] as? String ?? "", turn: turn, leftM: n["leftM"] as? Double ?? 0, off: n["off"] as? Bool ?? false, after: after)
            } else if ctx["nav"] != nil { self.nav = nil }
            if let d = ctx["day"] as? [String: Any], let km = d["km"] as? Double {
                self.day = Day(km: km, hm: d["hm"] as? Int ?? 0, vmax: d["vmax"] as? Int ?? 0, runs: d["runs"] as? Int ?? 0,
                               since: Date(timeIntervalSince1970: d["since"] as? Double ?? Date().timeIntervalSince1970), area: d["area"] as? String ?? "")
            } else if ctx["day"] != nil { self.day = nil }
            if let h = ctx["hapt"] as? [String: Any] {
                self.haptOn = h["on"] as? Bool ?? true; self.haptPre = h["pre"] as? Bool ?? true; self.haptStrong = h["strong"] as? Bool ?? false
            }
            self.ts = Date()
            guard let tap = tap, self.haptOn else { return }
            switch tap {
            case "off": self.signal(.off)
            case "pre": if self.haptPre, let n = self.nav { self.signal(self.turnSignal(n), pre: true) }
            case "now", "true": if let n = self.nav { self.signal(n.arrived ? .arrive : self.turnSignal(n)) }
            default: if let s = Signal(rawValue: tap) { self.signal(s) }
            }
        }
    }
    private func turnSignal(_ n: Nav) -> Signal {
        switch n.turn { case "left": return .left; case "right": return .right; case "lift": return .lift; case "arrive": return .arrive; default: return .straight }
    }
    /// Trilsignaal geven en het even groot in beeld zetten, zodat trilling en scherm hetzelfde zeggen.
    func signal(_ s: Signal, pre: Bool = false) {
        Haptics.play(s, pre: pre, strong: haptStrong)
        flash = s
        DispatchQueue.main.asyncAfter(deadline: .now() + (pre ? 2.0 : 3.5)) { [weak self] in if self?.flash == s { self?.flash = nil } }
    }

    /// Opdracht naar de iPhone ("stop", "valley", "rec", "recstop"). De knop meldt pas "gedaan" als de iPhone antwoordt.
    func send(_ cmd: String) {
        #if DEBUG
        if demo != nil { sending = .done(cmd); return }
        #endif
        guard WCSession.isSupported(), WCSession.default.isReachable else { sending = .failed; clearSoon(); return }
        sending = .busy(cmd)
        WCSession.default.sendMessage(["cmd": cmd], replyHandler: { reply in
            DispatchQueue.main.async {
                self.sending = (reply["ok"] as? Bool ?? false) ? .done(cmd) : .failed
                WKInterfaceDevice.current().play(self.sending == .failed ? .failure : .click)
                self.clearSoon()
            }
        }, errorHandler: { _ in
            DispatchQueue.main.async { self.sending = .failed; WKInterfaceDevice.current().play(.failure); self.clearSoon() }
        })
    }
    private func clearSoon() { DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in self?.sending = .idle } }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        let c = session.receivedApplicationContext
        if !c.isEmpty { apply(c, tap: nil) }
        DispatchQueue.main.async { self.reachable = session.isReachable }
    }
    func sessionReachabilityDidChange(_ session: WCSession) { DispatchQueue.main.async { self.reachable = session.isReachable } }
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) { apply(applicationContext, tap: nil) }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if let t = message["test"] as? String, let s = Signal(rawValue: t) { DispatchQueue.main.async { self.signal(s) }; return }
        if let c = message["ctx"] as? [String: Any] {
            // een oudere iPhone-app stuurt "tap": true; de nieuwe stuurt welk signaal ("pre", "now", "off", ...)
            let tap = message["tap"] as? String ?? ((message["tap"] as? Bool ?? false) ? "now" : nil)
            apply(c, tap: tap)
        }
    }
}

// ---------- schermen ----------
struct RootView: View {
    @EnvironmentObject var model: WatchModel
    @State private var tab = 0
    var body: some View {
        NavigationStack {
            TabView(selection: $tab) {
                NavView().tag(0)
                DayView().tag(1)
                ControlView().tag(2)
                SOSView().tag(3)
            }
            .tabViewStyle(.verticalPage)
            .onAppear { tab = model.startTab }
        }
        .overlay { if let s = model.flash { FlashView(signal: s) } }
    }
}

func distText(_ m: Double) -> String { m >= 1000 ? String(format: "%.1f km", m / 1000) : "\(Int((m / 10).rounded() * 10)) m" }
func colorHex(_ h: String) -> Color? {
    guard h.hasPrefix("#"), h.count == 7, let v = UInt32(h.dropFirst(), radix: 16) else { return nil }
    return Color(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
}
func turnSymbol(_ t: String) -> String {
    switch t { case "left": return "arrow.turn.up.left"; case "right": return "arrow.turn.up.right"; case "lift": return "cablecar"; case "arrive": return "flag.checkered"; default: return "arrow.up" }
}

/// Het signaal dat net getrild heeft, schermvullend: een grote pijl links of rechts.
struct FlashView: View {
    let signal: Signal
    var body: some View {
        ZStack {
            (signal == .off ? Color(red: 0.6, green: 0.1, blue: 0.1) : skiBlue).ignoresSafeArea()
            VStack(spacing: 6) {
                Image(systemName: signal.symbol).font(.system(size: 78, weight: .heavy)).foregroundStyle(signal == .off ? .white : skiGold)
                Text(signal.title).font(.system(size: 20, weight: .bold, design: .rounded)).multilineTextAlignment(.center)
            }
        }
        .transition(.opacity)
    }
}

struct Badge: View {
    let text: String, color: String
    var body: some View {
        Text(text).font(.system(size: 11, weight: .heavy)).foregroundStyle(.white)
            .padding(.horizontal, 5).padding(.vertical, 1)
            .background(colorHex(color) ?? .gray, in: RoundedRectangle(cornerRadius: 4))
    }
}

struct NavView: View {
    @EnvironmentObject var model: WatchModel
    var body: some View {
        if let n = model.nav {
            ScrollView {
                VStack(spacing: 4) {
                    Image(systemName: n.arrived ? "flag.checkered" : n.icon)
                        .font(.system(size: 44, weight: .bold)).foregroundStyle(skiGold)
                        .contentTransition(.symbolEffect(.replace))
                    Text(n.arrived ? "✓" : distText(n.dist))
                        .font(.system(size: 30, weight: .bold, design: .rounded)).monospacedDigit()
                    Text(n.instruction).font(.system(size: 14, weight: .semibold)).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.7)
                    HStack(spacing: 4) {
                        if !n.badge.isEmpty { Badge(text: n.badge, color: n.color) }
                        Text(n.eta, style: .time).font(.system(size: 12)).foregroundStyle(.secondary)
                        if n.leftM > 0 { Text("· " + distText(n.leftM)).font(.system(size: 12)).foregroundStyle(.secondary) }
                    }
                    if n.off {
                        Label(String(localized: "Van de route af", comment: "watch off route"), systemImage: "exclamationmark.triangle.fill")
                            .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Color.red, in: Capsule())
                    }
                    if !n.after.isEmpty {
                        Divider().padding(.vertical, 4)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(String(localized: "Daarna", comment: "watch next steps")).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).textCase(.uppercase)
                            ForEach(n.after) { a in
                                HStack(alignment: .top, spacing: 5) {
                                    Image(systemName: turnSymbol(a.turn)).font(.system(size: 12, weight: .bold)).foregroundStyle(skiGold).frame(width: 16)
                                    Text(a.text).font(.system(size: 12)).lineLimit(2)
                                    Spacer(minLength: 0)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 4)
            }
            .containerBackground((n.off ? Color(red: 0.45, green: 0.1, blue: 0.1) : skiBlue).gradient, for: .tabView)
        } else {
            VStack(spacing: 8) {
                Image(systemName: "figure.skiing.downhill").font(.system(size: 40, weight: .semibold)).foregroundStyle(skiGold)
                Text("Skipilot").font(.system(size: 20, weight: .bold, design: .rounded))
                Text(String(localized: "Start een route op je iPhone", comment: "watch idle")).font(.system(size: 13)).foregroundStyle(.secondary).multilineTextAlignment(.center)
            }
            .containerBackground(skiBlue.gradient, for: .tabView)
        }
    }
}

struct DayView: View {
    @EnvironmentObject var model: WatchModel
    var body: some View {
        if let d = model.day {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 4) {
                    Circle().fill(.red).frame(width: 6, height: 6)
                    Text(d.area.isEmpty ? "Skipilot" : d.area).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                    Spacer(minLength: 0)
                    Text(d.since, style: .timer).font(.system(size: 12)).monospacedDigit().foregroundStyle(.secondary)
                }
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(String(format: "%.1f", d.km)).font(.system(size: 40, weight: .bold, design: .rounded)).monospacedDigit()
                    Text("km").font(.system(size: 16, weight: .semibold)).foregroundStyle(skiGold)
                }
                HStack {
                    stat("\(d.hm)", "m ↓"); Spacer(); stat("\(d.vmax)", "km/h"); Spacer()
                    stat("\(d.runs)", String(localized: "afdalingen", comment: "watch runs"))
                }
            }
            .padding(.horizontal, 6)
            .containerBackground(skiNight.gradient, for: .tabView)
        } else {
            VStack(spacing: 8) {
                Image(systemName: "record.circle").font(.system(size: 36)).foregroundStyle(.red)
                Text(String(localized: "Neem je skidag op met de iPhone-app", comment: "watch day idle")).font(.system(size: 13)).multilineTextAlignment(.center).foregroundStyle(.secondary)
            }
            .containerBackground(skiNight.gradient, for: .tabView)
        }
    }
    func stat(_ v: String, _ u: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(v).font(.system(size: 18, weight: .bold, design: .rounded)).monospacedDigit()
            Text(u).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.7)
        }
    }
}

/// Bedienen vanaf je pols: grote knoppen, ook met handschoenen. De iPhone voert de opdracht uit.
struct ControlView: View {
    @EnvironmentObject var model: WatchModel
    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                if model.nav != nil {
                    cmdButton(String(localized: "Stop navigatie", comment: "watch control"), "xmark", "stop", tint: .red)
                }
                cmdButton(String(localized: "Naar het dal", comment: "watch control"), "arrow.down.to.line", "valley", tint: skiBlue)
                if model.day != nil {
                    cmdButton(String(localized: "Stop opname", comment: "watch control"), "stop.circle", "recstop", tint: .gray)
                } else {
                    cmdButton(String(localized: "Start opname", comment: "watch control"), "record.circle", "rec", tint: .gray)
                }
                NavigationLink { HapticsView() } label: {
                    Label(String(localized: "Trilsignalen", comment: "watch control"), systemImage: "applewatch.radiowaves.left.and.right").frame(maxWidth: .infinity)
                }
                status
            }
            .padding(.horizontal, 2)
        }
        .containerBackground(skiNight.gradient, for: .tabView)
    }
    @ViewBuilder var status: some View {
        switch model.sending {
        case .failed:
            Label(String(localized: "iPhone niet bereikbaar", comment: "watch control"), systemImage: "iphone.slash").font(.system(size: 12)).foregroundStyle(.orange)
        case .done:
            Label(String(localized: "Gedaan", comment: "watch control"), systemImage: "checkmark.circle.fill").font(.system(size: 12)).foregroundStyle(.green)
        case .busy:
            ProgressView().controlSize(.small)
        case .idle:
            if !model.reachable {
                Text(String(localized: "Open Skipilot op je iPhone", comment: "watch control")).font(.system(size: 11)).foregroundStyle(.secondary).multilineTextAlignment(.center)
            }
        }
    }
    func cmdButton(_ title: String, _ icon: String, _ cmd: String, tint: Color) -> some View {
        Button { model.send(cmd) } label: {
            Label(title, systemImage: icon).font(.system(size: 16, weight: .semibold)).frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent).tint(tint)
        .disabled(model.sending != .idle && model.sending != .failed)
    }
}

/// Oefenen: voel elk trilsignaal, zodat je ze kent voor je de berg op gaat.
struct HapticsView: View {
    @EnvironmentObject var model: WatchModel
    var body: some View {
        List {
            Section {
                ForEach(Signal.allCases) { s in
                    Button { Haptics.play(s, strong: model.haptStrong) } label: {
                        HStack(spacing: 8) {
                            Image(systemName: s.symbol).font(.system(size: 18, weight: .bold)).foregroundStyle(skiGold).frame(width: 26)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(s.title).font(.system(size: 15, weight: .semibold))
                                Text(s.hint).font(.system(size: 11)).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            } footer: {
                Text(String(localized: "Tik om te voelen. Ruim voor een afslag krijg je dezelfde code zachter.", comment: "watch haptics footer"))
            }
        }
        .navigationTitle(String(localized: "Trilsignalen", comment: "watch control"))
    }
}

struct SOSView: View {
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "cross.case.fill").font(.system(size: 30)).foregroundStyle(.white)
            Text(String(localized: "Noodgeval op de piste?", comment: "watch sos")).font(.system(size: 14, weight: .semibold)).multilineTextAlignment(.center)
            Link(destination: URL(string: "tel:112")!) {
                Label("112", systemImage: "phone.fill").font(.system(size: 20, weight: .bold))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent).tint(.red)
        }
        .containerBackground(Color(red: 0.55, green: 0.08, blue: 0.1).gradient, for: .tabView)
    }
}
