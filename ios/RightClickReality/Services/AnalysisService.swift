import Foundation

struct ServiceFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

struct AnalysisService {
    func analyze(jpegData: Data) async throws -> AnalysisResponse {
        guard let setting = Bundle.main.object(forInfoDictionaryKey: "RCRBackendURL") as? String,
              let url = URL(string: setting.trimmingCharacters(in: .whitespacesAndNewlines)),
              ["https", "http"].contains(url.scheme?.lowercased() ?? ""),
              url.host != nil else {
            throw ServiceFailure(message: "识别服务暂未连接，请稍后重试。")
        }
        var request = URLRequest(url: url.appendingPathComponent("analyze"))
        request.httpMethod = "POST"
        request.timeoutInterval = 75
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(ImageRequest(imageBase64: jpegData.base64EncodedString(), mimeType: "image/jpeg"))
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse else {
            throw ServiceFailure(message: "没有收到识别结果，请重试。")
        }
        guard (200..<300).contains(response.statusCode) else {
            let envelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: data)
            throw ServiceFailure(message: envelope?.error.message ?? "识别服务暂时不可用，请稍后重试。")
        }
        do {
            let result = try JSONDecoder().decode(AnalysisResponse.self, from: data)
            guard result.objects.count <= 3,
                  result.objects.allSatisfy({ $0.box.isValid && !$0.name.isEmpty }),
                  Set(result.objects.map(\.id)).count == result.objects.count else {
                throw ServiceFailure(message: "物体位置未识别清楚，请重新拍摄。")
            }
            return result
        } catch let error as ServiceFailure { throw error }
        catch { throw ServiceFailure(message: "识别结果格式异常，请重试。") }
    }
}

private struct ImageRequest: Encodable {
    let imageBase64: String
    let mimeType: String
}

private struct ErrorEnvelope: Decodable {
    struct Detail: Decodable { let code: String; let message: String }
    let error: Detail
}
