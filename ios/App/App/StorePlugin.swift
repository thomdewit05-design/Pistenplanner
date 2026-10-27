import Capacitor
import StoreKit

// Skipilot Pro als eenmalige aankoop via de App Store (StoreKit 2).
// De webapp roept dit aan met Capacitor.nativePromise("Store", <methode>, {id}).
@objc(StorePlugin)
public class StorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorePlugin"
    public let jsName = "Store"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "product", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "owned", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]
    private var updates: Task<Void, Never>?

    override public func load() {
        // aankopen die buiten de app om afgerond worden (Vraag om te kopen, betaalproblemen, een andere iPhone)
        updates = Task.detached {
            for await result in Transaction.updates {
                if case .verified(let t) = result { await t.finish() }
            }
        }
    }

    deinit { updates?.cancel() }

    // prijs en naam zoals de App Store ze in jouw land en valuta toont
    @objc func product(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        Task {
            do {
                guard let p = try await Product.products(for: [id]).first else { return call.reject("Product niet gevonden") }
                call.resolve(["id": p.id, "title": p.displayName, "price": p.displayPrice])
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func buy(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        Task {
            do {
                guard let p = try await Product.products(for: [id]).first else { return call.reject("Product niet gevonden") }
                switch try await p.purchase() {
                case .success(let result):
                    guard case .verified(let t) = result else { return call.resolve(["state": "unverified"]) }
                    await t.finish()
                    call.resolve(["state": "bought"])
                case .pending: call.resolve(["state": "pending"])
                case .userCancelled: call.resolve(["state": "cancelled"])
                @unknown default: call.resolve(["state": "cancelled"])
                }
            } catch { call.reject(error.localizedDescription) }
        }
    }

    // werkt ook zonder internet: StoreKit bewaart de aankopen op de iPhone
    @objc func owned(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        Task { call.resolve(["owned": await Self.owns(id)]) }
    }

    // verplicht volgens Apple: aankopen terughalen op een nieuwe iPhone
    @objc func restore(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        Task {
            do { try await AppStore.sync() } catch { return call.reject(error.localizedDescription) }
            call.resolve(["owned": await Self.owns(id)])
        }
    }

    private static func owns(_ id: String) async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, t.productID == id, t.revocationDate == nil { return true }
        }
        return false
    }
}
