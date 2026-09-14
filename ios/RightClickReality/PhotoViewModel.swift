import SwiftUI
import PhotosUI
import UIKit

@MainActor
final class PhotoViewModel: ObservableObject {
    enum Phase: Equatable { case empty, loadingPhoto, analyzing, ready, failed }

    @Published private(set) var image: UIImage?
    @Published private(set) var objects: [DetectedObject] = []
    @Published private(set) var phase: Phase = .empty
    @Published private(set) var errorMessage: String?
    @Published private(set) var photoID = UUID()

    private var jpegData: Data?
    private var activeTask: Task<Void, Never>?
    private var generation = UUID()
    private let service = AnalysisService()

    func load(_ item: PhotosPickerItem) {
        let token = beginNewPhoto()
        phase = .loadingPhoto
        activeTask = Task { [weak self] in
            do {
                guard let data = try await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else {
                    throw ServiceFailure(message: "这张图片无法读取，请重新选择。")
                }
                guard let self, self.generation == token, !Task.isCancelled else { return }
                try self.prepare(image)
                await self.performAnalysis(token: token)
            } catch {
                self?.fail(error, token: token)
            }
        }
    }

    func acceptCameraImage(_ image: UIImage) {
        let token = beginNewPhoto()
        do {
            try prepare(image)
            activeTask = Task { [weak self] in
                guard let self else { return }
                await self.performAnalysis(token: token)
            }
        } catch { fail(error, token: token) }
    }

    func retry() {
        guard jpegData != nil else { return }
        activeTask?.cancel()
        generation = UUID()
        let token = generation
        objects = []
        errorMessage = nil
        activeTask = Task { [weak self] in
            guard let self else { return }
            await self.performAnalysis(token: token)
        }
    }

    func reportCaptureFailure(_ message: String) {
        errorMessage = message
    }

    private func beginNewPhoto() -> UUID {
        activeTask?.cancel()
        generation = UUID()
        photoID = generation
        image = nil
        jpegData = nil
        objects = []
        errorMessage = nil
        phase = .loadingPhoto
        return generation
    }

    private func prepare(_ source: UIImage) throws {
        let prepared = try ImagePreparation.prepare(source)
        image = prepared.image
        jpegData = prepared.data
    }

    private func performAnalysis(token: UUID) async {
        guard token == generation, let jpegData else { return }
        phase = .analyzing
        do {
            let result = try await service.analyze(jpegData: jpegData)
            guard token == generation, !Task.isCancelled else { return }
            objects = result.objects
            phase = .ready
        } catch { fail(error, token: token) }
    }

    private func fail(_ error: Error, token: UUID) {
        guard token == generation, !Task.isCancelled else { return }
        if let error = error as? URLError {
            if error.code == .cancelled { return }
            errorMessage = error.code == .timedOut ? "识别等待时间较长，请检查网络后重试。" : "暂时连不上识别服务，请检查网络后重试。"
        } else {
            errorMessage = (error as? ServiceFailure)?.message ?? "图片识别未完成，请重试。"
        }
        phase = .failed
    }
}
