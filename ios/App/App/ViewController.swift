import Capacitor

// Het scherm met de webapp; hier melden we de eigen plug-ins aan.
class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(StorePlugin())
        bridge?.registerPluginInstance(WidgetPlugin())
    }
}
