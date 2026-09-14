import Foundation

enum ObjectKind: String, Codable, Sendable {
    case text, book, object
}

struct NormalizedBox: Codable, Equatable, Sendable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double

    var isValid: Bool {
        [x, y, width, height].allSatisfy(\.isFinite) &&
        x >= 0 && y >= 0 && width > 0 && height > 0 &&
        x + width <= 1.000001 && y + height <= 1.000001
    }

    var area: Double { width * height }
}

struct DetectedObject: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let type: ObjectKind
    let box: NormalizedBox
    let description: String?
    let usage: String?
    var usageTitle: String? = nil
    let text: String?
    let translation: String?

    var actions: [ObjectAction] {
        var result: [ObjectAction] = []
        if let description = description.nonEmpty {
            let title: String
            switch type {
            case .text: title = "看懂内容"
            case .book: title = "查看封面信息"
            case .object: title = "观察到的情况"
            }
            result.append(ObjectAction(kind: .describe, title: title, symbol: "sparkles", content: description))
        }
        if type == .object, let usage = usage.nonEmpty {
            result.insert(ObjectAction(kind: .usage, title: usageTitle.nonEmpty ?? "下一步建议", symbol: "lightbulb", content: usage), at: 0)
        }
        if text.nonEmpty != nil, let translation = translation.nonEmpty {
            result.append(ObjectAction(kind: .translate, title: "翻译文字", symbol: "character.bubble", content: translation))
        }
        if let text = text.nonEmpty {
            result.append(ObjectAction(kind: .copy, title: type == .book ? "复制封面文字" : "复制文字", symbol: "doc.on.doc", content: text))
        }
        result.append(ObjectAction(kind: .share, title: "分享", symbol: "square.and.arrow.up", content: shareContent))
        return result
    }

    var shareContent: String {
        var parts = [name]
        if let value = description.nonEmpty { parts.append(value) }
        if type == .object, let value = usage.nonEmpty { parts.append((usageTitle.nonEmpty ?? "下一步建议") + "\n" + value) }
        if let value = text.nonEmpty { parts.append("原文\n" + value) }
        if let value = translation.nonEmpty { parts.append("中文翻译\n" + value) }
        return parts.joined(separator: "\n\n")
    }
}

struct AnalysisResponse: Codable, Sendable {
    let objects: [DetectedObject]
}

struct ObjectAction: Identifiable, Equatable, Sendable {
    enum Kind: String, Sendable { case describe, usage, translate, copy, share }
    let kind: Kind
    let title: String
    let symbol: String
    let content: String
    var id: String { kind.rawValue }
}

struct ResultCard: Identifiable {
    let id = UUID()
    let objectName: String
    let title: String
    let content: String
}

private extension Optional where Wrapped == String {
    var nonEmpty: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty, value != "null" else { return nil }
        return value
    }
}
