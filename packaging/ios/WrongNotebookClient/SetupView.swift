import SwiftUI

struct SetupView: View {
    @Binding var serverURL: String?
    @State private var input = ""
    @State private var busy = false
    @State private var status = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Image(systemName: "book.closed.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.indigo)
                    .padding(.top, 48)
                Text("setup_title")
                    .font(.title2.bold())
                Text("setup_description")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 420)
                TextField("setup_hint", text: $input)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(10)
                    .frame(maxWidth: 420)
                    .disabled(busy)
                Button("setup_connect") {
                    Task { await connect() }
                }
                .buttonStyle(.borderedProminent)
                .tint(.indigo)
                .frame(maxWidth: 420)
                .disabled(busy)
                if busy {
                    ProgressView()
                }
                if !status.isEmpty {
                    Text(status)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .onAppear {
            if let current = ServerConfig.get() {
                input = current
            }
        }
    }

    private func connect() async {
        guard let normalized = ServerConfig.normalize(input) else {
            status = String(localized: "setup_invalid_url")
            return
        }
        input = normalized
        busy = true
        status = String(localized: "setup_checking")
        let error = await HealthCheck.verify(serverURL: normalized)
        busy = false
        if error == nil {
            ServerConfig.set(normalized)
            serverURL = normalized
            return
        }
        status = error ?? ""
        // 与 Android 一致：校验失败时仍允许用户确认继续使用
        await MainActor.run {
            showUseAnywayAlert(url: normalized, message: error ?? "")
        }
    }

    @MainActor
    private func showUseAnywayAlert(url: String, message: String) {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let root = scene.keyWindow?.rootViewController else {
            ServerConfig.set(url)
            serverURL = url
            return
        }
        let alert = UIAlertController(
            title: String(localized: "setup_check_failed_title"),
            message: message + "\n\n" + String(localized: "setup_use_anyway_prompt"),
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: String(localized: "cancel"), style: .cancel))
        alert.addAction(UIAlertAction(title: String(localized: "setup_use_anyway"), style: .default) { _ in
            ServerConfig.set(url)
            serverURL = url
        })
        root.present(alert, animated: true)
    }
}
