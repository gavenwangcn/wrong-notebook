import SwiftUI
import WebKit
import PhotosUI
import UniformTypeIdentifiers

struct BrowserView: View {
    let serverURL: String
    var onChangeServer: () -> Void

    @State private var loadError: String?
    @State private var isLoading = true

    var body: some View {
        ZStack {
            WebContainer(
                serverURL: serverURL,
                onChangeServer: onChangeServer,
                loadError: $loadError,
                isLoading: $isLoading
            )
            if isLoading {
                ProgressView()
                    .scaleEffect(1.2)
            }
            if let loadError {
                VStack(spacing: 12) {
                    Text("error_title")
                        .font(.headline)
                    Text("\(serverURL)\n\(loadError)")
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                    Button("error_retry") {
                        self.loadError = nil
                        isLoading = true
                        NotificationCenter.default.post(name: .wrongNotebookReloadWeb, object: nil)
                    }
                    Button("error_change_server", action: onChangeServer)
                }
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(12)
                .padding()
            }
        }
    }
}

extension Notification.Name {
    static let wrongNotebookReloadWeb = Notification.Name("wrongNotebookReloadWeb")
}

private struct WebContainer: UIViewRepresentable {
    let serverURL: String
    let onChangeServer: () -> Void
    @Binding var loadError: String?
    @Binding var isLoading: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(serverURL: serverURL, onChangeServer: onChangeServer, loadError: $loadError, isLoading: $isLoading)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        let controller = config.userContentController
        controller.add(context.coordinator, name: "changeServer")
        controller.add(context.coordinator, name: "print")
        controller.add(context.coordinator, name: "saveFile")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.customUserAgent = (webView.value(forKey: "userAgent") as? String ?? "") + AppInfo.userAgentSuffix()
        webView.isInspectable = true
        context.coordinator.webView = webView
        context.coordinator.loadHome()
        NotificationCenter.default.addObserver(
            context.coordinator,
            selector: #selector(Coordinator.reloadNotification),
            name: .wrongNotebookReloadWeb,
            object: nil
        )
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.serverURL = serverURL
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var serverURL: String
        let onChangeServer: () -> Void
        var webView: WKWebView?
        @Binding var loadError: String?
        @Binding var isLoading: Bool

        init(serverURL: String, onChangeServer: @escaping () -> Void, loadError: Binding<String?>, isLoading: Binding<Bool>) {
            self.serverURL = serverURL
            self.onChangeServer = onChangeServer
            _loadError = loadError
            _isLoading = isLoading
        }

        func loadHome() {
            guard let url = URL(string: serverURL) else { return }
            webView?.load(URLRequest(url: url))
        }

        @objc func reloadNotification() {
            loadHome()
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard isTrustedPage else { return }
            switch message.name {
            case "changeServer":
                DispatchQueue.main.async { self.onChangeServer() }
            case "print":
                DispatchQueue.main.async { self.printPage() }
            case "saveFile":
                if let body = message.body as? [String: Any] {
                    let data = body["data"] as? String ?? ""
                    let name = body["name"] as? String ?? "download"
                    let mime = body["mime"] as? String ?? ""
                    saveFile(dataUrl: data, fileName: name, mime: mime)
                }
            default:
                break
            }
        }

        private var isTrustedPage: Bool {
            guard let url = webView?.url else { return false }
            return ServerConfig.isSameOrigin(page: url, server: serverURL)
        }

        private func injectBridge() {
            guard let webView else { return }
            let escapedURL = serverURL.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
            let bootstrap = """
            window.WrongNotebookIOS = {
              changeServer: function() { window.webkit.messageHandlers.changeServer.postMessage(''); },
              getServerUrl: function() { return '\(escapedURL)'; },
              getDeviceType: function() { return '\(AppInfo.deviceType)'; },
              isStandalone: function() { return false; },
              print: function() { window.webkit.messageHandlers.print.postMessage(''); },
              saveFile: function(dataUrl, name, mime) {
                window.webkit.messageHandlers.saveFile.postMessage({ data: dataUrl, name: name, mime: mime });
              }
            };
            """
            webView.evaluateJavaScript(bootstrap, completionHandler: nil)
            if let path = Bundle.main.path(forResource: "bridge", ofType: "js"),
               let script = try? String(contentsOfFile: path, encoding: .utf8) {
                webView.evaluateJavaScript(script, completionHandler: nil)
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isLoading = false
            loadError = nil
            injectBridge()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            isLoading = false
            loadError = error.localizedDescription
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            isLoading = false
            loadError = error.localizedDescription
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            if navigationAction.targetFrame == nil {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            if let host = url.host, !ServerConfig.isSameOrigin(page: url, server: serverURL),
               url.scheme?.hasPrefix("http") == true {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        @available(iOS 15.0, *)
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
                webView.load(URLRequest(url: url))
            }
            return nil
        }

        /// 网页 `<input type="file">`：iOS 18.4+ 原生文件选择
        @available(iOS 18.4, *)
        func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
            var config = PHPickerConfiguration(photoLibrary: .shared())
            config.filter = .images
            config.selectionLimit = parameters.allowsMultipleSelection ? 0 : 1
            let picker = PHPickerViewController(configuration: config)
            picker.delegate = PhotoPickerDelegate { urls in
                completionHandler(urls)
            }
            UIApplication.shared.firstKeyWindow?.rootViewController?.present(picker, animated: true)
        }

        private func printPage() {
            guard let webView else { return }
            let printController = UIPrintInteractionController.shared
            printController.printFormatter = webView.viewPrintFormatter()
            printController.present(animated: true, completionHandler: nil)
        }

        private func saveFile(dataUrl: String, fileName: String, mime: String) {
            guard dataUrl.hasPrefix("data:"), let comma = dataUrl.firstIndex(of: ",") else { return }
            let meta = String(dataUrl[dataUrl.index(dataUrl.startIndex, offsetBy: 5)..<comma])
            let payload = String(dataUrl[dataUrl.index(after: comma)...])
            let isBase64 = meta.contains(";base64")
            guard let data = isBase64 ? Data(base64Encoded: payload) : payload.data(using: .utf8) else { return }
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName.isEmpty ? "download" : fileName)
            try? data.write(to: url)
            let picker = UIDocumentPickerViewController(forExporting: [url])
            UIApplication.shared.firstKeyWindow?.rootViewController?.present(picker, animated: true)
        }
    }
}

private extension UIApplication {
    var firstKeyWindow: UIWindow? {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
    }
}

private final class PhotoPickerDelegate: NSObject, PHPickerViewControllerDelegate {
    private let completion: ([URL]?) -> Void

    init(completion: @escaping ([URL]?) -> Void) {
        self.completion = completion
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard !results.isEmpty else {
            completion(nil)
            return
        }
        var urls: [URL] = []
        let group = DispatchGroup()
        for result in results {
            group.enter()
            result.itemProvider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, _ in
                defer { group.leave() }
                guard let url else { return }
                let dest = FileManager.default.temporaryDirectory.appendingPathComponent(url.lastPathComponent)
                try? FileManager.default.removeItem(at: dest)
                try? FileManager.default.copyItem(at: url, to: dest)
                urls.append(dest)
            }
        }
        group.notify(queue: .main) {
            self.completion(urls.isEmpty ? nil : urls)
        }
    }
}
