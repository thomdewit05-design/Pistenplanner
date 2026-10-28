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
        AppShortcut(intent: StopIntent(), phrases: [
            "Stop navigatie in \(.applicationName)", "Stop navigation in \(.applicationName)", "Navigation beenden in \(.applicationName)"
        ])
    }
}
