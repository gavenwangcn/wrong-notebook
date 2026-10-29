import Foundation

enum HealthCheck {
    private static let timeout: TimeInterval = 8

    /// nil 表示可用；否则为错误说明
    static func verify(serverURL: String) async -> String? {
        guard let url = URL(string: serverURL + "/api/health") else {
            return NSLocalizedString("setup_invalid_url", comment: "")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = timeout
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                return String(format: NSLocalizedString("setup_http_error", comment: ""), (response as? HTTPURLResponse)?.statusCode ?? 0)
            }
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["status"] as? String == "ok" {
                return nil
            }
            return NSLocalizedString("setup_not_wrong_notebook", comment: "")
        } catch {
            return error.localizedDescription
        }
    }
}
