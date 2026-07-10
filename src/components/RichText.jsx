import { useRef } from 'react';

// Editor de texto rico leve (sem dependências): negrito, itálico, listas,
// título, citação e inserção de imagens (embutidas como data URL).
export default function RichText({ value, onChange, placeholder = 'Escreva aqui...' }) {
  const ref = useRef(null);
  const fileRef = useRef(null);

  const emit = () => onChange(ref.current?.innerHTML || '');
  const exec = (cmd, arg) => { document.execCommand(cmd, false, arg); ref.current?.focus(); emit(); };
  const keep = (e) => e.preventDefault(); // preserva a seleção ao clicar no botão

  const pickImage = () => fileRef.current?.click();
  const onImg = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { document.execCommand('insertImage', false, reader.result); emit(); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const Btn = ({ cmd, arg, title, children }) => (
    <button type="button" className="rte-btn" title={title} onMouseDown={keep} onClick={() => exec(cmd, arg)}>
      {children}
    </button>
  );

  return (
    <div className="rte">
      <div className="rte-toolbar">
        <Btn cmd="bold" title="Negrito"><b>B</b></Btn>
        <Btn cmd="italic" title="Itálico"><i>I</i></Btn>
        <Btn cmd="underline" title="Sublinhado"><u>U</u></Btn>
        <span className="rte-sep" />
        <Btn cmd="formatBlock" arg="h3" title="Título">H</Btn>
        <Btn cmd="formatBlock" arg="blockquote" title="Citação">❝</Btn>
        <Btn cmd="insertUnorderedList" title="Lista">•</Btn>
        <Btn cmd="insertOrderedList" title="Lista numerada">1.</Btn>
        <span className="rte-sep" />
        <button type="button" className="rte-btn" title="Inserir imagem" onMouseDown={keep} onClick={pickImage}>🖼️</button>
        <span className="rte-sep" />
        <Btn cmd="removeFormat" title="Limpar formatação">⌫</Btn>
      </div>
      <div
        ref={ref}
        className="rte-content rich"
        contentEditable
        suppressContentEditableWarning
        data-ph={placeholder}
        onInput={emit}
        dangerouslySetInnerHTML={{ __html: value || '' }}
      />
      <input type="file" accept="image/*" ref={fileRef} hidden onChange={onImg} />
    </div>
  );
}

// Renderiza HTML salvo (somente leitura).
export function RichView({ html }) {
  if (!html || !html.replace(/<[^>]*>/g, '').trim() && !/<img/i.test(html)) {
    return <span className="muted">Sem descrição.</span>;
  }
  return <div className="rich" dangerouslySetInnerHTML={{ __html: html }} />;
}
