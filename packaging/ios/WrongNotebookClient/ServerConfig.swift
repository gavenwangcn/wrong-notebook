import Foundation

/// 保存用户填写的服务器地址（与 Android ServerConfig 行为一致）
enum ServerConfig {
    private static let defaults = UserDefaults.standard
    private static let key = "server.url"

    static func get() -> String? {
        if let saved = defaults.string(forKey: key), !saved.isEmpty {
            return saved
        }
        if let raw = Bundle.main.infoDictionary?["WrongNotebookDefaultServerURL"] as? String,
           !raw.isEmpty,
           let normalized = normalize(raw) {
            return normalized
        }
        return nil
    }

    static func set(_ url: String) {
        defaults.set(url, forKey: key)
    }

    static func clear() {
        defaults.removeObject(forKey: key)
    }

    /// 缺省补 http://，去掉末尾斜杠；无效时返回 nil
    static func normalize(_ input: String) -> String? {
        var value = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.isEmpty { return nil }
        if !value.contains("://") {
            value = "http://" + value
        }
        guard let components = URLComponents(string: value),
              let scheme = components.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              let host = components.host, !host.isEmpty else {
            return nil
        }
        var path = components.path
        while path.hasSuffix("/") { path.removeLast() }
        var portPart = ""
        if let port = components.port {
            portPart = ":\(port)"
        }
        return "\(scheme)://\(host)\(portPart)\(path)"
    }

    static func isSameOrigin(page: URL, server: String) -> Bool {
        guard let serverURL = URL(string: server) else { return false }
        return page.scheme?.lowercased() == serverURL.scheme?.lowercased()
            && page.host?.lowercased() == serverURL.host?.lowercased()
            && effectivePort(page) == effectivePort(serverURL)
    }

    private static func effectivePort(_ url: URL) -> Int {
        if let port = url.port { return port }
        return url.scheme?.lowercased() == "https" ? 443 : 80
    }
}
