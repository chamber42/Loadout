import UIKit
import Capacitor

/*
 Registers the plugins that live in the app target, and takes the scroll
 indicators off the web view.

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
        bridge?.registerPluginInstance(NotificationsPlugin())
    }

    /* The bar down the right-hand edge while scrolling is drawn by the web
       view's UIScrollView, not by the page — so no CSS can reach it.
       ::-webkit-scrollbar hides scrollbars on elements that scroll their own
       overflow; the document's own indicator belongs to UIKit and has to be
       turned off here.

       Both axes: the horizontal one appears on the date strip and the wider
       tables for the same reason and is no more useful. Nothing is lost by
       removing them — the indicator on a web view cannot be dragged, so it
       reports a position without offering any way to change it. */
    override open func viewDidLoad() {
        super.viewDidLoad()
        webView?.scrollView.showsVerticalScrollIndicator = false
        webView?.scrollView.showsHorizontalScrollIndicator = false
    }
}
