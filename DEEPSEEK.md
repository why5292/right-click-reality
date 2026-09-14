# DeepSeek 图像接入

2026-09-14 核对：[2026-09-10 官方发布公告](https://deepseek.com/news/deepseek-v4-1-flash/)说明 V4.1 Flash 原生支持视觉，最新 API 名称为 `deepseek-flash`。旧视觉实验模型名称只是临时兼容别名，不使用旧名称建立新配置。

后端已实现官方 `https://api.deepseek.com/chat/completions` 接口。图片以 user 消息中的 Base64 data URL 发送，保持高分辨率，关闭思考以优先响应速度，使用 JSON output。共享当前的物体框校验、状态建议、复制与分享数据结构，手机无需为切换模型重新安装。

在 `backend/.env` 填写独立的 `DEEPSEEK_API_KEY`，模型使用 `DEEPSEEK_MODEL=deepseek-flash`。准备测试时设置 `VISION_PROVIDER=deepseek` 并重启后端。Gemini 密钥不会被用作 DeepSeek 密钥；未配置时不向上游发送请求。

已配置独立密钥，识别服务已切换为 DeepSeek 并重启。24 项回归测试通过。

真实海报首次返回了错误的 properties.objects 包装，改用明确的数据形状示例、禁止 Schema 包装后，1.83 秒返回合法结果。活动日期、时间和地点与参考海报相符；底部被遮挡文字仍有补全迹象，不能声称 OCR 完全准确。多个物体同框定位尚待实拍验证。

带旧答案文字的苹果截图在 1.73 秒返回“处理建议”，建议停止食用、整颗丢弃和清洁接触物，没有推荐普通食用用途。该输入带有旧描述文字且苹果部分被界面遮挡，不能替代无文字提示的原苹果照片测试，也不能证明独立视觉判断准确率。

调用结果保存于本地 .build/deepseek-poster.json 和 .build/deepseek-apple.json，不包含密钥。手机不需要重新安装，重新拍照或选图即可使用新服务。

参考：[Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) · [图像输入格式](https://api-docs.deepseek.com/guides/vision/)（该指南部分模型名称尚未随发布公告更新）。
