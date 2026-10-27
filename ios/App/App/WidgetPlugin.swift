import Capacitor
import WidgetKit

// Geeft gegevens van de webapp door aan de widgets op het beginscherm (via de gedeelde App Group).
// De webapp roept dit aan met Capacitor.nativePromise("Widget", "set", {key, value}); value is JSON-tekst.
@objc(WidgetPlugin)
public class WidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetPlugin"
    public let jsName = "Widget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]
    static let group = "group.nl.skipilot.app"

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value"),
              let shared = UserDefaults(suiteName: Self.group) else { return call.reject("Geen gedeelde opslag") }
        if shared.string(forKey: key) != value {
            shared.set(value, forKey: key)
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
