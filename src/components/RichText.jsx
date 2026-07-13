import { useRef, useEffect } from 'react';

// Editor de texto rico leve (sem dependências): negrito, itálico, listas,
// título, citação e inserção de imagens (embutidas como data URL).
//
// IMPORTANTE: o contentEditable é NÃO-CONTROLADO. Se o React reescrevesse o
// innerHTML a cada tecla, o cursor voltaria para o início e o texto sairia
// invertido. Por isso o conteúdo só é escrito no DOM quando difere de fato.
export default function RichText({ value, onChange, placeholder = 'Escreva aqui...' }) {
  const ref = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== (value || '')) el.innerHTML = value || '';
  }, [value]);

  const emit = () => onChange(ref.current?.innerHTML || '');
  const exec = (cmd, arg) => { ref.current?.focus(); document.execCommand(cmd, false, arg); emit(); };
  const keep = (e) => e.preventDefault(); // preserva a seleção ao clicar no botão

  // cola como texto puro (evita herdar estilos/HTML de fora)
  const onPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    emit();
  };

  const onImg = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      ref.current?.focus();
      document.execCommand('insertImage', false, reader.result);
      emit();
    };
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
        <button type="button" className="rte-btn" title="Inserir imagem" onMouseDown={keep} onClick={() => fileRef.current?.click()}>🖼️</button>
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
        onBlur={emit}
        onPaste={onPaste}
      />
      <input type="file" accept="image/*" ref={fileRef} hidden onChange={onImg} />
    </div>
  );
}

// Renderiza HTML salvo (somente leitura).
export function RichView({ html }) {
  const isEmpty = !html || (!html.replace(/<[^>]*>/g, '').trim() && !/<img/i.test(html));
  if (isEmpty) return <span className="muted">Sem descrição.</span>;
  return <div className="rich" dangerouslySetInnerHTML={{ __html: html }} />;
}
