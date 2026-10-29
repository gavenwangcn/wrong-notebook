import UIKit

enum AppInfo {
    static var marketingVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
    }

    static var deviceType: String {
        UIDevice.current.userInterfaceIdiom == .pad ? "tablet" : "phone"
    }

    static func userAgentSuffix() -> String {
        " WrongNotebookIOS/\(marketingVersion) (\(deviceType))"
    }
}
