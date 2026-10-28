import Foundation
#if canImport(ActivityKit)
import ActivityKit

// Gedeeld door de app en de widget-extensie: wat de navigatie op het toegangsscherm en in het Dynamic Island laat zien.
@available(iOS 16.1, *)
struct NavAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var dist: Double          // meter tot de volgende aanwijzing
        var instruction: String   // wat je daar moet doen
        var icon: String          // SF Symbol van die aanwijzing
        var current: String       // waar je nu bent (piste of lift)
        var eta: Date             // aankomst op de bestemming
        var badge: String?        // pistenummer
        var color: String?        // kleur van de piste (#rrggbb)
        var arrived: Bool
    }
    var dest: String
    var lang: String
}
#endif
