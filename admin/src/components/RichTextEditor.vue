<script setup lang="ts">
import { watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'

const props = defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Underline,
    Link.configure({ openOnClick: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder: props.placeholder ?? 'Write something…' }),

  ],
  editorProps: {
    attributes: { class: 'rte-content' },
  },
  onUpdate({ editor }) {
    emit('update:modelValue', editor.getHTML())
  },
})

watch(() => props.modelValue, (val) => {
  if (editor.value && editor.value.getHTML() !== val) {
    editor.value.commands.setContent(val, false)
  }
})

function setLink() {
  const url = window.prompt('URL', editor.value?.getAttributes('link').href ?? '')
  if (url === null) return
  if (url === '') {
    editor.value?.chain().focus().unsetLink().run()
    return
  }
  editor.value?.chain().focus().setLink({ href: url }).run()
}
</script>

<template>
  <div class="rte-wrapper">
    <!-- Toolbar -->
    <div class="rte-toolbar" v-if="editor">
      <div class="rte-group">
        <button type="button" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()" title="Bold"><b>B</b></button>
        <button type="button" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()" title="Italic"><i>I</i></button>
        <button type="button" :class="{ active: editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()" title="Underline"><u>U</u></button>
        <button type="button" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()" title="Strikethrough"><s>S</s></button>
      </div>
      <div class="rte-sep"/>
      <div class="rte-group">
        <button type="button" :class="{ active: editor.isActive('heading', { level: 1 }) }" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" title="Heading 1">H1</button>
        <button type="button" :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" title="Heading 2">H2</button>
        <button type="button" :class="{ active: editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" title="Heading 3">H3</button>
        <button type="button" :class="{ active: editor.isActive('paragraph') }" @click="editor.chain().focus().setParagraph().run()" title="Paragraph">P</button>
      </div>
      <div class="rte-sep"/>
      <div class="rte-group">
        <button type="button" :class="{ active: editor.isActive({ textAlign: 'left' }) }" @click="editor.chain().focus().setTextAlign('left').run()" title="Align left">&#8676;</button>
        <button type="button" :class="{ active: editor.isActive({ textAlign: 'center' }) }" @click="editor.chain().focus().setTextAlign('center').run()" title="Align center">&#8803;</button>
        <button type="button" :class="{ active: editor.isActive({ textAlign: 'right' }) }" @click="editor.chain().focus().setTextAlign('right').run()" title="Align right">&#8677;</button>
      </div>
      <div class="rte-sep"/>
      <div class="rte-group">
        <button type="button" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()" title="Bullet list">&#8226;&#8212;</button>
        <button type="button" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()" title="Ordered list">1&#8212;</button>
        <button type="button" :class="{ active: editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()" title="Blockquote">&#10078;</button>
        <button type="button" :class="{ active: editor.isActive('code') }" @click="editor.chain().focus().toggleCode().run()" title="Inline code">&#96;</button>
        <button type="button" :class="{ active: editor.isActive('codeBlock') }" @click="editor.chain().focus().toggleCodeBlock().run()" title="Code block">&#60;/&#62;</button>
      </div>
      <div class="rte-sep"/>
      <div class="rte-group">
        <button type="button" :class="{ active: editor.isActive('link') }" @click="setLink" title="Link">&#128279;</button>
        <button type="button" @click="editor.chain().focus().setHorizontalRule().run()" title="Horizontal rule">&#8213;</button>
      </div>
      <div class="rte-sep"/>
      <div class="rte-group">
        <button type="button" @click="editor.chain().focus().undo().run()" :disabled="!editor.can().undo()" title="Undo">&#8630;</button>
        <button type="button" @click="editor.chain().focus().redo().run()" :disabled="!editor.can().redo()" title="Redo">&#8631;</button>
      </div>
    </div>

    <EditorContent :editor="editor" />
  </div>
</template>

<style scoped>
.rte-wrapper {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
}

.rte-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.125rem;
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}

.rte-group {
  display: flex;
  gap: 0.125rem;
}

.rte-sep {
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 0.25rem;
}

.rte-toolbar button {
  background: none;
  border: none;
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
  font-size: 0.8125rem;
  cursor: pointer;
  color: var(--text-muted);
  min-width: 26px;
  transition: background 0.1s, color 0.1s;
}

.rte-toolbar button:hover:not(:disabled) {
  background: var(--surface);
  color: var(--text);
}

.rte-toolbar button.active {
  background: var(--accent);
  color: #fff;
}

.rte-toolbar button:disabled {
  opacity: 0.3;
  cursor: default;
}

:deep(.rte-content) {
  padding: 0.75rem 1rem;
  min-height: 160px;
  outline: none;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text);
}

:deep(.rte-content p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--text-muted);
  pointer-events: none;
  height: 0;
}

:deep(.rte-content h1) { font-size: 1.5rem; font-weight: 700; margin: 0.75rem 0 0.25rem; }
:deep(.rte-content h2) { font-size: 1.25rem; font-weight: 700; margin: 0.75rem 0 0.25rem; }
:deep(.rte-content h3) { font-size: 1.1rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
:deep(.rte-content p)  { margin: 0.25rem 0; }
:deep(.rte-content ul), :deep(.rte-content ol) { padding-left: 1.5rem; margin: 0.25rem 0; }
:deep(.rte-content blockquote) { border-left: 3px solid var(--accent); padding-left: 0.75rem; color: var(--text-muted); margin: 0.5rem 0; }
:deep(.rte-content code) { background: var(--surface-2); border-radius: 3px; padding: 0.1rem 0.3rem; font-family: monospace; font-size: 0.875em; }
:deep(.rte-content pre) { background: var(--surface-2); border-radius: var(--radius); padding: 0.75rem 1rem; overflow-x: auto; margin: 0.5rem 0; }
:deep(.rte-content pre code) { background: none; padding: 0; }
:deep(.rte-content a) { color: var(--accent); text-decoration: underline; }
:deep(.rte-content hr) { border: none; border-top: 1px solid var(--border); margin: 0.75rem 0; }
</style>
