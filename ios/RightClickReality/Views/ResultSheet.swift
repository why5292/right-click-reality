import SwiftUI
import UIKit

struct ResultSheet: View {
    let card: ResultCard
    @Environment(\.dismiss) private var dismiss
    @State private var copied = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(card.objectName)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(RealityStyle.accent)
                    Text(card.title)
                        .font(.system(size: 27, weight: .bold, design: .rounded))
                    Text(card.content)
                        .font(.system(size: 17))
                        .lineSpacing(7)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(24)
            }
            .background(RealityStyle.background)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("完成") { dismiss() }.tint(RealityStyle.accent)
                }
            }
            .safeAreaInset(edge: .bottom) {
                HStack(spacing: 12) {
                    Button {
                        UIPasteboard.general.string = card.content
                        copied = true
                    } label: {
                        Label(copied ? "已复制" : "复制", systemImage: copied ? "checkmark" : "doc.on.doc")
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                    }
                    .buttonStyle(.plain)
                    .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
                    ShareLink(item: "\(card.objectName)\n\n\(card.content)") {
                        Label("分享", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(RealityStyle.background)
                    .background(RealityStyle.accent, in: RoundedRectangle(cornerRadius: 14))
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 24).padding(.vertical, 14)
                .background(RealityStyle.background)
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .preferredColorScheme(.dark)
    }
}
