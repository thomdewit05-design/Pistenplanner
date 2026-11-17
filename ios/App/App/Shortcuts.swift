import AppIntents
import Foundation

// Siri en de app Opdrachten: "Navigeer naar het dal met Skipilot" enzovoort. Een opdracht opent de app en zet
// een actie klaar; de webapp haalt die op (NavPlugin.pending) en voert hem uit.
@available(iOS 16.0, *)
enum SiriAction {
    static func run(_ action: String) {
        UserDefaults.standard.set(action, forKey: NavPlugin.actionKey)
        NotificationCenter.default.post(name: NavPlugin.actionNote, object: nil)
    }
}

@available(iOS 16.0, *)
struct ValleyIntent: AppIntent {
    static let title: LocalizedStringResource = "Naar het dal"
    static let description = IntentDescription("Navigeer vanaf je plek naar het dal.")
    static let openAppWhenRun: Bool = true
    @MainActor func perform() async throws -> some IntentResult { SiriAction.run("valley"); return .result() }
}

@available(iOS 16.0, *)
struct HutIntent: AppIntent {
    static let title: LocalizedStringResource = "Naar de dichtstbijzijnde hut"
    static let description = IntentDescription("Navigeer naar de hut of het restaurant dat het dichtst bij je is.")
    static let openAppWhenRun: Bool = true
    @MainActor func perform() async throws -> some IntentResult { SiriAction.run("hut"); return .result() }
}

@available(iOS 16.0, *)
struct HomeIntent: AppIntent {
    static let title: LocalizedStringResource = "Naar mijn verblijf"
    static let description = IntentDescription("Navigeer naar je hotel of appartement (ingesteld in Skipilot).")
    static let openAppWhenRun: Bool = true
    @MainActor func perform() async throws -> some IntentResult { SiriAction.run("home"); return .result() }
}

@available(iOS 16.0, *)
struct StopIntent: AppIntent {
    static let title: LocalizedStringResource = "Stop navigatie"
    static let description = IntentDescription("Stop de navigatie in Skipilot.")
    static let openAppWhenRun: Bool = true
    @MainActor func perform() async throws -> some IntentResult { SiriAction.run("stop"); return .result() }
}

@available(iOS 16.0, *)
struct StartDayIntent: AppIntent {
    static let title: LocalizedStringResource = "Begin skidag"
    static let description = IntentDescription("Start het skidagboek: kilometers, hoogtemeters en topsnelheid.")
    static let openAppWhenRun: Bool = true
    @MainActor func perform() async throws -> some IntentResult { SiriAction.run("rec"); return .result() }
}

@available(iOS 16.0, *)
struct StopDayIntent: AppIntent {
    static let title: LocalizedStringResource = "Stop skidag"
    static let description = IntentDescription("Stop het skidagboek en bewaar je dag.")
    static let openAppWhenRun: Bool = true
    @MainActor func perform() async throws -> some IntentResult { SiriAction.run("recstop"); return .result() }
}

// zonder de app te openen: Siri leest je kilometers van vandaag voor (uit de gedeelde gegevens van de widget)
@available(iOS 16.0, *)
struct KmTodayIntent: AppIntent {
    static let title: LocalizedStringResource = "Kilometers van vandaag"
    static let description = IntentDescription("Hoeveel heb je vandaag geskied?")
    static let openAppWhenRun: Bool = false
    func perform() async throws -> some IntentResult & ProvidesDialog {
        struct D: Decodable { let date: String; let km: Double; let hm: Double; let runs: Int; let vmax: Double; let lang: String? }
        let f = DateFormatter(); f.dateFormat = "yyyyMMdd"
        guard let s = UserDefaults(suiteName: WidgetPlugin.group)?.string(forKey: "day"), let d = try? JSONDecoder().decode(D.self, from: Data(s.utf8)), d.date == f.string(from: Date()) else {
            return .result(dialog: "Je hebt vandaag nog geen skidag opgenomen.")
        }
        let km = String(format: "%.1f", d.km), hm = Int(d.hm.rounded()), v = Int(d.vmax.rounded())
        switch d.lang {
        case "en": return .result(dialog: "Today you skied \(km) km, \(hm) metres down in \(d.runs) runs. Top speed \(v) km/h.")
        case "de": return .result(dialog: "Heute bist du \(km) km gefahren, \(hm) Höhenmeter in \(d.runs) Abfahrten. Höchstgeschwindigkeit \(v) km/h.")
        default: return .result(dialog: "Vandaag skiede je \(km) km, \(hm) meter omlaag in \(d.runs) afdalingen. Topsnelheid \(v) km/u.")
        }
    }
}

@available(iOS 16.0, *)
struct SkipilotShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: ValleyIntent(), phrases: [
            "Navigeer naar het dal met \(.applicationName)", "\(.applicationName) naar het dal",
            "Take me to the valley with \(.applicationName)", "Bring mich ins Tal mit \(.applicationName)"
        ])
        AppShortcut(intent: HutIntent(), phrases: [
            "Navigeer naar de dichtstbijzijnde hut met \(.applicationName)", "\(.applicationName) naar een hut",
            "Take me to the nearest hut with \(.applicationName)", "Bring mich zur nächsten Hütte mit \(.applicationName)"
        ])
        AppShortcut(intent: HomeIntent(), phrases: [
            "Navigeer naar mijn verblijf met \(.applicationName)", "\(.applicationName) naar huis",
            "Take me home with \(.applicationName)", "Bring mich zur Unterkunft mit \(.applicationName)"
        ])
        AppShortcut(intent: StartDayIntent(), phrases: [
            "Begin skidag met \(.applicationName)", "Start mijn skidag in \(.applicationName)",
            "Start my ski day with \(.applicationName)", "Starte meinen Skitag mit \(.applicationName)"
        ])
        AppShortcut(intent: StopDayIntent(), phrases: [
            "Stop skidag in \(.applicationName)", "Stop my ski day in \(.applicationName)", "Skitag beenden in \(.applicationName)"
        ])
        AppShortcut(intent: KmTodayIntent(), phrases: [
            "Hoeveel heb ik geskied met \(.applicationName)", "Kilometers vandaag in \(.applicationName)",
            "How far did I ski with \(.applicationName)", "Wie weit bin ich gefahren mit \(.applicationName)"
        ])
        AppShortcut(intent: StopIntent(), phrases: [
            "Stop navigatie in \(.applicationName)", "Stop navigation in \(.applicationName)", "Navigation beenden in \(.applicationName)"
        ])
    }
}
