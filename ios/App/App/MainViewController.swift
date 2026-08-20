import UIKit
import Capacitor

/*
 Exists solely to register HealthKitPlugin.

 Capacitor's automatic registration reads a packageClassList out of the
 generated capacitor.config.json, and the CLI rebuilds that list from the
 installed npm packages on every `cap sync`. A plugin that lives in the
 app target rather than in a package is therefore never in it, and adding
 it to the config by hand does not survive the next sync — the sync
 silently overwrites the file, so the plugin quietly stops existing.

 registerPluginInstance is the supported way in. Unlike registerPluginType
 it is not skipped when automatic registration is on, so the package
 plugins still register themselves as usual and this one is added
 alongside them.

 Main.storyboard points at this class instead of CAPBridgeViewController.
 */
class MainViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthKitPlugin())
    }
}
