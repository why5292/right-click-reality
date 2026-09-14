// These fixtures are manually prepared interaction examples, never a model response.
export const demos = {
  poster: {
    image: '/assets/reference-poster.jpg', alt: '用户提供的 TRAE 活动海报，配合人工标注演示交互',
    objects: [{ id: 'poster', name: 'TRAE 活动海报', type: 'text', box: { x: .145, y: .12, width: .70, height: .80 }, description: 'TRAE on Campus · AI Coding Hackathon\n\n09 月 12 日，13:30–18:00\n香港城市大学杨建文学术楼 LT12\n\n活动包含产品分享、Demo 演示、闪电开发及路演颁奖。闪电开发时段为 15:40–17:20，共 100 分钟。\n\n海报没有标出年份；底部被遮挡的文字未补写。', text: 'TRAE on Campus\n@香港城市大学市场营销系\nAI Coding Hackathon\n09月12日 13:30–18:00\n香港城市大学杨建文学术楼 LT12\n创意到落地 手把手教你构建AI应用\n15:40–17:20 闪电开发｜从0–1创意落地', translation: 'AI Coding Hackathon：AI 编程黑客松\nShip Faster with TRAE：使用 TRAE 更快地完成开发与交付', usage: null }]
  },
  desk: {
    image: '/assets/desk.svg', alt: '一本文字为 Make something real 的示意书和一只马克杯，配合人工标注演示交互',
    objects: [
      { id: 'book', name: '一本设计主题的书', type: 'book', box: { x: .091, y: .173, width: .38, height: .536 }, description: '这是一张用于演示的书籍示意图。封面写着“Make something real.”，署名为 STUDIO REALITY。\n\n可以读取和翻译封面文字；仅凭封面无法确定书中的具体内容。', text: 'A FIELD GUIDE\nMake something real.\nSTUDIO REALITY', translation: '一本实践指南\n做出真实的东西。\nSTUDIO REALITY（封面署名）', usage: null },
      { id: 'cup', name: '马克杯', type: 'object', box: { x: .607, y: .40, width: .30, height: .28 }, description: '一只浅色、带把手的马克杯。示意图里装有深色饮品。', usage: '用于盛放日常饮品，把手便于握持。仅凭图片无法判断杯子的实际材质、容量或耐热程度。', text: null, translation: null }
    ]
  }
};
