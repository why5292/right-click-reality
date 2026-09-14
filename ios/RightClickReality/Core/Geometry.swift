import Foundation
import CoreGraphics

enum PhotoGeometry {
    static func imageRect(imageSize: CGSize, containerSize: CGSize) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0,
              containerSize.width > 0, containerSize.height > 0 else { return .zero }
        let scale = min(containerSize.width / imageSize.width, containerSize.height / imageSize.height)
        let size = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        return CGRect(x: (containerSize.width - size.width) / 2,
                      y: (containerSize.height - size.height) / 2,
                      width: size.width, height: size.height)
    }

    static func objectRect(_ box: NormalizedBox, imageSize: CGSize, containerSize: CGSize) -> CGRect {
        guard box.isValid else { return .zero }
        let image = imageRect(imageSize: imageSize, containerSize: containerSize)
        return CGRect(x: image.minX + CGFloat(box.x) * image.width,
                      y: image.minY + CGFloat(box.y) * image.height,
                      width: CGFloat(box.width) * image.width,
                      height: CGFloat(box.height) * image.height)
    }

    static func menuOrigin(target: CGRect, menuSize: CGSize, containerSize: CGSize) -> CGPoint {
        let margin: CGFloat = 12
        let gap: CGFloat = 10
        var x = target.midX - menuSize.width / 2
        var y = target.maxY + gap
        if y + menuSize.height > containerSize.height - margin {
            y = target.minY - menuSize.height - gap
        }
        let maxX = max(margin, containerSize.width - menuSize.width - margin)
        let maxY = max(margin, containerSize.height - menuSize.height - margin)
        x = min(max(margin, x), maxX)
        y = min(max(margin, y), maxY)
        return CGPoint(x: x, y: y)
    }
}
