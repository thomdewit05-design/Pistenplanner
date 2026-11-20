import HealthKit
import WatchKit

// Trillen met je arm naar beneden. Een Watch-app die niet in beeld is, mag niet trillen en krijgt geen berichten van de iPhone.
// Tijdens het navigeren loopt er daarom een trainingssessie ("skiën"): dan blijft de app actief, ook met het scherm uit.
// Er wordt niets bewaard en niets gelezen: er is geen "builder", dus er komt geen training in Gezondheid door de navigatie.
final class NavSession: NSObject, HKWorkoutSessionDelegate {
    enum State { case off, on, denied }
    static let shared = NavSession()
    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var starting = false
    private(set) var state: State = .off { didSet { if state != oldValue { onChange?(state) } } }
    var onChange: ((State) -> Void)?

    static func skiing() -> HKWorkoutConfiguration {
        let c = HKWorkoutConfiguration(); c.activityType = .downhillSkiing; c.locationType = .outdoor; return c
    }

    func start(_ config: HKWorkoutConfiguration? = nil) {
        guard session == nil, !starting, HKHealthStore.isHealthDataAvailable() else { return }
        starting = true
        // een sessie starten mag alleen met toestemming om trainingen te schrijven; de app schrijft er geen
        store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: []) { _, _ in
            DispatchQueue.main.async {
                self.starting = false
                guard self.session == nil else { return }
                guard self.store.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized else { self.state = .denied; return }
                do {
                    let s = try HKWorkoutSession(healthStore: self.store, configuration: config ?? NavSession.skiing())
                    s.delegate = self
                    s.startActivity(with: Date())
                    self.session = s
                    self.state = .on
                } catch { self.state = .off }
            }
        }
    }

    func stop() {
        session?.end()
        session = nil
        if state == .on { state = .off }
    }

    /// Na een crash kan er nog een sessie openstaan: die sluiten, anders loopt hij door en kost hij batterij.
    func recover() {
        store.recoverActiveWorkoutSession { s, _ in s?.end() }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        guard toState == .ended || toState == .stopped else { return }
        DispatchQueue.main.async { if self.session === workoutSession { self.session = nil; if self.state == .on { self.state = .off } } }
    }
    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        DispatchQueue.main.async { if self.session === workoutSession { self.session = nil; if self.state == .on { self.state = .off } } }
    }
}

/// De iPhone kan de Watch-app starten als de navigatie begint (HKHealthStore.startWatchApp); dat komt hier binnen.
final class WatchAppDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() { _ = WatchModel.shared }
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        let m = WatchModel.shared
        m.wantSession = true
        if m.haptOn && m.haptBg { NavSession.shared.start(workoutConfiguration) }
    }
    func handleActiveWorkoutRecovery() { NavSession.shared.recover() }
}
