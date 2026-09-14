import Foundation
import CoreGraphics

@main
enum CoreChecks {
    static func main() throws {
        var count = 0
        func check(_ condition: @autoclosure () -> Bool, _ message: String) {
            guard condition() else { fatalError(message) }
            count += 1
        }
        func near(_ a: CGFloat, _ b: CGFloat) -> Bool { abs(a - b) < 0.001 }

        let portrait = CGSize(width: 1000, height: 2000)
        let container = CGSize(width: 300, height: 300)
        let imageRect = PhotoGeometry.imageRect(imageSize: portrait, containerSize: container)
        check(imageRect == CGRect(x: 75, y: 0, width: 150, height: 300), "Portrait image needs horizontal letterboxing")
        let box = NormalizedBox(x: 0.2, y: 0.1, width: 0.4, height: 0.5)
        let rect = PhotoGeometry.objectRect(box, imageSize: portrait, containerSize: container)
        check(near(rect.minX, 105) && near(rect.minY, 30), "Box must include the image's actual offset")
        check(near(rect.width, 60) && near(rect.height, 150), "Box must scale with the displayed image")

        let landscape = PhotoGeometry.imageRect(imageSize: CGSize(width: 2000, height: 1000), containerSize: container)
        check(landscape == CGRect(x: 0, y: 75, width: 300, height: 150), "Landscape image needs vertical letterboxing")
        let landscapeBox = PhotoGeometry.objectRect(box, imageSize: CGSize(width: 2000, height: 1000), containerSize: container)
        check(near(landscapeBox.minY, 90) && near(landscapeBox.height, 75), "Landscape box position must account for vertical padding")
        check(!NormalizedBox(x: 0.9, y: 0, width: 0.3, height: 1).isValid, "Out-of-range box must be rejected")
        check(!NormalizedBox(x: .nan, y: 0, width: 1, height: 1).isValid, "Nonfinite coordinates must be rejected")
        check(PhotoGeometry.imageRect(imageSize: .zero, containerSize: container) == .zero, "Zero-size input should not divide by zero")

        for target in [CGRect(x: 0, y: 0, width: 30, height: 30), CGRect(x: 270, y: 270, width: 30, height: 30)] {
            let menu = CGSize(width: 244, height: 232)
            let point = PhotoGeometry.menuOrigin(target: target, menuSize: menu, containerSize: container)
            check(point.x >= 12 && point.y >= 12 && point.x + menu.width <= 288 && point.y + menu.height <= 288,
                  "Menus must remain within the surface for both corner targets")
        }

        let response = """
        {"objects":[
          {"id":"1","name":"Poster","type":"text","box":{"x":0.1,"y":0.1,"width":0.3,"height":0.6},"description":"Activity summary","usage":null,"text":"Visible text","translation":"中文翻译"},
          {"id":"2","name":"Cup","type":"object","box":{"x":0.6,"y":0.4,"width":0.2,"height":0.4},"description":"A cup","usage":"Holds drinks","text":null,"translation":null}
        ]}
        """
        let decoded = try JSONDecoder().decode(AnalysisResponse.self, from: Data(response.utf8))
        check(decoded.objects.count == 2, "The app must decode the backend's two-object contract")
        let poster = decoded.objects[0]
        let cup = decoded.objects[1]
        check(poster.actions.map(\.kind) == [.describe, .translate, .copy, .share], "Text actions must use available data")
        check(cup.actions.map(\.kind) == [.usage, .describe, .share], "Actionable advice comes before identification")
        check(cup.actions.first?.title == "下一步建议", "Older responses without advice titles remain compatible")
        var damaged = cup
        damaged.usageTitle = "处理建议"
        check(damaged.actions.first?.title == "处理建议", "Context-specific titles reach the menu")
        check(damaged.shareContent.contains("处理建议\nHolds drinks"), "Shared object includes its advice")
        check(poster.actions.first(where: { $0.kind == .copy })?.content == "Visible text", "Copy must target the selected object's text")
        check(!cup.shareContent.contains("Visible text"), "Content must not leak between object menus")
        print("PASS: \(count) Swift core checks (coordinate mapping, menu bounds, JSON contract, per-object actions).")
    }
}
