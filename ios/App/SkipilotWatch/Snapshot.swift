import Foundation

// De laatste stand voor de complicatie op de wijzerplaat. De Watch-app schrijft hem in de gedeelde opslag (App Group),
// de complicatie (SkipilotWatchWidget) leest hem. Dit bestand zit in beide onderdelen.
struct WatchSnapshot: Codable, Equatable {
    static let group = "group.nl.skipilot.app"
    static let key = "watch-snapshot"
    static let kind = "SkipilotComplication"

    var lang = "nl"
    // navigatie
    var navAt: Date?            // wanneer de afslag voor het laatst is bijgewerkt
    var dist: Double = 0
    var instruction = ""
    var turn = "straight"
    var arrived = false
    // skidag
    var dayAt: Date?
    var km: Double = 0
    var hm = 0
    var runs = 0

    /// Navigatie telt alleen als hij vers is: zonder iPhone zou een oude afslag anders uren blijven staan.
    func navigating(_ now: Date = Date()) -> Bool { navAt.map { now.timeIntervalSince($0) < 15 * 60 } ?? false }
    /// De skidag van vandaag; die van gisteren hoort niet meer op de wijzerplaat.
    func hasDay(_ now: Date = Date()) -> Bool { dayAt.map { Calendar.current.isDate($0, inSameDayAs: now) } ?? false }

    static func load() -> WatchSnapshot {
        guard let d = UserDefaults(suiteName: group)?.data(forKey: key), let s = try? JSONDecoder().decode(WatchSnapshot.self, from: d) else { return WatchSnapshot() }
        return s
    }
    func save() {
        guard let d = try? JSONEncoder().encode(self) else { return }
        UserDefaults(suiteName: WatchSnapshot.group)?.set(d, forKey: WatchSnapshot.key)
    }
}

func snapDistText(_ m: Double) -> String { m >= 1000 ? String(format: "%.1f km", m / 1000) : "\(Int((m / 10).rounded() * 10)) m" }
func snapTurnSymbol(_ t: String) -> String {
    switch t { case "left": return "arrow.turn.up.left"; case "right": return "arrow.turn.up.right"; case "lift": return "cablecar"; case "arrive": return "flag.checkered"; default: return "arrow.up" }
}
