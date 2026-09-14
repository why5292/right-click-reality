import SwiftUI
import PhotosUI
import AVFoundation
import UIKit

enum RealityStyle {
    static let accent = Color(red: 0.72, green: 0.96, blue: 0.36)
    static let background = Color(red: 0.055, green: 0.065, blue: 0.06)
}

@MainActor
struct ContentView: View {
    @StateObject private var model = PhotoViewModel()
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var showingCamera = false
    @State private var cameraAlert = false
    @State private var cameraMessage = ""
    @State private var selectedID: String?
    @State private var resultCard: ResultCard?
    @State private var copied = false
    @State private var copyFeedbackTask: Task<Void, Never>?

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    status
                    photoSurface(height: max(300, min(geometry.size.height - 210, 530)))
                    if let error = model.errorMessage, model.phase == .failed {
                        errorNotice(error)
                    } else if model.phase == .ready && model.objects.isEmpty {
                        errorNotice("没有发现清晰物体。让主体更近一点，再拍一次。")
                    } else {
                        Text(model.image == nil ? "从一张海报、一本书，或手边的杯子开始。" : "点一下物体框，看看你可以做什么。")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .padding(.bottom, 20)
            }
            .scrollIndicators(.hidden)
        }
        .background(RealityStyle.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom) { captureControls }
        .overlay(alignment: .top) {
            if copied {
                Label("已复制", systemImage: "checkmark.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 18).padding(.vertical, 12)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .onChange(of: selectedPhoto) { item in
            guard let item else { return }
            selectedPhoto = nil
            model.load(item)
        }
        .onChange(of: model.photoID) { _ in
            selectedID = nil
            resultCard = nil
        }
        .fullScreenCover(isPresented: $showingCamera) {
            SystemCamera(onPhoto: { image in
                showingCamera = false
                model.acceptCameraImage(image)
            }, onCancel: { showingCamera = false })
            .ignoresSafeArea()
        }
        .sheet(item: $resultCard) { card in
            ResultSheet(card: card)
        }
        .alert("相机暂不可用", isPresented: $cameraAlert) {
            Button("知道了", role: .cancel) {}
        } message: { Text(cameraMessage) }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 5) {
                Text("RIGHT CLICK")
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .tracking(3)
                    .foregroundStyle(RealityStyle.accent)
                Text("Reality.")
                    .font(.system(size: 38, weight: .bold, design: .rounded))
                Text("给现实世界一个右键菜单")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "cursorarrow.click")
                .font(.system(size: 23, weight: .medium))
                .foregroundStyle(RealityStyle.accent)
                .frame(width: 48, height: 48)
                .background(RealityStyle.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 16))
        }
    }

    private var status: some View {
        HStack(spacing: 8) {
            if model.phase == .analyzing || model.phase == .loadingPhoto {
                ProgressView().tint(RealityStyle.accent).scaleEffect(0.8)
                Text(model.phase == .loadingPhoto ? "正在读取照片" : "正在理解画面")
            } else {
                Circle().fill(RealityStyle.accent).frame(width: 6, height: 6)
                Text(model.phase == .ready && !model.objects.isEmpty ? "发现 \(model.objects.count) 个物体 · 点击探索" : "拍照，让物体变得可操作")
            }
            Spacer()
        }
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(.secondary)
    }

    @ViewBuilder
    private func photoSurface(height: CGFloat) -> some View {
        if let image = model.image {
            PhotoCanvas(image: image, objects: model.objects, selectedID: $selectedID, onAction: perform)
                .frame(height: height)
                .overlay {
                    if model.phase == .analyzing {
                        ZStack {
                            Color.black.opacity(0.28)
                            VStack(spacing: 12) {
                                ProgressView().tint(RealityStyle.accent).scaleEffect(1.2)
                                Text("正在发现物体…").font(.subheadline.weight(.medium))
                            }
                            .padding(24)
                            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
                        }
                        .allowsHitTesting(false)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 24))
        } else {
            VStack(spacing: 25) {
                ZStack {
                    RoundedRectangle(cornerRadius: 27)
                        .stroke(RealityStyle.accent.opacity(0.22), style: StrokeStyle(lineWidth: 1, dash: [5, 7]))
                        .frame(width: 158, height: 168)
                    Image(systemName: "viewfinder")
                        .font(.system(size: 70, weight: .ultraLight))
                        .foregroundStyle(RealityStyle.accent.opacity(0.8))
                    Image(systemName: "hand.tap.fill")
                        .font(.system(size: 37))
                        .foregroundStyle(RealityStyle.accent)
                        .rotationEffect(.degrees(-15))
                        .offset(x: 65, y: 55)
                }
                VStack(spacing: 8) {
                    Text("现实，也可以点一下。")
                        .font(.title3.weight(.semibold))
                    Text("拍下眼前的物体\n发现属于它的操作")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(5)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.white.opacity(0.07), lineWidth: 1))
        }
    }

    private var captureControls: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                PhotosPicker(selection: $selectedPhoto, matching: .images, photoLibrary: .shared()) {
                    Image(systemName: "photo.on.rectangle")
                        .font(.system(size: 20, weight: .medium))
                        .frame(width: 56, height: 54)
                        .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 17))
                }
                .tint(.white)
                .accessibilityLabel("从相册选择图片")
                Button(action: openCamera) {
                    Label(model.image == nil ? "拍一张，试试看" : "重新拍照", systemImage: "camera.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(RealityStyle.background)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(RealityStyle.accent, in: RoundedRectangle(cornerRadius: 17))
                }
            }
            Text("照片将发送至识别服务以生成物体菜单")
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 22)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(RealityStyle.background.opacity(0.98))
    }

    private func errorNotice(_ message: String) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Text(message).font(.footnote).foregroundStyle(.secondary)
            Spacer(minLength: 0)
            if model.image != nil {
                Button("重试") {
                    selectedID = nil
                    model.retry()
                }
                .font(.footnote.weight(.semibold))
                .tint(RealityStyle.accent)
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 14))
    }

    private func perform(_ object: DetectedObject, _ action: ObjectAction) {
        if action.kind == .copy {
            UIPasteboard.general.string = action.content
            copyFeedbackTask?.cancel()
            withAnimation { copied = true }
            copyFeedbackTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                guard !Task.isCancelled else { return }
                withAnimation { copied = false }
            }
        } else {
            resultCard = ResultCard(objectName: object.name, title: action.title, content: action.content)
        }
    }

    private func openCamera() {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            cameraMessage = "当前设备无法使用相机，请从相册选择图片。"
            cameraAlert = true
            return
        }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: showingCamera = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                Task { @MainActor in
                    if granted { showingCamera = true }
                    else { showPermissionNotice() }
                }
            }
        default: showPermissionNotice()
        }
    }

    private func showPermissionNotice() {
        cameraMessage = "请在系统设置中允许相机访问。你也可以直接从相册选择图片。"
        cameraAlert = true
    }
}
