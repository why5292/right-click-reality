import UIKit

enum ImagePreparation {
    /// Render once to resolve EXIF orientation; display and upload the same pixels.
    static func prepare(_ image: UIImage) throws -> (image: UIImage, data: Data) {
        guard image.size.width > 0, image.size.height > 0 else {
            throw ServiceFailure(message: "这张图片无法读取，请重新选择。")
        }
        let maximumEdge: CGFloat = 1600
        let scale = min(1, maximumEdge / max(image.size.width, image.size.height))
        let size = CGSize(width: max(1, (image.size.width * scale).rounded()),
                          height: max(1, (image.size.height * scale).rounded()))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let rendered = UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let data = rendered.jpegData(compressionQuality: 0.82),
              data.count <= 6 * 1024 * 1024,
              let normalized = UIImage(data: data) else {
            throw ServiceFailure(message: "图片处理失败，请重新选择。")
        }
        return (normalized, data)
    }
}
