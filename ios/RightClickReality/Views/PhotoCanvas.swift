import SwiftUI
import UIKit

struct PhotoCanvas: View {
    let image: UIImage
    let objects: [DetectedObject]
    @Binding var selectedID: String?
    let onAction: (DetectedObject, ObjectAction) -> Void

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .topLeading) {
                Color.black
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .contentShape(Rectangle())
                    .onTapGesture { withAnimation { selectedID = nil } }

                // Smaller overlapping objects render last, so their hit targets remain reachable.
                ForEach(objects.sorted { $0.box.area > $1.box.area }) { object in
                    let rect = PhotoGeometry.objectRect(object.box, imageSize: image.size, containerSize: geometry.size)
                    objectButton(object, rect: rect, container: geometry.size)
                }

                if let selected = objects.first(where: { $0.id == selectedID }) {
                    let rect = PhotoGeometry.objectRect(selected.box, imageSize: image.size, containerSize: geometry.size)
                    let width = min(CGFloat(244), geometry.size.width - 24)
                    let height = CGFloat(48 + selected.actions.count * 44)
                    let origin = PhotoGeometry.menuOrigin(target: rect,
                                                         menuSize: CGSize(width: width, height: height),
                                                         containerSize: geometry.size)
                    ObjectMenu(object: selected, onAction: { onAction(selected, $0) })
                        .frame(width: width)
                        .offset(x: origin.x, y: origin.y)
                        .transition(.scale(scale: 0.96, anchor: .top).combined(with: .opacity))
                        .zIndex(10)
                }
            }
            .animation(.spring(response: 0.25, dampingFraction: 0.88), value: selectedID)
        }
        .accessibilityElement(children: .contain)
    }

    private func objectButton(_ object: DetectedObject, rect: CGRect, container: CGSize) -> some View {
        let selected = object.id == selectedID
        return Button {
            withAnimation { selectedID = selected ? nil : object.id }
        } label: {
            RoundedRectangle(cornerRadius: 8)
                .fill(RealityStyle.accent.opacity(selected ? 0.12 : 0.035))
                .overlay(RoundedRectangle(cornerRadius: 8)
                    .stroke(selected ? RealityStyle.accent : Color.white.opacity(0.85), lineWidth: selected ? 2.5 : 1.5))
                .overlay(alignment: .topLeading) {
                    Text(object.name)
                        .font(.system(size: 11, weight: .semibold))
                        .lineLimit(1)
                        .foregroundStyle(selected ? RealityStyle.background : Color.white)
                        .padding(.horizontal, 8).padding(.vertical, 5)
                        .background(selected ? RealityStyle.accent : Color.black.opacity(0.72), in: Capsule())
                        .frame(maxWidth: max(30, min(rect.width, container.width - rect.minX)), alignment: .leading)
                        .padding(4)
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .frame(width: rect.width, height: rect.height)
        .position(x: rect.midX, y: rect.midY)
        .accessibilityLabel("\(object.name)，显示操作菜单")
    }
}

private struct ObjectMenu: View {
    let object: DetectedObject
    let onAction: (ObjectAction) -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 7) {
                Circle().fill(RealityStyle.accent).frame(width: 5, height: 5)
                Text(object.name).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                Spacer(minLength: 0)
            }
            .foregroundStyle(.secondary)
            .padding(.horizontal, 15)
            .frame(height: 47)
            Divider().overlay(Color.white.opacity(0.06))
            ForEach(object.actions) { action in
                if action.kind == .share {
                    ShareLink(item: action.content) { row(action) }
                        .buttonStyle(.plain)
                } else {
                    Button { onAction(action) } label: { row(action) }
                        .buttonStyle(.plain)
                }
            }
        }
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).stroke(Color.white.opacity(0.14), lineWidth: 1))
        .shadow(color: .black.opacity(0.4), radius: 22, y: 10)
    }

    private func row(_ action: ObjectAction) -> some View {
        HStack(spacing: 11) {
            Image(systemName: action.symbol)
                .font(.system(size: 15))
                .foregroundStyle(RealityStyle.accent)
                .frame(width: 21)
            Text(action.title).font(.system(size: 14, weight: .medium))
            Spacer()
            if action.kind != .copy && action.kind != .share {
                Image(systemName: "chevron.right").font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 15)
        .frame(height: 44)
        .contentShape(Rectangle())
    }
}
