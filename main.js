
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export function getConversationMessages(conversation) {
  const messages = [];
  const nodes = conversation && (conversation.nodes || conversation.mapping) ? Object.values(conversation.nodes || conversation.mapping) : [];
  nodes.forEach((node, idx) => {
    if (!node || !node.message) {
      return;
    }
    const msg = node.message;
    const content = msg.content;
    if (!content || !Array.isArray(content.parts) || content.parts.length === 0) {
      return;
    }
    const isSystem = msg.author && msg.author.role === "system" && !(msg.metadata && msg.metadata.is_user_system_message);
    if (isSystem) {
      return;
    }

    let author = msg.author && msg.author.role;
    if (author === "assistant") author = "ChatGPT";
    else if (author === "tool") author = msg.author.name || "Tool";

    const parts = [];
    for (const p of content.parts) {
      if (typeof p === 'string' && p.length) {
        // Convert markdown string to safe HTML
        const rawHtml = marked.parse(p);
        const safeHtml = sanitizeHtml(rawHtml, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1','h2','u','s','pre','code']),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ['src', 'alt', 'title']
          }
        });
        parts.push({ html: safeHtml, raw: p });
      } else if (p && p.content_type === 'audio_transcription') {
        parts.push({ transcript: p.text || '' });
      } else if (p && ['audio_asset_pointer','image_asset_pointer','video_container_asset_pointer'].includes(p.content_type)) {
        parts.push({ asset: p });
      } else if (p && p.content_type === 'real_time_user_audio_video_asset_pointer') {
        if (p.audio_asset_pointer) parts.push({ asset: p.audio_asset_pointer });
        if (p.video_container_asset_pointer) parts.push({ asset: p.video_container_asset_pointer });
        if (Array.isArray(p.frames_asset_pointers)) {
          for (const f of p.frames_asset_pointers) parts.push({ asset: f });
        }
      }
    }

    if (parts.length > 0) {
      messages.push({ author, parts, createdAt: msg.create_time || node.create_time || 0 });
    }
  });
  messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return messages;
}