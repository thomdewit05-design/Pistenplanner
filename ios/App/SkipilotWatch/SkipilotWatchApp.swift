import SwiftUI
import WatchConnectivity
import WatchKit

// Skipilot op de Apple Watch: de volgende afslag met een tikje op je pols, je skidag live en een noodknop.
// De gegevens komen van de iPhone-app (WatchLink in NavPlugin.swift) via WatchConnectivity.
@main
struct SkipilotWatchApp: App {
    @StateObject private var model = WatchModel()
    var body: some Scene {
        WindowGroup { RootView().environmentObject(model) }
    }
}

let skiBlue = Color(red: 31/255, green: 127/255, blue: 214/255)
let skiGold = Color(red: 1, green: 196/255, blue: 0)

final class WatchModel: NSObject, ObservableObject, WCSessionDelegate {
    struct Nav { var dist: Double; var instruction: String; var icon: String; var current: String; var eta: Date; var badge: String; var color: String; var arrived: Bool; var dest: String }
    struct Day { var km: Double; var hm: Int; var vmax: Int; var runs: Int; var since: Date; var area: String }
    @Published var nav: Nav?
    @Published var day: Day?
    @Published var ts: Date?

    override init() {
        super.init()
        if WCSession.isSupported() { WCSession.default.delegate = self; WCSession.default.activate() }
    }

    private func apply(_ ctx: [String: Any], tap: Bool) {
        DispatchQueue.main.async {
            if let n = ctx["nav"] as? [String: Any], let ins = n["instruction"] as? String {
                self.nav = Nav(dist: n["dist"] as? Double ?? 0, instruction: ins, icon: n["icon"] as? String ?? "arrow.up",
                               current: n["current"] as? String ?? "", eta: Date(timeIntervalSince1970: n["eta"] as? Double ?? 0),
                               badge: n["badge"] as? String ?? "", color: n["color"] as? String ?? "", arrived: n["arrived"] as? Bool ?? false,
                               dest: n["dest"] as? String ?? "")
            } else if ctx["nav"] != nil { self.nav = nil }
            if let d = ctx["day"] as? [String: Any], let km = d["km"] as? Double {
                self.day = Day(km: km, hm: d["hm"] as? Int ?? 0, vmax: d["vmax"] as? Int ?? 0, runs: d["runs"] as? Int ?? 0,
                               since: Date(timeIntervalSince1970: d["since"] as? Double ?? Date().timeIntervalSince1970), area: d["area"] as? String ?? "")
            } else if ctx["day"] != nil { self.day = nil }
            self.ts = Date()
            if tap, let n = self.nav {
                let i = n.icon
                WKInterfaceDevice.current().play(n.arrived ? .success : i.contains("right") ? .directionUp : i.contains("left") ? .directionDown : .notification)
            }
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        let c = session.receivedApplicationContext
        if !c.isEmpty { apply(c, tap: false) }
    }
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) { apply(applicationContext, tap: false) }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if let c = message["ctx"] as? [String: Any] { apply(c, tap: message["tap"] as? Bool ?? false) }
    }
}

struct RootView: View {
    @EnvironmentObject var model: WatchModel
    var body: some View {
        TabView {
            NavView()
            DayView()
            SOSView()
        }
        .tabViewStyle(.verticalPage)
    }
}

func distText(_ m: Double) -> String { m >= 1000 ? String(format: "%.1f km", m / 1000) : "\(Int((m / 10).rounded() * 10)) m" }
func colorHex(_ h: String) -> Color? {
    guard h.hasPrefix("#"), h.count == 7, let v = UInt32(h.dropFirst(), radix: 16) else { return nil }
    return Color(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
}

struct NavView: View {
    @EnvironmentObject var model: WatchModel
    var body: some View {
        if let n = model.nav {
            VStack(spacing: 4) {
                Image(systemName: n.arrived ? "flag.checkered" : n.icon)
                    .font(.system(size: 46, weight: .bold)).foregroundStyle(skiGold)
                    .contentTransition(.symbolEffect(.replace))
                Text(n.arrived ? "✓" : distText(n.dist))
                    .font(.system(size: 30, weight: .bold, design: .rounded)).monospacedDigit()
                Text(n.instruction).font(.system(size: 14, weight: .semibold)).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.7)
                HStack(spacing: 4) {
                    if !n.badge.isEmpty {
                        Text(n.badge).font(.system(size: 11, weight: .heavy)).foregroundStyle(.white)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(colorHex(n.color) ?? .gray, in: RoundedRectangle(cornerRadius: 4))
                    }
                    Text(n.eta, style: .time).font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 4)
            .containerBackground(skiBlue.gradient, for: .tabView)
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
                    stat("\(d.hm)", "m ↓"); Spacer(); stat("\(d.vmax)", "km/h"); Spacer(); stat("\(d.runs)", "runs")
                }
            }
            .padding(.horizontal, 6)
            .containerBackground(Color(red: 0.06, green: 0.11, blue: 0.17).gradient, for: .tabView)
        } else {
            VStack(spacing: 8) {
                Image(systemName: "record.circle").font(.system(size: 36)).foregroundStyle(.red)
                Text(String(localized: "Neem je skidag op met de iPhone-app", comment: "watch day idle")).font(.system(size: 13)).multilineTextAlignment(.center).foregroundStyle(.secondary)
            }
            .containerBackground(Color(red: 0.06, green: 0.11, blue: 0.17).gradient, for: .tabView)
        }
    }
    func stat(_ v: String, _ u: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(v).font(.system(size: 18, weight: .bold, design: .rounded)).monospacedDigit()
            Text(u).font(.system(size: 10)).foregroundStyle(.secondary)
        }
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
