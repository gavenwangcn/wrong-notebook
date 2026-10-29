import SwiftUI

struct RootView: View {
    @State private var serverURL: String? = ServerConfig.get()

    var body: some View {
        Group {
            if let url = serverURL {
                BrowserView(serverURL: url) {
                    ServerConfig.clear()
                    serverURL = nil
                }
            } else {
                SetupView(serverURL: $serverURL)
            }
        }
    }
}
