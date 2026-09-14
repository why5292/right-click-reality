export function imageFrame(image, container) {
  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale, height = image.height * scale;
  return { x: (container.width - width) / 2, y: (container.height - height) / 2, width, height };
}

export function menuPosition(target, menu, container) {
  const margin = 10;
  const x = Math.max(margin, Math.min(target.x + target.width * .55, container.width - menu.width - margin));
  const above = target.y - menu.height - 10;
  const preferredY = above >= margin ? above : target.y + Math.min(target.height * .3, 55);
  return { x, y: Math.max(margin, Math.min(preferredY, container.height - menu.height - margin)) };
}

const value = text => typeof text === 'string' && text.trim() && text !== 'null' ? text.trim() : null;
export function shareContent(object) {
  return [object.name, value(object.description), object.type === 'object' && value(object.usage) && `${value(object.usageTitle) || '下一步建议'}\n${object.usage}`, value(object.text) && `原文\n${object.text}`, value(object.translation) && `中文翻译\n${object.translation}`].filter(Boolean).join('\n\n');
}

export function actionsFor(object) {
  const actions = [];
  if (value(object.description)) actions.push({ kind: 'describe', title: ({ text: '看懂内容', book: '查看封面信息', object: '观察到的情况' })[object.type] || '观察到的情况', symbol: '✧', content: object.description });
  if (object.type === 'object' && value(object.usage)) actions.unshift({ kind: 'usage', title: value(object.usageTitle) || '下一步建议', symbol: '☼', content: object.usage });
  if (value(object.text) && value(object.translation)) actions.push({ kind: 'translate', title: '翻译文字', symbol: '文', content: object.translation });
  if (value(object.text)) actions.push({ kind: 'copy', title: object.type === 'book' ? '复制封面文字' : '复制文字', symbol: '⧉', content: object.text });
  actions.push({ kind: 'share', title: '分享', symbol: '↗', content: shareContent(object) });
  return actions;
}

export function validObjects(objects) {
  if (!Array.isArray(objects)) throw new Error('识别结果格式异常，请重试。');
  const valid = objects.slice(0, 3).filter(o => {
    const b = o?.box;
    return typeof o?.id === 'string' && typeof o?.name === 'string' && ['text', 'book', 'object'].includes(o.type) && b && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(b[k])) && b.x >= 0 && b.y >= 0 && b.width > 0 && b.height > 0 && b.x + b.width <= 1.000001 && b.y + b.height <= 1.000001;
  });
  if (valid.length !== objects.slice(0, 3).length || new Set(valid.map(o => o.id)).size !== valid.length) throw new Error('物体位置未识别清楚，请重拍或重试。');
  return valid;
}
